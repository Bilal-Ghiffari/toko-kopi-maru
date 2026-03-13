/**
 * FILE: tools.ts
 * DESKRIPSI: File ini berisi definisi tool-tool LangChain yang digunakan oleh AI Agent
 *            untuk melakukan operasi pada sistem POS (Point of Sale).
 *
 * TOOLS YANG TERSEDIA:
 * 1. searchProductsTool - Mencari produk berdasarkan keyword, kategori, atau range harga
 * 2. checkStockTool - Mengecek stok produk dan melihat produk yang perlu restock
 * 3. calculateDiscountTool - Menghitung total belanja dengan diskon
 * 4. getSalesSummaryTool - Mendapatkan ringkasan penjualan untuk periode tertentu
 * 5. getPaymentMethodsBreakdownTool - Melihat breakdown transaksi berdasarkan metode pembayaran
 */

// Import fungsi 'tool' dari LangChain untuk membuat tool yang bisa dipanggil oleh AI
import { tool } from "@langchain/core/tools";

// Import Zod untuk validasi schema input tool (memastikan data yang masuk sesuai tipe)
import { z } from "zod/v4";

// Import instance Prisma Client untuk akses database
import { prisma } from "../db";

// Import fungsi-fungsi utility untuk formatting data
import { formatCurrency } from "../utils";
import { formatSalesSummary, getTopProducts } from "../server-utils";

// ============================================
// TOOL 1: SEARCH PRODUCTS
// ============================================
/**
 * TOOL: searchProductsTool
 * FUNGSI: Mencari produk di database berdasarkan berbagai kriteria
 * USE CASE: Ketika user bertanya "Cari kopi" atau "Produk harga dibawah 50000"
 *
 * INPUT PARAMETERS:
 * - query: String pencarian (opsional) - dicari di nama dan deskripsi produk
 * - category: Kategori produk (opsional) - Kopi, Non-Kopi, Makanan, atau Snack
 * - minPrice: Harga minimum dalam Rupiah (opsional)
 * - maxPrice: Harga maksimum dalam Rupiah (opsional)
 * - limit: Jumlah maksimal hasil (opsional, default 10)
 *
 * OUTPUT: String berisi daftar produk yang ditemukan dengan format human-readable
 */
