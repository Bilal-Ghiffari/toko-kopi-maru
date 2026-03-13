export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  sku: string;
  categoryId: string;
  category: {
    id: string;
    name: string;
  };
}

export interface CartItem extends Product {
  quantity: number;
}

// Definisi tipe untuk transaksi penjualan
export interface Transaction {
  id: string;
  invoiceNumber: string;
  subTotal: number;
  discountAmount: number;
  taxAmount: number;
  total: number;
  paymentMethod: string;
  amountPaid: number; // Jumlah uang yang dibayarkan oleh pelanggan
  changeAmount: number; // Jumlah uang kembalian yang diberikan kepada pelanggan
  status: string;
  items: TransactionItem[];
  createdAt: Date;
}

// Definisi tipe untuk item dalam transaksi penjualan
export interface TransactionItem {
  id: string;
  productId: string;
  productName: string;
  productSku: string; // SKU produk = Stock Keeping Unit
  quantity: number;
  unitPrice: number;
  subTotal: number;
}
