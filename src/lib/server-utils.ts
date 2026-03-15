// File ini HANYA untuk digunakan di Server Components atau API Routes
// JANGAN import file ini di Client Components!

import { prisma } from "./db";
import { formatCurrency } from "./utils";

// Helper function untuk get top products
export async function getTopProducts(
  startDate: Date,
  endDate: Date,
  limit: number
) {
  const topItems = await prisma.transactionItem.groupBy({
    by: ["productId", "productName"], // kelompokkan berdasarkan productId dan productName
    where: {
      transaction: {
        createdAt: { gte: startDate, lte: endDate }, // filter berdasarkan tanggal transaksi,
        status: "completed",
      },
    },
    _sum: { quantity: true, subtotal: true }, // hitung total quantity dan subtotal
    orderBy: { _sum: { quantity: "desc" } }, // urutkan berdasarkan quantity terbanyak
    take: limit, // batasi hasil sesuai limit
  });

  return topItems.map((item, index) => ({
    rank: index + 1,
    name: item.productName,
    quantity: item._sum.quantity || 0, // total quantity terjual
    revenue: item._sum.subtotal || 0, // total pendapatan dari produk ini
  }));
}

// Helper function untuk format sales summary
export function formatSalesSummary(
  periodLabel: string,
  salesData: { _sum: { total?: number | null; discountAmount?: number | null }; _count?: number; _avg: { total?: number | null } },
  topProducts: { rank: number; name: string; quantity: number; revenue: number }[]
) {
  const totalRevenue = salesData._sum.total || 0;
  const totalTransactions = salesData._count || 0;
  const averageTransactionValue = salesData._avg.total || 0; // rata-rata nilai transaksi
  const totalDiscount = salesData._sum.discountAmount || 0;

  let response = `📊 LAPORAN PENJUALAN - ${periodLabel.toUpperCase()}

💰 Total Revenue: ${formatCurrency(totalRevenue)}
🧾 Jumlah Transaksi: ${totalTransactions}
📈 Rata-rata/Transaksi: ${formatCurrency(averageTransactionValue)}
🏷️ Total Diskon: ${formatCurrency(totalDiscount)}
`;

  if (topProducts.length > 0) {
    response += `\n🏆 TOP ${topProducts.length} PRODUK TERLARIS:\n`;
    topProducts.forEach((product) => {
      response += `   ${product.rank}. ${product.name} - ${
        product.quantity
      } terjual (${formatCurrency(product.revenue)})\n`;
    });
  }

  // Add insight
  if (totalTransactions > 0) {
    response += `\n💡 Insight: `;
    if (averageTransactionValue > 50000) {
      response +=
        "Rata-rata transaksi cukup tinggi. Customer cenderung beli banyak item.";
    } else if (averageTransactionValue > 30000) {
      response +=
        "Rata-rata transaksi standar. Coba upselling untuk meningkatkan nilai transaksi.";
    } else {
      response +=
        "Rata-rata transaksi rendah. Pertimbangkan bundling atau promo untuk meningkatkan basket size.";
    }
  }

  return response;
}