export const searchProductsTool = tool(
  // Fungsi async yang menerima parameter dari AI agent
  async ({ category, limit, maxPrice, minPrice, query }) => {
    try {
      // Inisialisasi object whereClause untuk filter query Prisma
      // whereClause ini akan di-build secara dinamis berdasarkan parameter yang diterima
      const whereClause: any = {
        isActive: true, // Filter 1: Hanya produk yang aktif (tidak dihapus/dinonaktifkan)
        stock: { gt: 0 }, // Filter 2: Hanya produk dengan stok > 0 (masih tersedia)
      };

      // Store query keywords untuk relevance scoring nanti
      let searchKeywords: string[] = [];

      // Cek apakah parameter 'query' ada dan tidak kosong setelah di-trim
      if (query && query.trim()) {
        // Split query menjadi keywords untuk search yang lebih fleksibel
        // Contoh: "kopi dingin" -> ["kopi", "dingin"]
        searchKeywords = query
          .toLowerCase()
          .split(/\s+/)
          .filter((k) => k.length > 1);

        if (searchKeywords.length > 1) {
          // Jika ada multiple keywords, cari yang mengandung SALAH SATU keyword
          whereClause.OR = searchKeywords.flatMap((keyword) => [
            { name: { contains: keyword, mode: "insensitive" } },
            { description: { contains: keyword, mode: "insensitive" } },
          ]);
        } else {
          // Jika hanya 1 keyword, gunakan logic lama
          whereClause.OR = [
            { name: { contains: query, mode: "insensitive" } },
            { description: { contains: query, mode: "insensitive" } },
          ];
        }
      }

      // Cek apakah parameter 'category' ada (filter berdasarkan kategori)
      if (category) {
        // Filter produk berdasarkan relasi ke tabel Category
        whereClause.category = {
          // Gunakan 'equals' untuk exact match kategori (case-insensitive)
          name: { equals: category, mode: "insensitive" },
        };
      }

      // Cek apakah ada filter harga (minPrice atau maxPrice)
      if (minPrice !== undefined || maxPrice !== undefined) {
        // Inisialisasi object price untuk filter range harga
        whereClause.price = {};

        // Jika minPrice ada, set filter gte (greater than or equal)
        if (minPrice !== undefined) whereClause.price.gte = minPrice;

        // Jika maxPrice ada, set filter lte (less than or equal)
        if (maxPrice !== undefined) whereClause.price.lte = maxPrice;
      }

      // Execute query ke database menggunakan Prisma Client
      let products = await prisma.product.findMany({
        where: whereClause, // Gunakan whereClause yang sudah di-build di atas
        include: { category: true }, // Include data kategori (relasi) untuk setiap produk
        // Jangan limit di sini, kita akan sort by relevance dulu
        orderBy: { name: "asc" }, // Urutkan hasil berdasarkan nama produk secara ascending (A-Z)
      });

      // Cek jika tidak ada produk yang ditemukan
      if (products.length === 0) {
        // Return pesan user-friendly bahwa tidak ada hasil
        return "Tidak ditemukan produk yang sesuai dengan kriteria pencarian.";
      }

      // ============================================
      // RELEVANCE SCORING untuk ranking hasil
      // ============================================
      if (searchKeywords.length > 0) {
        // Calculate relevance score untuk setiap produk
        const scoredProducts = products.map((product) => {
          let score = 0;
          const productName = product.name.toLowerCase();
          const productDesc = (product.description || "").toLowerCase();

          // Score 1: Exact match dengan full query (highest priority)
          const fullQuery = searchKeywords.join(" ");
          if (productName === fullQuery)
            score += 1000; // Exact match name
          else if (productName.includes(fullQuery))
            score += 500; // Contains full query
          else if (productDesc.includes(fullQuery)) score += 100; // Full query in description

          // Score 2: Keyword matches (count how many keywords match)
          let matchedKeywords = 0;
          for (const keyword of searchKeywords) {
            // Name matches (higher weight)
            if (productName.includes(keyword)) {
              matchedKeywords++;
              score += 50; // Name contains keyword

              // Bonus: Keyword at start of name
              if (productName.startsWith(keyword)) score += 30;
            }
            // Description matches (lower weight)
            else if (productDesc.includes(keyword)) {
              matchedKeywords++;
              score += 10; // Description contains keyword
            }
          }

          // Score 3: Keyword coverage (berapa % keywords yang match)
          const coverageBonus = (matchedKeywords / searchKeywords.length) * 100;
          score += coverageBonus;

          // Score 4: Length penalty (prefer shorter names = more specific)
          // Avoid: "Kopi Susu Gula Aren Spesial" ketika search "kopi"
          const lengthPenalty = productName.split(" ").length * 5;
          score -= lengthPenalty;

          // ============================================
          // SEMANTIC SCORING - Understand intent
          // ============================================

          // Negative keywords detection (anti-patterns)
          // Jika user cari "pahit" tapi produk ada sweet indicators → PENALTY
          const bitterKeywords = ["pahit", "bitter", "black", "hitam"];
          const sweetIndicators = [
            "susu",
            "gula",
            "aren",
            "milk",
            "manis",
            "sweet",
            "mocha",
            "chocolate",
            "coklat",
            "vanilla",
            "caramel",
          ];
          const coldIndicators = ["dingin", "cold", "es", "ice", "iced"];
          const hotIndicators = ["panas", "hot", "hangat", "warm"];

          const hasBitterKeyword = searchKeywords.some((k) =>
            bitterKeywords.includes(k),
          );
          const hasColdKeyword = searchKeywords.some((k) =>
            coldIndicators.includes(k),
          );
          const hasHotKeyword = searchKeywords.some((k) =>
            hotIndicators.includes(k),
          );

          // Rule 1: Cari "pahit" tapi produk ada sweet indicators
          if (hasBitterKeyword) {
            const hasSweetIndicator = sweetIndicators.some(
              (indicator) =>
                productName.includes(indicator) ||
                productDesc.includes(indicator),
            );

            if (hasSweetIndicator) {
              score -= 500; // HEAVY PENALTY untuk produk manis ketika user cari pahit
            } else {
              // Boost untuk bitter coffee classics
              if (productName.includes("americano")) score += 300;
              else if (productName.includes("espresso")) score += 300;
              else if (productName.includes("long black")) score += 300;
              else if (productName.includes("black coffee")) score += 300;
            }
          }

          // Rule 2: Cari "dingin/cold" tapi produk tidak ada cold indicators
          if (hasColdKeyword) {
            const hasColdIndicator = coldIndicators.some((indicator) =>
              productName.includes(indicator),
            );

            if (!hasColdIndicator) {
              score -= 300; // Penalty untuk produk yang tidak ada indikator dingin
            } else {
              score += 200; // Boost untuk produk dengan cold indicator
            }
          }

          // Rule 3: Cari "panas/hot" tapi produk ada cold indicators
          if (hasHotKeyword) {
            const hasColdIndicator = coldIndicators.some((indicator) =>
              productName.includes(indicator),
            );

            if (hasColdIndicator) {
              score -= 300; // Penalty untuk produk dingin ketika user cari panas
            }
          }

          // Rule 4: Query "tanpa" detection (exclusion)
          // Example: "kopi tanpa susu" → exclude products with "susu"
          const excludeKeywords = [
            "tanpa",
            "tidak",
            "without",
            "no",
            "gak",
            "ga",
          ];
          for (let i = 0; i < searchKeywords.length - 1; i++) {
            if (excludeKeywords.includes(searchKeywords[i])) {
              const excludedTerm = searchKeywords[i + 1];
              if (
                productName.includes(excludedTerm) ||
                productDesc.includes(excludedTerm)
              ) {
                score -= 1000; // MASSIVE PENALTY - product should be excluded
              }
            }
          }

          return { ...product, relevanceScore: score };
        });

        // Sort by relevance score (descending = highest score first)
        products = scoredProducts.sort(
          (a, b) => b.relevanceScore - a.relevanceScore,
        );
      }

      // Apply limit setelah sorting
      const finalProducts = products.slice(0, limit ?? 10);

      // Format hasil query menjadi string yang mudah dibaca oleh AI dan user
      const formattedForAI = finalProducts
        .map(
          (product) =>
            // Format setiap produk dengan bullet point
            // Format: • Nama Produk (Kategori) - Harga (formatted) - Stok: X unit
            `• ${product.name} (${product.category.name}) - ${formatCurrency(
              product.price,
            )} - Stok: ${product.stock}`,
        )
        .join("\n"); // Gabungkan semua produk dengan newline

      // Return hasil final yang siap ditampilkan ke user
      return `Ditemukan ${finalProducts.length} produk yang paling relevan:\n${formattedForAI}`;
    } catch (error) {
      // Tangkap error apapun yang terjadi saat query database
      console.error("Error searching products:", error);

      // Return pesan error yang user-friendly (jangan expose error detail ke user)
      return "Terjadi kesalahan saat mencari produk.";
    }
  },
  // Konfigurasi metadata tool untuk LangChain
  {
    name: "search_products", // Nama tool yang akan dipanggil oleh AI
    description:
      // Deskripsi untuk AI agent - kapan tool ini harus digunakan
      "Cari produk berdasarkan keyword, kategori, atau range harga. Gunakan tool ini ketika user ingin mencari atau melihat produk.",
    schema: z.object({
      // Definisi schema input menggunakan Zod untuk validasi
      // Setiap parameter didefinisikan dengan tipe dan deskripsi
      query: z
        .string()
        .optional() // Parameter ini opsional (boleh tidak diisi)
        .describe("Kata kunci pencarian (nama atau deskripsi produk)"),
      category: z
        .string()
        .optional()
        .describe(
          "Filter berdasarkan kategori: Kopi, Non-Kopi, Makanan, atau Snack",
        ),
      minPrice: z.number().optional().describe("Harga minimum dalam Rupiah"),
      maxPrice: z.number().optional().describe("Harga maksimum dalam Rupiah"),
      limit: z
        .number()
        .optional()
        .describe("Jumlah maksimal hasil (default 10)"),
    }),
  },
);

