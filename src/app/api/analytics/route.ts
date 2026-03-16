/**
 * API Endpoint: POST /api/analytics
 *
 * Fungsi: Generate AI-powered analytics berdasarkan data transaksi
 * Menggunakan LangChain + LLM untuk analisis natural language
 *
 * Request Body:
 * - question: Pertanyaan analytics (contoh: "Produk apa yang paling laris?")
 * - dateRange: Range waktu analisis (today/yesterday/week/month/custom)
 * - startDate: Tanggal mulai (opsional, untuk custom range)
 * - endDate: Tanggal akhir (opsional, untuk custom range)
 *
 * Response:
 * - analysis: Hasil analisis dari AI dalam natural language
 * - data: Data mentah yang digunakan untuk analisis
 * - metadata: Info request dan timestamp
 */

import { llmAnalytics } from "@/lib/ai/langchain";
import { ANALYTICS_PROMPT } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { NextRequest, NextResponse } from "next/server";

// Konfigurasi runtime untuk menggunakan Node.js (butuh akses penuh database)
export const runtime = "nodejs";
// Paksa route ini sebagai dynamic — mencegah Next.js eksekusi koneksi DB saat build time
export const dynamic = "force-dynamic";

// Interface untuk request body validation
interface AnalyticsRequest {
  question: string; // Pertanyaan analytics dari user
  dateRange?: "today" | "yesterday" | "week" | "month" | "custom"; // Range waktu
  startDate?: string; // Tanggal mulai custom (format: YYYY-MM-DD)
  endDate?: string; // Tanggal akhir custom (format: YYYY-MM-DD)
}

