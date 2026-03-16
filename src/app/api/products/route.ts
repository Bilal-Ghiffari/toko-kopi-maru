import { prisma } from "@/lib/db";
import {
  readLimiter,
  getClientIp,
  createRateLimitResponse,
  addRateLimitHeaders,
} from "@/lib/rate-limit";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * API Endpoint: GET /api/products
 *
 * Fungsi: Mengambil daftar produk dengan filter kategori dan status
 * Rate Limit: 100 requests per menit per IP
 *
 * Query Parameters:
 * - category (optional): Filter berdasarkan nama kategori
 * - active (optional): Filter produk aktif/non-aktif (default: true)
 *
 * Response Headers:
 * - X-RateLimit-Limit: Batas maksimal requests
 * - X-RateLimit-Remaining: Sisa requests yang diperbolehkan
 * - X-RateLimit-Reset: Unix timestamp kapan limit akan reset
 */
export async function GET(req: NextRequest) {
  // ============================================
  // STEP 1: RATE LIMITING CHECK
  // ============================================

  // Extract IP address dari request untuk rate limiting
  const identifier = getClientIp(req);

  // Check apakah request ini melewati rate limit
  const rateLimitResult = await readLimiter.check(identifier);

  // Jika melewati limit, return 429 error
  if (!rateLimitResult.success) {
    return createRateLimitResponse(rateLimitResult);
  }

  // ============================================
  // STEP 2: PROCESS REQUEST
  // ============================================

  try {
    // Parse query parameters dari URL
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const activeOnly = searchParams.get("active") !== "false";

    // Query database dengan filters
    const products = await prisma.product.findMany({
      where: {
        isActive: activeOnly, // Filter berdasarkan status aktif
        ...(category && {
          // Filter berdasarkan kategori (case-insensitive)
          category: { name: { equals: category, mode: "insensitive" } },
        }),
      },
      include: { category: true }, // Include relasi kategori
      orderBy: [
        { category: { name: "asc" } }, // Urutkan berdasarkan kategori
        { name: "asc" }, // Lalu berdasarkan nama produk
      ],
    });

    // Buat response dengan data produk
    const response = NextResponse.json({ products });

    // Add rate limit headers untuk transparency
    return addRateLimitHeaders(response, rateLimitResult);
  } catch (error) {
    // Log error untuk debugging
    console.error("Get products error:", error);

    // Return error response
    const errorResponse = NextResponse.json(
      { error: "Failed to get products" },
      { status: 500 },
    );

    // Tetap tambahkan rate limit headers meskipun error
    return addRateLimitHeaders(errorResponse, rateLimitResult);
  }
}