// ============================================
// TOOL 2: CHECK STOCK
// ============================================
/**
 * TOOL: checkStockTool
 * FUNGSI: Mengecek stok produk tertentu atau melihat semua produk dengan stok menipis
 * USE CASE: Ketika user bertanya "Produk apa yang stoknya hampir habis?" atau "Cek stok Americano"
 *
 * INPUT PARAMETERS:
 * - productName: Nama produk yang ingin dicek (opsional)
 * - checkLowStock: Boolean untuk melihat produk dengan stok menipis (opsional)
 *
 * OUTPUT: String berisi informasi stok produk dengan status warna-warni
 */
export const checkStockTool = tool(
  // Fungsi async yang menerima parameter checkLowStock dan productName
  async ({ checkLowStock, productName }) => {
    try {
      // Cek apakah user ingin melihat semua produk dengan stok menipis
      if (checkLowStock) {
        // Query 1: Cari produk yang stoknya <= minStock (threshold ideal)
        // minStock adalah field di database yang menentukan batas minimum stok
        const lowStockProducts = await prisma.product.findMany({
          where: {
            isActive: true, // Hanya produk aktif
            stock: { lte: prisma.product.fields.minStock }, // stock <= minStock
          },
          include: { category: true }, // Include data kategori
          orderBy: { stock: "asc" }, // Urutkan dari stok terkecil (paling urgent)
        });

        // Fallback: Jika tidak ada produk dengan stok <= minStock,
        // cari produk dengan stok <= 10 sebagai threshold backup
        const products =
          lowStockProducts.length > 0
            ? lowStockProducts // Gunakan hasil query pertama jika ada
            : await prisma.product.findMany({
                // Jika tidak ada, query lagi dengan threshold 10
                where: {
                  isActive: true,
                  stock: { lte: 10 }, // Hardcoded threshold 10 unit
                },
                include: { category: true },
                orderBy: { stock: "asc" },
              });

        // Cek apakah ada produk dengan stok menipis
        if (products.length === 0) {
          // Jika tidak ada, return pesan positif
          return "✅ Semua produk stoknya aman! Tidak ada yang perlu di-restock.";
        }

        // Format hasil untuk ditampilkan ke user dengan status visual
        const formattedForAI = products
          .map((product) => {
            // Tentukan status stok berdasarkan jumlah
            let status = "✅ Aman"; // Default status untuk stok > 10

            // Status berdasarkan level kekritisan:
            if (product.stock === 0)
              status = "🔴 HABIS"; // Stok habis total
            else if (product.stock <= 5)
              status = "🟠 Sangat Menipis"; // Kritis (1-5 unit)
            else if (product.stock <= 10) status = "🟡 Perlu Diwaspadai"; // Warning (6-10 unit)

            // Format informasi produk dalam bentuk multi-line string
            // Gunakan \n untuk newline (akan di-render oleh AI)
            return `${product.name}:\\n Stok: ${
              product.stock
            } unit (${status})\nn Kategori: ${
              product.category.name
            }\nn Harga: $${formatCurrency(product.price)}`;
          })
          .join("\\n\\n"); // Pisahkan setiap produk dengan 2 baris kosong

        // Return formatted string ke AI agent
        return formattedForAI;
      }
    } catch (error) {
      // Tangkap error apapun yang terjadi
      console.error("Error checking stock:", error);

      // Return pesan error yang user-friendly
      return "Terjadi kesalahan saat memeriksa stok produk.";
    }
  },
  // Konfigurasi metadata tool untuk LangChain
  {
    name: "check_stock", // Nama tool
    description:
      // Deskripsi untuk AI - kapan tool ini harus digunakan
      "Cek stok produk tertentu atau lihat semua produk dengan stok menipis. Gunakan checkLowStock=true untuk melihat produk yang perlu restock.",
    schema: z.object({
      // Schema input dengan Zod
      productName: z
        .string()
        .optional()
        .describe("Nama produk yang ingin dicek stoknya"),
      checkLowStock: z
        .boolean()
        .optional()
        .describe("Set true untuk melihat semua produk dengan stok menipis"),
    }),
  },
);

