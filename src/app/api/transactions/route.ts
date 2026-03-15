/**
 * API Route untuk mengelola Transaksi Kasir
 *
 * Endpoint ini menangani:
 * - POST: Membuat transaksi baru dan mengurangi stok produk
 * - GET: Mengambil daftar transaksi dengan pagination
 */

import { prisma } from "@/lib/db";
import { generateInvoiceNumber } from "@/lib/utils";
import { NextRequest, NextResponse } from "next/server";

// Disable caching untuk route ini agar data selalu fresh
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * POST /api/transactions
 *
 * Membuat transaksi baru dengan langkah:
 * 1. Validasi data items yang diterima
 * 2. Generate nomor invoice otomatis
 * 3. Menyimpan transaksi dan item-itemnya ke database
 * 4. Mengurangi stok produk sesuai quantity yang dibeli
 *
 * @param req - NextRequest berisi data transaksi
 * @returns JSON response dengan data transaksi yang berhasil dibuat
 *
 * @example
 * Request Body:
 * {
 *   "items": [
 *     {
 *       "productId": "uuid",
 *       "productName": "Nama Produk",
 *       "productSku": "SKU123",
 *       "quantity": 2,
 *       "unitPrice": 10000,
 *       "subtotal": 20000,
 *       "discountAmount": 0
 *     }
 *   ],
 *   "subtotal": 20000,
 *   "discountAmount": 0,
 *   "discountPercent": 0,
 *   "taxAmount": 2000,
 *   "taxPercent": 10,
 *   "total": 22000,
 *   "paymentMethod": "cash",
 *   "amountPaid": 25000,
 *   "changeAmount": 3000,
 *   "cashierName": "Kasir 1",
 *   "notes": "Catatan opsional"
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Ekstrak data dari request body
    // Beberapa field memiliki default value untuk menghindari undefined
    const {
      items, // Array produk yang dibeli
      subtotal, // Total harga sebelum diskon dan pajak
      discountAmount = 0, // Nominal diskon (default: 0)
      discountPercent = 0, // Persentase diskon (default: 0)
      taxAmount, // Nominal pajak
      taxPercent, // Persentase pajak
      total, // Total akhir yang harus dibayar
      paymentMethod, // Metode pembayaran (cash, debit, credit, dll)
      amountPaid, // Jumlah uang yang dibayarkan
      changeAmount = 0, // Kembalian (default: 0)
      cashierName = "Kasir", // Nama kasir (default: "Kasir")
      notes, // Catatan tambahan (opsional)
    } = body;

    // Validasi: Pastikan items tidak kosong
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Items are required" },
        { status: 400 },
      );
    }

    // ============================================
    // VALIDASI: Check semua productId valid & stock tersedia
    // ============================================
    interface TransactionItem {
      productId: string;
      productName: string;
      productSku: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      discountAmount?: number;
    }
    const productIds = items.map((item: TransactionItem) => item.productId);

    // Query semua produk yang dibutuhkan
    const existingProducts = await prisma.product.findMany({
      where: {
        id: { in: productIds },
      },
      select: {
        id: true,
        name: true,
        stock: true,
        isActive: true,
      },
    });

    // Buat Map untuk quick lookup
    const productMap = new Map(existingProducts.map((p) => [p.id, p]));

    // 1. Check produk yang tidak ditemukan
    const missingProductIds = productIds.filter((id) => !productMap.has(id));

    if (missingProductIds.length > 0) {
      console.error("[Transaction] Produk tidak ditemukan:", missingProductIds);
      return NextResponse.json(
        {
          error: "Produk tidak ditemukan",
          message: `${missingProductIds.length} produk tidak ada di database. Mungkin produk sudah dihapus.`,
          missingProductIds: missingProductIds,
        },
        { status: 404 },
      );
    }

    // 2. Check produk yang tidak aktif
    const inactiveProducts = items
      .map((item: TransactionItem) => ({
        ...item,
        product: productMap.get(item.productId),
      }))
      .filter((item) => !item.product?.isActive);

    if (inactiveProducts.length > 0) {
      const inactiveNames = inactiveProducts.map(
        (item) => item.product?.name || "Unknown",
      );
      console.error("[Transaction] Produk tidak aktif:", inactiveNames);
      return NextResponse.json(
        {
          error: "Produk tidak aktif",
          message: `Produk berikut sudah tidak aktif dan tidak bisa dijual: ${inactiveNames.join(", ")}`,
          inactiveProducts: inactiveNames,
        },
        { status: 400 },
      );
    }

    // 3. Check stok untuk setiap item
    for (const item of items) {
      const product = productMap.get(item.productId);

      if (product && product.stock < item.quantity) {
        console.error(
          `[Transaction] Stok tidak cukup - ${product.name}: tersedia ${product.stock}, diminta ${item.quantity}`,
        );
        return NextResponse.json(
          {
            error: "Stok tidak mencukupi",
            message: `Produk "${product.name}" hanya memiliki ${product.stock} unit tersedia, tetapi Anda mencoba membeli ${item.quantity} unit.`,
            productId: item.productId,
            productName: product.name,
            availableStock: product.stock,
            requestedQuantity: item.quantity,
            shortfall: item.quantity - product.stock,
          },
          { status: 400 },
        );
      }
    }

    console.log(
      "[Transaction] Validasi berhasil - semua produk tersedia dengan stok cukup",
    );

    // Generate nomor invoice unik untuk transaksi ini
    // Format biasanya: INV-YYYYMMDD-XXXX
    const invoiceNumber = generateInvoiceNumber();

    // Gunakan Prisma transaction untuk memastikan atomicity
    // Jika salah satu operasi gagal, semua akan di-rollback
    const transaction = await prisma.$transaction(async (tx) => {
      // STEP 1: Buat record transaksi baru beserta item-itemnya
      // Relasi items menggunakan nested create untuk efisiensi
      const newTransaction = await tx.transaction.create({
        data: {
          invoiceNumber,
          subtotal,
          discountAmount,
          discountPercent,
          taxAmount,
          taxPercent,
          total,
          paymentMethod,
          amountPaid,
          changeAmount,
          status: "completed", // Status langsung completed karena pembayaran sudah selesai
          cashierName,
          notes,
          // Nested create: Membuat semua TransactionItem sekaligus
          items: {
            create: items.map((item: TransactionItem) => ({
              productId: item.productId, // ID produk untuk relasi
              productName: item.productName, // Snapshot nama produk saat transaksi
              productSku: item.productSku, // Snapshot SKU produk
              quantity: item.quantity, // Jumlah yang dibeli
              unitPrice: item.unitPrice, // Harga per unit saat transaksi
              subtotal: item.subtotal, // Total harga item (quantity × unitPrice)
              discountAmount: item.discountAmount || 0, // Diskon per item
            })),
          },
        },
        // Include items agar response langsung berisi data lengkap
        include: {
          items: true,
        },
      });

      // STEP 2: Kurangi stok produk untuk setiap item yang dibeli
      // Ini penting untuk inventory management
      for (const item of items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: {
              decrement: item.quantity, // Kurangi stok sebanyak quantity
            },
          },
        });
      }

      // Return transaksi yang baru dibuat
      return newTransaction;
    });

    // Response sukses dengan data transaksi lengkap
    return NextResponse.json({
      success: true,
      transaction,
    });
  } catch (error) {
    // Log error untuk debugging
    // Log error untuk debugging
    console.error("Transaction error:", error);

    // Response error 500 jika terjadi kesalahan server
    return NextResponse.json(
      { error: "Failed to create transaction" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/transactions
 *
 * Mengambil daftar transaksi dengan fitur pagination.
 * Transaksi diurutkan dari yang terbaru (descending by createdAt).
 *
 * @param req - NextRequest dengan query params untuk pagination
 * @returns JSON response berisi array transaksi dan metadata pagination
 *
 * @example
 * GET /api/transactions?limit=20&offset=0
 *
 * Response:
 * {
 *   "transactions": [...],
 *   "total": 150,
 *   "limit": 20,
 *   "offset": 0
 * }
 *
 * Query Parameters:
 * - limit: Jumlah data per halaman (default: 20)
 * - offset: Offset untuk pagination (default: 0) = halaman pertama
 */
export async function GET(req: NextRequest) {
  try {
    // Ambil query parameters untuk pagination
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20"); // Default 20 item per halaman
    const offset = parseInt(searchParams.get("offset") || "0"); // Default mulai dari 0

    // Query database untuk mendapatkan transaksi
    const transactions = await prisma.transaction.findMany({
      include: {
        items: {
          orderBy: { createdAt: "asc" }, // Item diurutkan ascending
        },
      },
      orderBy: [
        { createdAt: "desc" }, // Primary: Urutkan dari yang terbaru
        { id: "desc" }, // Secondary: Jika createdAt sama, urutkan by ID
      ],
      take: limit, // Batasi jumlah data sesuai limit
      skip: offset, // Skip sejumlah offset untuk pagination
    });

    // Hitung total semua transaksi untuk keperluan pagination UI
    const total = await prisma.transaction.count();

    // Response dengan data transaksi dan metadata pagination
    return NextResponse.json(
      {
        transactions, // Array data transaksi
        total, // Total keseluruhan transaksi
        limit, // Limit yang digunakan
        offset, // Offset yang digunakan
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      },
    );
  } catch (error) {
    // Log error untuk debugging
    console.error("Get transactions error:", error);

    // Response error 500 jika terjadi kesalahan server
    return NextResponse.json(
      { error: "Failed to get transactions" },
      { status: 500 },
    );
  }
}