export async function POST(req: NextRequest) {
  try {
    // Parse request body
    const body: AnalyticsRequest = await req.json();
    const { question, dateRange = "week" } = body; // Default: 7 hari terakhir

    // Validasi: Pertanyaan harus diisi
    if (!question || question.trim().length === 0) {
      return NextResponse.json(
        { error: "Pertanyaan tidak boleh kosong." },
        { status: 400 },
      );
    }

    // ============================================
    // 1. DETERMINE DATE RANGE
    // ============================================
    // Tentukan start date dan end date berdasarkan dateRange yang dipilih
    const now = new Date();
    let startDate: Date;
    let endDate = now; // Default: sampai sekarang
    let periodLabel: string; // Label untuk ditampilkan ke user

    switch (dateRange) {
      case "today":
        // Hari ini: dari jam 00:00 sampai sekarang
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodLabel = "Hari ini";
        break;
      case "yesterday":
        // Kemarin: dari jam 00:00 kemarin sampai jam 00:00 hari ini
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 1,
        );
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        periodLabel = "Kemarin";
        break;
      case "week":
        // 7 hari terakhir
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 7,
        );
        periodLabel = "7 hari terakhir";
        break;
      case "month":
        // 30 hari terakhir
        startDate = new Date(
          now.getFullYear(),
          now.getMonth() - 1,
          now.getDate(),
        );
        periodLabel = "30 hari terakhir";
        break;
      case "custom":
        // Custom range: gunakan startDate dan endDate dari request
        startDate = body.startDate
          ? new Date(body.startDate)
          : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
        endDate = body.endDate ? new Date(body.endDate) : now;
        periodLabel = "Custom range";
        break;
      default:
        // Fallback: 7 hari terakhir
        startDate = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() - 7,
        );
        periodLabel = "7 hari terakhir";
    }

    // ============================================
    // 2. FETCH COMPREHENSIVE DATA
    // ============================================
    // Query semua data secara parallel untuk performa optimal
    // 7 queries sekaligus menggunakan Promise.all
    const [
      overallStats, // 1. Agregasi total (revenue, avg, count, dll)
      dailyTransactions, // 2. Breakdown per hari
      topProducts, // 3. Top 10 produk terlaris
      categoryStats, // 4. Revenue per kategori
      paymentStats, // 5. Statistik metode pembayaran
      hourlyDistribution, // 6. Distribusi transaksi per jam
      cashierStats, // 7. Performa kasir (jika ada)
    ] = await Promise.all([
      // 1. Overall aggregate - Total revenue, count, avg, min, max
      prisma.transaction.aggregate({
        where: {
          createdAt: { gte: startDate, lte: endDate }, // Filter tanggal
          status: "completed", // Hanya transaksi selesai
        },
        _sum: { total: true, discountAmount: true, taxAmount: true },
        _avg: { total: true }, // Rata-rata nilai transaksi
        _count: true, // Jumlah transaksi
        _min: { total: true }, // Transaksi terkecil
        _max: { total: true }, // Transaksi terbesar
      }),

      // 2. Daily breakdown - Revenue dan jumlah transaksi per hari
      prisma.$queryRaw`
            SELECT
                DATE("createdAt") as date,
                COUNT(*)::int as transactions,
                SUM(total)::numeric as revenue
            FROM
                "Transaction"
            WHERE
                "createdAt" >= ${startDate}
                AND "createdAt" <= ${endDate}
                AND status = 'completed'
            GROUP BY
                DATE("createdAt")
            ORDER BY
                date DESC
        ` as Promise<
        Array<{ date: Date; transactions: number; revenue: number }> // Tanggal, jumlah transaksi, revenue
      >,
      // 3. Top products - 10 produk dengan revenue tertinggi
      prisma.transactionItem.groupBy({
        by: ["productId", "productName"], // Group by produk
        where: {
          transaction: {
            createdAt: { gte: startDate, lte: endDate },
            status: "completed",
          },
        },
        _sum: { quantity: true, subtotal: true }, // Total quantity & revenue
        orderBy: { _sum: { subtotal: "desc" } }, // Urutkan dari revenue tertinggi
        take: 10, // Ambil 10 teratas
      }),

      // 4. Category stats - Revenue per kategori produk
      prisma.$queryRaw`
        SELECT
          p."categoryId",
          c.name as "categoryName",
          COUNT(ti.id)::int as "itemsSold",
          SUM(ti.subtotal)::numeric as revenue
        FROM "TransactionItem" ti
        JOIN "Product" p ON ti."productId" = p.id
        JOIN "Category" c ON p."categoryId" = c.id
        JOIN "Transaction" t ON ti."transactionId" = t.id
        WHERE t."createdAt" >= ${startDate}
          AND t."createdAt" <= ${endDate}
          AND t.status = 'completed'
        GROUP BY p."categoryId", c.name
        ORDER BY revenue DESC
      ` as Promise<
        Array<{ categoryName: string; itemsSold: number; revenue: number }> // Kategori, jumlah item terjual, revenue
      >,

      // 5. Payment method - Breakdown metode pembayaran (cash, qris, dll)
      prisma.transaction.groupBy({
        by: ["paymentMethod"], // Group by metode pembayaran
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: "completed",
        },
        _count: true, // Jumlah transaksi per metode
        _sum: { total: true }, // Total revenue per metode
      }),

      // 6. Hourly distribution - Transaksi per jam (untuk analisis jam ramai)
      prisma.$queryRaw`
        SELECT
          EXTRACT(HOUR FROM "createdAt")::int as hour,
          COUNT(*)::int as transactions,
          SUM(total)::numeric as revenue
        FROM "Transaction"
        WHERE "createdAt" >= ${startDate}
          AND "createdAt" <= ${endDate}
          AND status = 'completed'
        GROUP BY EXTRACT(HOUR FROM "createdAt")
        ORDER BY hour
      ` as Promise<
        Array<{ hour: number; transactions: number; revenue: number }> // Jam, jumlah transaksi, revenue
      >,

      // 7. Cashier performance - Performa masing-masing kasir
      prisma.transaction.groupBy({
        by: ["cashierName"], // Group by nama kasir
        where: {
          createdAt: { gte: startDate, lte: endDate },
          status: "completed",
          cashierName: { not: null }, // Hanya yang ada nama kasirnya
        },
        _count: true, // Jumlah transaksi per kasir
        _sum: { total: true }, // Total sales per kasir
        _avg: { total: true }, // Rata-rata nilai transaksi per kasir
      }),
    ]);

    // ============================================
    // 3. FORMAT DATA FOR AI
    // ============================================
    // Format semua data menjadi struktur yang mudah dipahami AI
    const analyticsData = {
      // Informasi periode
      period: {
        label: periodLabel,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },

      // Summary keseluruhan
      summary: {
        totalRevenue: overallStats._sum.total || 0,
        totalTransactions: overallStats._count || 0,
        averageTransaction: overallStats._avg.total || 0,
        totalDiscount: overallStats._sum.discountAmount || 0,
        totalTax: overallStats._sum.taxAmount || 0,
        minTransaction: overallStats._min.total || 0,
        maxTransaction: overallStats._max.total || 0,
      },

      // Data harian (untuk grafik trend)
      dailyBreakdown: dailyTransactions,

      // Top produk dengan ranking
      topProducts: topProducts.map((p, i) => ({
        rank: i + 1,
        name: p.productName,
        quantitySold: p._sum.quantity || 0,
        revenue: p._sum.subtotal || 0,
      })),

      // Revenue per kategori
      categoryBreakdown: categoryStats,

      // Metode pembayaran dengan persentase
      paymentMethods: paymentStats.map((pm) => ({
        method: pm.paymentMethod,
        transactions: pm._count,
        total: pm._sum.total || 0,
        // Persentase dari total transaksi
        percentage:
          overallStats._count > 0
            ? ((pm._count / overallStats._count) * 100).toFixed(1)
            : 0,
      })),

      // Distribusi jam ramai/sepi
      hourlyDistribution: hourlyDistribution,

      // Performa individu kasir
      cashierPerformance: cashierStats.map((c) => ({
        name: c.cashierName,
        transactions: c._count,
        totalSales: c._sum.total || 0,
        averageTransaction: c._avg.total || 0,
      })),
    };

    // ============================================
    // 4. GENERATE AI ANALYSIS
    // ============================================
    // Gunakan LangChain untuk generate analisis natural language
    const prompt = ChatPromptTemplate.fromTemplate(ANALYTICS_PROMPT);
    const chain = prompt.pipe(llmAnalytics).pipe(new StringOutputParser());

    // Kirim data + pertanyaan ke AI, dapatkan analisis
    const analysis = await chain.invoke({
      data: JSON.stringify(analyticsData, null, 2), // Data dalam format JSON
      question, // Pertanyaan user
    });

    // ============================================
    // 5. RETURN RESPONSE
    // ============================================
    return NextResponse.json({
      analysis, // Hasil analisis AI (natural language)
      data: analyticsData, // Data mentah untuk referensi/visualisasi
      metadata: {
        // Info request
        question,
        dateRange,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    // Error handling - Log untuk debugging
    console.error("Analytics error:", error);
    return NextResponse.json(
      { error: "Gagal generate analytics", details: String(error) },
      { status: 500 },
    );
  }
}