// ============================================
// TOOL 3: CALCULATE DISCOUNT
// ============================================
/**
 * TOOL: calculateDiscountTool
 * FUNGSI: Menghitung total belanja dengan diskon (persen atau nominal) dan PPN
 * USE CASE: Ketika user bertanya "Hitungin diskon 10% untuk belanja 100rb" atau
 *           "Berapa total jika diskon 20ribu dari 150rb?"
 *
 * INPUT PARAMETERS:
 * - subTotal: Total belanja sebelum diskon (number, dalam Rupiah)
 * - discountType: Tipe diskon - "percentage" atau "nominal"
 * - discountValue: Nilai diskon - angka persen (misal 10) atau nominal (misal 20000)
 *
 * OUTPUT: String berisi kalkulasi lengkap dengan breakdown subtotal, diskon, pajak, dan total
 */
export const calculateDiscountTool = tool(
  // Fungsi async yang menerima parameter subTotal, discountType, dan discountValue
  async ({ discountValue, discountType, subTotal }) => {
    try {
      // Inisialisasi variabel untuk menyimpan nilai diskon dan deskripsi
      let discountAmount = 0; // Jumlah diskon dalam Rupiah
      let discountDescription = ""; // Deskripsi diskon untuk ditampilkan ke user

      // Cek tipe diskon yang digunakan
      if (discountType === "percentage") {
        // DISKON PERSENTASE

        // Validasi: Pastikan nilai persen tidak lebih dari 100%
        if (discountValue > 100) {
          return "Nilai diskon persen tidak boleh lebih dari 100%.";
        }

        // Hitung jumlah diskon: subtotal × (persen / 100)
        // Contoh: 100000 × (10 / 100) = 10000
        discountAmount = subTotal * (discountValue / 100);

        // Buat deskripsi diskon untuk user
        discountDescription = `${discountValue}% off`;
      } else {
        // DISKON NOMINAL (jumlah tetap dalam Rupiah)

        // Validasi: Pastikan diskon nominal tidak lebih besar dari total belanja
        // (tidak boleh negatif)
        if (discountValue > subTotal) {
          return "Nilai diskon nominal tidak boleh lebih besar dari total belanja.";
        }

        // Untuk diskon nominal, nilai diskon = nilai yang diinput langsung
        discountAmount = discountValue;

        // Format deskripsi dengan currency formatter
        discountDescription = formatCurrency(discountValue) + " off";
      }

      // Hitung total setelah diskon
      // Rumus: Subtotal - Diskon
      const totalAfterDiscount = subTotal - discountAmount;

      // Hitung pajak PPN 11% dari total setelah diskon
      // Rumus: Total Setelah Diskon × 0.11
      const tax = totalAfterDiscount * 0.11;

      // Hitung total final yang harus dibayar customer
      // Rumus: Total Setelah Diskon + Pajak
      const finalTotal = totalAfterDiscount + tax;

      // Return string dengan format yang rapi dan mudah dibaca
      // Gunakan template literal dengan multiple line
      return `📝 Kalkulasi:

              Subtotal: ${formatCurrency(subTotal)}
              Diskon (${discountDescription}): -${formatCurrency(
                discountAmount,
              )}
              ─────────────────
              Setelah Diskon: ${formatCurrency(totalAfterDiscount)}
              PPN 11%: +${formatCurrency(tax)}
              ─────────────────
              TOTAL: ${formatCurrency(finalTotal)}

              💡 Customer hemat ${formatCurrency(
                discountAmount,
              )} dengan diskon ini!`;
    } catch (error) {
      // Tangkap error apapun yang terjadi
      console.error("Error calculating discount:", error);

      // Return pesan error yang user-friendly
      return "Terjadi kesalahan saat menghitung diskon.";
    }
  },
  // Konfigurasi metadata tool untuk LangChain
  {
    name: "calculate_discount", // Nama tool
    description:
      // Deskripsi untuk AI - kapan tool ini harus digunakan
      "Hitung total belanja dengan diskon. Bisa diskon persen atau nominal.",
    schema: z.object({
      // Schema input dengan Zod untuk validasi parameter
      subTotal: z
        .number()
        .describe("Total belanja sebelum diskon dalam Rupiah"),
      discountType: z
        .enum(["percentage", "nominal"]) // Hanya 2 pilihan: percentage atau nominal
        .describe(
          "Tipe diskon: 'percentage' untuk diskon persen, 'nominal' untuk diskon nominal",
        ),
      discountValue: z
        .number()
        .describe(
          "Nilai diskon: jika persen, masukkan angka persen (misal 10 untuk 10%); jika nominal, masukkan jumlah dalam Rupiah",
        ),
    }),
  },
);

