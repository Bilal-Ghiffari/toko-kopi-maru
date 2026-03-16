import { prisma } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
import { z } from "zod/v4";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { SEARCH_PARSER_PROMPT } from "@/lib/ai/prompts";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { llmHighAccuracy } from "@/lib/ai/langchain";

const SearchCriteriaSchema = z.object({
  searchTerms: z.array(z.string()),
  category: z.string().nullable(),
  priceRange: z.object({
    min: z.number().nullable(),
    max: z.number().nullable(),
  }),
  sortBy: z.enum(["price_asc", "price_desc", "name", "stock"]).nullable(),
  attributes: z
    .object({
      isSweet: z.boolean().nullable(),
      isCold: z.boolean().nullable(),
      hasMilk: z.boolean().nullable(),
      isSpicy: z.boolean().nullable(),
    })
    .optional(),
});

type SearchCriteria = z.infer<typeof SearchCriteriaSchema>;

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();

    // Jika query kosong, return semua produk aktif
    if (!query || query.trim().length === 0) {
      const products = await prisma.product.findMany({
        where: { isActive: true, stock: { gt: 0 } },
        include: { category: true },
        orderBy: { name: "asc" },
        take: 50,
      });

      return NextResponse.json({
        products,
        aiParsed: null,
        source: "all_products",
      });
    }

    // Simple search untuk query sangat pendek
    if (query.length < 2 && query.trim().length > 0) {
      // Lakukan simple search tanpa AI
      const products = await prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { sku: { contains: query, mode: "insensitive" } },
          ],
          isActive: true,
        },
        include: { category: true },
        take: 20,
      });

      return NextResponse.json({
        products,
        aiParsed: null,
        source: "simple_search",
      });
    }

    // Query yang jelas bukan search (greeting, dll)
    const nonSearchPatterns =
      /^(halo|hai|hi|hello|thanks|terima kasih|ok|oke)/i;
    if (nonSearchPatterns.test(query)) {
      // Return empty, biarkan chat handler yang handle
      return NextResponse.json({
        products: [],
        aiParsed: null,
        source: "not_a_search",
        message: "Query ini sepertinya bukan pencarian produk",
      });
    }

    // Get categories untuk context
    const categories = await prisma.category.findMany();
    const categoryNames = categories.map((c) => c.name).join(", ");

    // Parse query dengan AI
    const prompt = ChatPromptTemplate.fromTemplate(SEARCH_PARSER_PROMPT);
    const parser = new JsonOutputParser();
    const chain = prompt.pipe(llmHighAccuracy).pipe(parser);

    let aiParsed: SearchCriteria | null = null;
    let parseError: string | null = null;

    try {
      const parsed = await chain.invoke({
        query,
        categories: categoryNames,
      });

      // Validate dengan Zod
      const validated = SearchCriteriaSchema.safeParse(parsed);

      if (validated.success) {
        aiParsed = validated.data;
      } else {
        console.warn("AI output validation failed:", validated.error);
        parseError = "AI parsing validation failed";
      }
    } catch (aiError) {
      console.error("AI parsing error:", aiError);
      parseError = "AI parsing failed";
    }

    // Build Prisma query
    type WhereCondition = Record<string, unknown>;
    const andConditions: WhereCondition[] = [
      { isActive: true },
      { stock: { gt: 0 } },
    ];

    if (aiParsed) {
      // Search terms
      if (aiParsed.searchTerms.length > 0) {
        andConditions.push({
          OR: aiParsed.searchTerms.flatMap((term) => [
            { name: { contains: term, mode: "insensitive" } },
            { description: { contains: term, mode: "insensitive" } },
          ]),
        });
      }

      // Category filter
      if (aiParsed.category) {
        andConditions.push({
          category: {
            name: { equals: aiParsed.category, mode: "insensitive" },
          },
        });
      }

      // Price range
      if (aiParsed.priceRange.min !== null) {
        andConditions.push({ price: { gte: aiParsed.priceRange.min } });
      }
      if (aiParsed.priceRange.max !== null) {
        andConditions.push({ price: { lte: aiParsed.priceRange.max } });
      }

      // Attribute-based search (search in description)
      if (aiParsed.attributes) {
        const attrFilters: WhereCondition[] = [];

        if (aiParsed.attributes.isSweet === true) {
          attrFilters.push({
            description: { contains: "manis", mode: "insensitive" },
          });
        } else if (aiParsed.attributes.isSweet === false) {
          // Cari yang pahit atau tidak manis
          attrFilters.push({
            OR: [
              { description: { contains: "pahit", mode: "insensitive" } },
              { description: { contains: "strong", mode: "insensitive" } },
              { description: { contains: "tanpa gula", mode: "insensitive" } },
            ],
          });
        }

        if (aiParsed.attributes.isCold === true) {
          attrFilters.push({
            OR: [
              { description: { contains: "dingin", mode: "insensitive" } },
              { description: { contains: "cold", mode: "insensitive" } },
              { description: { contains: "es ", mode: "insensitive" } },
              { name: { contains: "es ", mode: "insensitive" } },
              { name: { startsWith: "Es ", mode: "insensitive" } },
              { name: { contains: "Cold", mode: "insensitive" } },
              { name: { contains: "Ice", mode: "insensitive" } },
              { description: { contains: "ice", mode: "insensitive" } },
            ],
          });
        }

        if (aiParsed.attributes.hasMilk === false) {
          // Exclude susu - ini tricky, kita cari yang explicitly tanpa susu
          attrFilters.push({
            OR: [
              { description: { contains: "tanpa susu", mode: "insensitive" } },
              { description: { contains: "hitam", mode: "insensitive" } },
              { name: { contains: "Americano", mode: "insensitive" } },
              { name: { contains: "Espresso", mode: "insensitive" } },
            ],
          });
        }

        if (attrFilters.length > 0) {
          andConditions.push(...attrFilters);
        }
      }
    } else {
      // Fallback: simple text search jika AI parsing gagal
      // Split query menjadi keywords untuk flexible matching
      const keywords = query
        .toLowerCase()
        .split(/\s+/)
        .filter((k: string) => k.length > 1);

      if (keywords.length > 0) {
        andConditions.push({
          OR: keywords.flatMap((keyword: string) => [
            { name: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
          ]),
        });
      } else {
        andConditions.push({
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ],
        });
      }
    }

    const whereClause = { AND: andConditions };

    // Determine sort order
    let orderBy: Record<string, string> = { name: "asc" };
    if (aiParsed?.sortBy) {
      switch (aiParsed.sortBy) {
        case "price_asc":
          orderBy = { price: "asc" };
          break;
        case "price_desc":
          orderBy = { price: "desc" };
          break;
        case "name":
          orderBy = { name: "asc" };
          break;
        case "stock":
          orderBy = { stock: "desc" };
          break;
      }
    }

    // Execute query
    const products = await prisma.product.findMany({
      where: whereClause,
      include: { category: true },
      orderBy,
      take: 30,
    });

    return NextResponse.json({
      products,
      aiParsed,
      originalQuery: query,
      parseError,
      resultCount: products.length,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Search failed", details: String(error) },
      { status: 500 },
    );
  }
}
