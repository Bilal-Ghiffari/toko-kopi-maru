// import { config } from "dotenv";
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma";

// // Load environment variables
// config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString }); // Create a new PostgreSQL connection pool
const adapter = new PrismaPg(pool); // Create a new PostgreSQL connection pool adapter
const prisma = new PrismaClient({ adapter }); // Create a new Prisma Client instance

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data
  await prisma.transactionItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();

  // ============================================
  // CATEGORIES
  // ============================================
  const categories = await Promise.all([
    prisma.category.create({
      data: {
        name: "Kopi",
        description: "Berbagai jenis minuman kopi",
        icon: "☕",
      },
    }),
    prisma.category.create({
      data: {
        name: "Non-Kopi",
        description: "Minuman tanpa kopi",
        icon: "🧋",
      },
    }),
    prisma.category.create({
      data: {
        name: "Makanan",
        description: "Makanan ringan dan berat",
        icon: "🍽️",
      },
    }),
    prisma.category.create({
      data: {
        name: "Snack",
        description: "Cemilan dan dessert",
        icon: "🍪",
      },
    }),
  ]);

  const [kopi, nonKopi, makanan, snack] = categories;

  // ============================================
  // PRODUCTS
  // ============================================
  const products = [
    // KOPI
    {
      name: "Espresso",
      description:
        "Kopi hitam pekat, strong, tanpa susu. Cocok untuk pecinta kopi murni.",
      price: 18000,
      cost: 5000,
      stock: 100,
      sku: "KPI-001",
      categoryId: kopi.id,
    },
    {
      name: "Americano",
      description:
        "Espresso dengan air panas. Rasa kopi yang lebih ringan tapi tetap bold. Tanpa susu.",
      price: 22000,
      cost: 5500,
      stock: 100,
      sku: "KPI-002",
      categoryId: kopi.id,
    },
    {
      name: "Kopi Susu Gula Aren",
      description:
        "Kopi susu kekinian dengan gula aren. Manis, creamy, favorit anak muda.",
      price: 24000,
      cost: 7000,
      stock: 80,
      sku: "KPI-003",
      categoryId: kopi.id,
    },
    {
      name: "Cappuccino",
      description: "Espresso dengan susu dan foam tebal. Creamy dan lembut.",
      price: 28000,
      cost: 8000,
      stock: 75,
      sku: "KPI-004",
      categoryId: kopi.id,
    },
    {
      name: "Cafe Latte",
      description:
        "Espresso dengan banyak susu steamed. Lebih milky dari cappuccino.",
      price: 28000,
      cost: 8000,
      stock: 70,
      sku: "KPI-005",
      categoryId: kopi.id,
    },
    {
      name: "Mocha",
      description:
        "Kopi dengan coklat dan susu. Manis, cocok untuk yang gak terlalu suka pahit.",
      price: 32000,
      cost: 10000,
      stock: 60,
      sku: "KPI-006",
      categoryId: kopi.id,
    },
    {
      name: "Affogato",
      description:
        "Espresso panas dituang ke ice cream vanilla. Dessert coffee.",
      price: 35000,
      cost: 12000,
      stock: 40,
      sku: "KPI-007",
      categoryId: kopi.id,
    },
    {
      name: "Cold Brew",
      description:
        "Kopi yang diseduh dingin 12 jam. Smooth, less acidic, refreshing.",
      price: 28000,
      cost: 6000,
      stock: 50,
      sku: "KPI-008",
      categoryId: kopi.id,
    },
    {
      name: "Es Kopi Susu",
      description: "Kopi susu dingin klasik. Simple tapi nagih.",
      price: 20000,
      cost: 6000,
      stock: 100,
      sku: "KPI-009",
      categoryId: kopi.id,
    },
    {
      name: "Vietnamese Coffee",
      description: "Kopi dengan susu kental manis. Strong dan sangat manis.",
      price: 25000,
      cost: 7000,
      stock: 45,
      sku: "KPI-010",
      categoryId: kopi.id,
    },

    // NON-KOPI
    {
      name: "Matcha Latte",
      description:
        "Green tea Jepang dengan susu. Creamy, earthy, sedikit pahit alami.",
      price: 30000,
      cost: 10000,
      stock: 60,
      sku: "NKP-001",
      categoryId: nonKopi.id,
    },
    {
      name: "Taro Latte",
      description: "Minuman taro ungu dengan susu. Manis, creamy, wangi.",
      price: 28000,
      cost: 9000,
      stock: 55,
      sku: "NKP-002",
      categoryId: nonKopi.id,
    },
    {
      name: "Coklat Panas",
      description: "Hot chocolate klasik. Rich, manis, comfort drink.",
      price: 25000,
      cost: 8000,
      stock: 70,
      sku: "NKP-003",
      categoryId: nonKopi.id,
    },
    {
      name: "Es Coklat",
      description: "Coklat dingin dengan susu. Refreshing dan manis.",
      price: 25000,
      cost: 8000,
      stock: 75,
      sku: "NKP-004",
      categoryId: nonKopi.id,
    },
    {
      name: "Es Teh Manis",
      description: "Teh manis dingin klasik Indonesia. Murah meriah.",
      price: 10000,
      cost: 2000,
      stock: 200,
      sku: "NKP-005",
      categoryId: nonKopi.id,
    },
    {
      name: "Lemon Tea",
      description: "Teh dengan perasan lemon segar. Asam manis segar.",
      price: 15000,
      cost: 4000,
      stock: 80,
      sku: "NKP-006",
      categoryId: nonKopi.id,
    },
    {
      name: "Thai Tea",
      description: "Teh ala Thailand dengan susu. Orange color, manis creamy.",
      price: 22000,
      cost: 6000,
      stock: 65,
      sku: "NKP-007",
      categoryId: nonKopi.id,
    },
    {
      name: "Strawberry Smoothie",
      description: "Smoothie strawberry segar dengan yogurt. Fruity dan sehat.",
      price: 30000,
      cost: 12000,
      stock: 40,
      sku: "NKP-008",
      categoryId: nonKopi.id,
    },
    {
      name: "Mango Smoothie",
      description: "Smoothie mangga manis. Tropical vibes.",
      price: 30000,
      cost: 12000,
      stock: 35,
      sku: "NKP-009",
      categoryId: nonKopi.id,
    },
    {
      name: "Air Mineral",
      description: "Air putih kemasan. Untuk yang mau sehat.",
      price: 8000,
      cost: 3000,
      stock: 150,
      sku: "NKP-010",
      categoryId: nonKopi.id,
    },

    // MAKANAN
    {
      name: "Nasi Goreng Spesial",
      description:
        "Nasi goreng dengan telur, ayam, dan sayuran. Porsi besar, mengenyangkan.",
      price: 35000,
      cost: 15000,
      stock: 30,
      sku: "MKN-001",
      categoryId: makanan.id,
    },
    {
      name: "Mie Goreng",
      description: "Mie goreng dengan telur dan sayuran. Comfort food.",
      price: 30000,
      cost: 12000,
      stock: 35,
      sku: "MKN-002",
      categoryId: makanan.id,
    },
    {
      name: "Sandwich Tuna",
      description: "Roti dengan isian tuna mayo, sayuran segar. Light meal.",
      price: 32000,
      cost: 14000,
      stock: 20,
      sku: "MKN-003",
      categoryId: makanan.id,
    },
    {
      name: "Croissant",
      description: "Pastry butter klasik Prancis. Flaky dan buttery.",
      price: 25000,
      cost: 10000,
      stock: 25,
      sku: "MKN-004",
      categoryId: makanan.id,
    },
    {
      name: "Roti Bakar Coklat Keju",
      description: "Roti bakar dengan topping coklat dan keju. Manis gurih.",
      price: 22000,
      cost: 8000,
      stock: 30,
      sku: "MKN-005",
      categoryId: makanan.id,
    },
    {
      name: "French Fries",
      description: "Kentang goreng crispy. Snack klasik.",
      price: 20000,
      cost: 7000,
      stock: 40,
      sku: "MKN-006",
      categoryId: makanan.id,
    },
    {
      name: "Chicken Wings",
      description: "6 pcs sayap ayam goreng dengan saus. Spicy atau BBQ.",
      price: 38000,
      cost: 18000,
      stock: 25,
      sku: "MKN-007",
      categoryId: makanan.id,
    },

    // SNACK
    {
      name: "Brownies",
      description: "Brownies coklat fudgy. Rich dan decadent.",
      price: 18000,
      cost: 6000,
      stock: 30,
      sku: "SNK-001",
      categoryId: snack.id,
    },
    {
      name: "Cheesecake",
      description: "Cheesecake creamy dengan base biskuit. Lembut.",
      price: 28000,
      cost: 12000,
      stock: 15,
      sku: "SNK-002",
      categoryId: snack.id,
    },
    {
      name: "Cookies",
      description: "Cookies chocolate chip. Crunchy di luar, chewy di dalam.",
      price: 15000,
      cost: 5000,
      stock: 50,
      sku: "SNK-003",
      categoryId: snack.id,
    },
    {
      name: "Pisang Goreng",
      description: "Pisang goreng crispy dengan topping keju/coklat.",
      price: 18000,
      cost: 6000,
      stock: 25,
      sku: "SNK-004",
      categoryId: snack.id,
    },
    {
      name: "Donat",
      description: "Donat empuk dengan berbagai topping.",
      price: 12000,
      cost: 4000,
      stock: 40,
      sku: "SNK-005",
      categoryId: snack.id,
    },
  ];

  for (const product of products) {
    await prisma.product.create({ data: product });
  }

  console.log(`✅ Created ${categories.length} categories`);
  console.log(`✅ Created ${products.length} products`);

  // ============================================
  // SAMPLE TRANSACTIONS (untuk testing analytics)
  // ============================================
  const allProducts = await prisma.product.findMany();

  // Generate 50 sample transactions untuk 7 hari terakhir
  for (let i = 0; i < 50; i++) {
    const daysAgo = Math.floor(Math.random() * 7);
    const hoursAgo = Math.floor(Math.random() * 12) + 8; // 8 AM - 8 PM

    const transactionDate = new Date();
    transactionDate.setDate(transactionDate.getDate() - daysAgo);
    transactionDate.setHours(hoursAgo, Math.floor(Math.random() * 60), 0, 0);

    // Random 1-5 items per transaction
    const itemCount = Math.floor(Math.random() * 5) + 1;
    const selectedProducts = allProducts
      .sort(() => Math.random() - 0.5)
      .slice(0, itemCount);

    const items = selectedProducts.map((product) => ({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      quantity: Math.floor(Math.random() * 3) + 1,
      unitPrice: product.price,
      subtotal: 0, // akan dihitung
      discountAmount: 0,
    }));

    // Calculate subtotals
    items.forEach((item) => {
      item.subtotal = item.unitPrice * item.quantity;
    });

    const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
    const taxAmount = subtotal * 0.1;
    const total = subtotal + taxAmount;

    const paymentMethods = ["cash", "qris", "card", "transfer"];
    const paymentMethod =
      paymentMethods[Math.floor(Math.random() * paymentMethods.length)];

    // Generate invoice number
    const dateStr = transactionDate
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");
    const invoiceNumber = `INV-${dateStr}-${String(i + 1).padStart(3, "0")}`;

    await prisma.transaction.create({
      data: {
        invoiceNumber,
        subtotal,
        taxAmount,
        taxPercent: 10,
        total,
        paymentMethod,
        amountPaid:
          paymentMethod === "cash"
            ? Math.ceil(total / 10000) * 10000 // Pembulatan ke atas
            : total,
        changeAmount:
          paymentMethod === "cash"
            ? Math.ceil(total / 10000) * 10000 - total
            : 0,
        status: "completed",
        cashierName: ["Budi", "Ani", "Dewi"][Math.floor(Math.random() * 3)],
        createdAt: transactionDate,
        items: {
          create: items,
        },
      },
    });
  }

  console.log(`✅ Created 50 sample transactions`);
  console.log("🎉 Seeding completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