// ============================================
// TOOL 4: GET SALES SUMMARY
// ============================================
/**
 * TOOL: getSalesSummaryTool
 * FUNGSI: Mendapatkan ringkasan penjualan untuk periode tertentu
 * USE CASE: Ketika user bertanya "Gimana penjualan hari ini?" atau "Berapa omzet minggu ini?"
 *
 * INPUT PARAMETERS:
 * - period: Periode laporan - "today", "yesterday", "week", atau "month"
 *
 * OUTPUT: String berisi ringkasan penjualan dengan data:
 *         - Total revenue (omzet)
 *         - Jumlah transaksi
 *         - Rata-rata nilai transaksi
 *         - Total diskon yang diberikan
 *         - Produk terlaris (top 5)
 */
export const getSalesSummaryTool = tool(
  // Fungsi async yang menerima parameter period
  async ({ period }) => {
    try {
      // Inisialisasi variabel untuk menyimpan tanggal mulai dan label periode
      const now = new Date(); // Tanggal dan waktu saat ini
      let startDate: Date; // Tanggal mulai periode (akan dihitung berdasarkan period)
      let periodLabel: string; // Label periode untuk ditampilkan (misal: "Hari Ini", "7 Hari Terakhir")

      // Switch case untuk menentukan startDate berdasarkan period yang dipilih
      switch (period) {
        case "today":
          // PERIODE: HARI INI
          // Set startDate ke awal hari ini (00:00:00)
          startDate = new Date(
            now.getFullYear(), // Tahun sekarang
            now.getMonth(), // Bulan sekarang (0-11)
            now.getDate(), // Tanggal sekarang
          );
          periodLabel = "Hari Ini"; // Label untuk user
          break;

        case "yesterday":
          // PERIODE: KEMARIN
          // Set startDate ke awal hari kemarin (00:00:00)
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 1, // Kurangi 1 hari dari tanggal sekarang
          );

          // Set endYesterday ke awal hari ini (00:00:00)
          // Digunakan sebagai batas atas query (untuk range kemarin saja)
          const endYesterday = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          periodLabel = "Kemarin";

          // Ambil data penjualan kemarin dengan agregasi
          const salesYesterdayData = await prisma.transaction.aggregate({
            where: {
              // Filter transaksi antara startDate (kemarin 00:00) dan endYesterday (hari ini 00:00)
              createdAt: { gte: startDate, lt: endYesterday },
              status: "completed", // Hanya transaksi yang completed
            },
            _sum: {
              // Jumlahkan field-field ini dari semua transaksi yang match
              total: true, // Total revenue
              discountAmount: true, // Total diskon yang diberikan
            },
            _count: true, // Hitung jumlah transaksi
            _avg: {
              total: true, // Rata-rata nilai transaksi
            },
          });

          // Ambil top 5 produk terlaris kemarin
          // getTopProducts adalah fungsi utility yang sudah didefinisikan di utils.ts
          const topProductsYesterday = await getTopProducts(
            startDate, // Tanggal mulai
            endYesterday, // Tanggal akhir
            5, // Limit top 5
          );

          // Format data menjadi string yang user-friendly menggunakan utility function
          // Return langsung hasil untuk period "yesterday"
          return formatSalesSummary(
            periodLabel,
            salesYesterdayData,
            topProductsYesterday,
          );

        case "week":
          // PERIODE: 7 HARI TERAKHIR
          // Set startDate ke 7 hari yang lalu dari sekarang
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 7, // Kurangi 7 hari
          );
          periodLabel = "7 Hari Terakhir";
          break;

        case "month":
          // PERIODE: 30 HARI TERAKHIR
          // Set startDate ke 30 hari yang lalu (atau 1 bulan ke belakang)
          startDate = new Date(
            now.getFullYear(),
            now.getMonth() - 1, // Kurangi 1 bulan
            now.getDate(),
          );
          periodLabel = "30 Hari Terakhir";
          break;

        default:
          // DEFAULT: Jika period tidak valid, gunakan "today" sebagai fallback
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          periodLabel = "Hari Ini";
      }

      // Query agregasi untuk periode selain "yesterday"
      // (karena yesterday sudah di-return di dalam switch case)
      const salesData = await prisma.transaction.aggregate({
        where: {
          createdAt: { gte: startDate }, // Filter transaksi >= startDate
          status: "completed", // Hanya transaksi completed
        },
        _sum: {
          // Jumlahkan total revenue dan total diskon
          total: true,
          discountAmount: true,
        },
        _count: true, // Hitung jumlah transaksi
        _avg: {
          total: true, // Rata-rata nilai transaksi
        },
      });

      // Ambil top 5 produk terlaris untuk periode ini
      const topProducts = await getTopProducts(startDate, now, 5);

      // Format dan return hasil summary menggunakan utility function
      return formatSalesSummary(periodLabel, salesData, topProducts);
    } catch (error) {
      // Tangkap error apapun yang terjadi
      console.error("Sales summary tool error:", error);

      // Return pesan error yang user-friendly
      return "Terjadi kesalahan saat mengambil data penjualan.";
    }
  },
  // Konfigurasi metadata tool untuk LangChain
  {
    name: "get_sales_summary", // Nama tool
    description:
      // Deskripsi untuk AI - kapan tool ini harus digunakan
      "Dapatkan ringkasan penjualan untuk periode tertentu. Termasuk total revenue, jumlah transaksi, dan produk terlaris.",
    schema: z.object({
      // Schema input dengan Zod
      period: z
        .enum(["today", "yesterday", "week", "month"]) // 4 pilihan periode
        .describe("Periode laporan: today, yesterday, week, atau month"),
    }),
  },
);

