import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Health check API route
export async function GET() {
  try {
    const productCount = await prisma.product.count();
    const categoryCount = await prisma.category.count();
    const transactionCount = await prisma.transaction.count();

    return NextResponse.json({
      status: "ok",
      database: "connected",
      counts: {
        products: productCount,
        categories: categoryCount,
        transactions: transactionCount,
      },
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        database: "disconnected",
        message: "Database connection failed",
      },
      { status: 500 }
    );
  }
}
