// Import Prisma client untuk koneksi database
import { prisma } from "@/lib/db";
// Import NextResponse untuk membuat HTTP response
import { NextResponse } from "next/server";

// Konfigurasi runtime untuk menggunakan Node.js (bukan Edge runtime)
export const runtime = "nodejs";
// Paksa route ini sebagai dynamic — mencegah Next.js eksekusi koneksi DB saat build time
export const dynamic = "force-dynamic";

/**
 * API Endpoint: GET /api/analytics/quick
 * Fungsi: Mengambil statistik cepat untuk dashboard analytics
 * Returns: Data pendapatan hari ini vs kemarin dengan trend persentase
 */
export async function GET() {
  try {
    // Mendapatkan waktu sekarang
    const now = new Date();

    // Membuat timestamp untuk awal hari ini (jam 00:00:00)
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    // Membuat timestamp untuk awal hari kemarin (jam 00:00:00)
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    // Query database secara parallel untuk performa yang lebih baik
    // Mengambil data transaksi hari ini dan kemarin sekaligus
    const [todayStats, yesterdayStats] = await Promise.all([
      // Aggregate data transaksi hari ini
      prisma.transaction.aggregate({
        where: {
          createdAt: { gte: todayStart }, // >= hari ini jam 00:00
          status: "completed", // hanya transaksi yang selesai
        },
        _sum: { total: true }, // jumlahkan total pendapatan
        _count: true, // hitung jumlah transaksi
      }),
      // Aggregate data transaksi kemarin
      prisma.transaction.aggregate({
        where: {
          createdAt: { gte: yesterdayStart, lt: todayStart }, // kemarin jam 00:00 sampai hari ini jam 00:00
          status: "completed", // hanya transaksi yang selesai
        },
        _sum: { total: true }, // jumlahkan total pendapatan
        _count: true, // hitung jumlah transaksi
      }),
    ]);

    // Extract pendapatan dari hasil query, default 0 jika null
    const todayRevenue = todayStats._sum.total || 0;
    const yesterdayRevenue = yesterdayStats._sum.total || 0;

    // Inisialisasi variabel untuk trend (naik/turun/netral)
    let trend: "up" | "down" | "neutral" = "neutral";
    let trendPercent = 0;

    // Hitung trend hanya jika ada pendapatan kemarin (untuk menghindari division by zero)
    if (yesterdayRevenue > 0) {
      // Hitung selisih pendapatan
      const revenueDiff = todayRevenue - yesterdayRevenue;

      // Hitung persentase perubahan (absolute value)
      trendPercent = Math.abs((revenueDiff / yesterdayRevenue) * 100);

      // Tentukan arah trend
      if (revenueDiff > 0)
        trend = "up"; // pendapatan naik
      else if (revenueDiff < 0) trend = "down"; // pendapatan turun
      // jika revenueDiff === 0, tetap "neutral"
    }

    // Return response JSON dengan semua data statistik
    return NextResponse.json({
      todayRevenue, // pendapatan hari ini
      todayTransactions: todayStats._count || 0, // jumlah transaksi hari ini
      yesterdayRevenue, // pendapatan kemarin (untuk perbandingan)
      trend, // arah trend: "up", "down", atau "neutral"
      trendPercent, // persentase perubahan
    });
  } catch (error) {
    // Log error ke console untuk debugging
    console.error("Quick stats error:", error);

    // Return error response dengan status 500
    return NextResponse.json(
      { error: "Failed to fetch stats" },
      { status: 500 },
    );
  }
}