// ============================================
// TOOL 5: GET PAYMENT METHODS BREAKDOWN
// ============================================
/**
 * TOOL: getPaymentMethodsBreakdownTool
 * FUNGSI: Melihat breakdown transaksi berdasarkan metode pembayaran
 * USE CASE: Ketika user bertanya "Metode pembayaran apa yang paling banyak dipakai?" atau
 *           "Berapa transaksi QRIS hari ini?"
 *
 * INPUT PARAMETERS:
 * - period: Periode laporan - "today", "week", atau "month"
 *
 * OUTPUT: String berisi breakdown transaksi per metode pembayaran:
 *         - Cash (tunai)
 *         - QRIS
 *         - Card (kartu debit/kredit)
 *         - Transfer
 *         Termasuk jumlah transaksi dan total revenue per metode
 */
export const getPaymentMethodsBreakdownTool = tool(
  // Fungsi async yang menerima parameter period
  async ({ period }) => {
    try {
      // Inisialisasi variabel untuk tanggal mulai periode
      const now = new Date(); // Tanggal dan waktu saat ini
      let startDate: Date; // Tanggal mulai periode

      // Switch case untuk menentukan startDate berdasarkan period
      switch (period) {
        case "today":
          // PERIODE: HARI INI
          // Set startDate ke awal hari ini (00:00:00)
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
          break;

        case "week":
          // PERIODE: 7 HARI TERAKHIR
          // Set startDate ke 7 hari yang lalu
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() - 7,
          );
          break;

        case "month":
          // PERIODE: 30 HARI TERAKHIR (1 bulan)
          // Set startDate ke 30 hari yang lalu
          startDate = new Date(
            now.getFullYear(),
            now.getMonth() - 1, // Kurangi 1 bulan
            now.getDate(),
          );
          break;

        default:
          // DEFAULT: Jika period tidak valid, gunakan "today"
          startDate = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
          );
      }

      // Query database dengan groupBy untuk mengelompokkan transaksi per metode pembayaran
      // groupBy mirip dengan SQL GROUP BY - mengelompokkan data berdasarkan field tertentu
      const breakdown = await prisma.transaction.groupBy({
        by: ["paymentMethod"], // Kelompokkan berdasarkan field paymentMethod
        where: {
          createdAt: { gte: startDate }, // Filter transaksi >= startDate
          status: "completed", // Hanya transaksi yang completed
        },
        _count: true, // Hitung jumlah transaksi untuk setiap metode pembayaran
        _sum: {
          total: true, // Jumlahkan total revenue untuk setiap metode pembayaran
        },
      });

      // Cek apakah ada data transaksi untuk periode yang dipilih
      if (breakdown.length === 0)
        return "Tidak ada data transaksi untuk periode yang dipilih.";

      // Hitung total keseluruhan dari semua metode pembayaran
      // Gunakan reduce untuk iterasi array dan akumulasi nilai
      const total = breakdown.reduce(
        (sum, item) => sum + (item._sum.total || 0), // Tambahkan total setiap item ke sum
        0, // Nilai awal sum = 0
      );

      // Hitung total jumlah transaksi keseluruhan
      const totalCount = breakdown.reduce((sum, item) => sum + item._count, 0);

      // Object mapping untuk label metode pembayaran dengan emoji
      // Membuat tampilan lebih user-friendly dan visual
      const methodLabels: Record<string, string> = {
        cash: "💵 Tunai", // Uang tunai
        qris: "📱 QRIS", // QRIS (Quick Response Indonesian Standard)
        card: "💳 Kartu", // Kartu debit/kredit
        transfer: "🏦 Transfer", // Transfer bank
      };

      // Inisialisasi string response dengan header
      let response = `💳 BREAKDOWN METODE PEMBAYARAN\\n\\n`;

      // Iterasi breakdown dan format setiap metode pembayaran
      breakdown
        .sort((a, b) => (b._sum.total || 0) - (a._sum.total || 0)) // Sort descending by total revenue (terbesar ke terkecil)
        .forEach((item) => {
          // Hitung persentase dari total revenue
          // Rumus: (revenue metode ini / total revenue) × 100
          const percentage = (((item._sum.total || 0) / total) * 100).toFixed(
            1, // 1 angka desima
          );

          // Ambil label dari methodLabels, fallback ke paymentMethod jika tidak ada
          const label = methodLabels[item.paymentMethod] || item.paymentMethod;

          // Append informasi metode pembayaran ke response
          response += `${label}:\\n`; // Nama metode dengan emoji
          response += `  • ${item._count} transaksi (${percentage}%)\\n`; // Jumlah transaksi dan persentase
          response += `  • ${formatCurrency(item._sum.total || 0)}\\n\\n`; // Total revenue
        });

      // Append total keseluruhan di akhir response
      response += `📊 Total: ${totalCount} transaksi = ${formatCurrency(
        total,
      )}`;

      // Return formatted response
      return response;
    } catch (error) {
      // Tangkap error apapun yang terjadi
      console.error("Payment methods breakdown tool error:", error);

      // Return pesan error yang user-friendly
      return "Terjadi kesalahan saat mengambil data metode pembayaran.";
    }
  },
  // Konfigurasi metadata tool untuk LangChain
  {
    name: "get_payment_methods_breakdown", // Nama tool
    description:
      // Deskripsi untuk AI - kapan tool ini harus digunakan
      "Lihat breakdown transaksi berdasarkan metode pembayaran (cash, QRIS, kartu, transfer).",
    schema: z.object({
      // Schema input dengan Zod
      period: z
        .enum(["today", "week", "month"]) // 3 pilihan periode (tidak ada yesterday)
        .describe("Periode: today, week, atau month"),
    }),
  },
);

// ============================================
// EXPORT ALL TOOLS
// ============================================
/**
 * ARRAY EXPORT: allPosTools
 * DESKRIPSI: Array yang berisi semua tool yang tersedia untuk AI Agent
 *
 * CARA PENGGUNAAN:
 * Import array ini di file langchain.ts atau file lain yang membuat AI Agent.
 * Kemudian pass array ini ke konfigurasi agent sebagai tools yang available.
 *
 * CONTOH:
 * import { allPosTools } from './tools';
 *
 * const agent = createReactAgent({
 *   llm: model,
 *   tools: allPosTools, // <-- Pass semua tools di sini
 *   prompt: systemPrompt,
 * });
 *
 * AI Agent akan secara otomatis memilih tool yang tepat berdasarkan:
 * 1. Nama tool (name property)
 * 2. Deskripsi tool (description property)
 * 3. Schema input yang diperlukan (schema property)
 */
export const allPosTools = [
  searchProductsTool, // Tool untuk mencari produk
  checkStockTool, // Tool untuk mengecek stok
  calculateDiscountTool, // Tool untuk menghitung diskon
  getSalesSummaryTool, // Tool untuk mendapatkan ringkasan penjualan
  getPaymentMethodsBreakdownTool, // Tool untuk melihat breakdown metode pembayaran
];

/**
 * CATATAN PENTING UNTUK DEVELOPER:
 *
 * 1. MENAMBAH TOOL BARU:
 *    - Buat tool dengan format yang sama (gunakan fungsi 'tool' dari LangChain)
 *    - Definisikan schema input dengan Zod
 *    - Tambahkan ke array allPosTools
 *
 * 2. ERROR HANDLING:
 *    - Semua tool sudah dilengkapi try-catch
 *    - Error detail hanya di-log ke console (untuk debugging)
 *    - Error message ke user harus user-friendly (jangan expose error detail)
 *
 * 3. RETURN VALUE:
 *    - Semua tool harus return string (bukan object/array)
 *    - Format string harus human-readable karena akan ditampilkan ke user
 *    - Gunakan emoji dan formatting untuk membuat tampilan lebih menarik
 *
 * 4. DATABASE QUERY:
 *    - Gunakan Prisma Client (import dari '../db')
 *    - Selalu filter status: "completed" untuk data transaksi
 *    - Selalu filter isActive: true untuk data produk
 *
 * 5. TESTING:
 *    - Test setiap tool secara individual sebelum deploy
 *    - Test dengan berbagai kombinasi parameter (termasuk parameter opsional)
 *    - Test error case (invalid input, database error, dll)
 */
