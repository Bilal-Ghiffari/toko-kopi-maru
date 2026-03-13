// Menandakan komponen ini hanya berjalan di client-side (bukan server-side)
"use client";

// Import fungsi utility untuk format mata uang
import { cn, formatCurrency } from "@/lib/utils";
// Import icon-icon dari library lucide-react
import {
  Banknote, // Icon uang tunai
  Building2,
  Calculator,
  CheckCircle2, // Icon bank/transfer
  CreditCard,
  Loader2, // Icon kartu kredit
  LucideIcon, // Type untuk icon lucide
  QrCode, // Icon QRIS
} from "lucide-react";
import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";

// Interface untuk mendefinisikan struktur item di keranjang
interface CartItem {
  id: string; // ID produk
  name: string; // Nama produk
  price: number; // Harga produk
  quantity: number; // Jumlah item
  sku: string; // SKU (Stock Keeping Unit) produk
}

// Interface untuk props yang diterima komponen PaymentDialog
interface PaymentDialogProps {
  open: boolean; // Status dialog terbuka/tertutup
  onClose: () => void; // Callback saat dialog ditutup
  items: CartItem[]; // Array item yang dibeli
  subTotal: number; // Subtotal sebelum pajak
  tax: number; // Jumlah pajak
  total: number; // Total akhir yang harus dibayar
  onSuccess: (transaction: any) => void; // Callback saat pembayaran berhasil
}

// Type untuk metode pembayaran yang tersedia
type PaymentMethod = "cash" | "qris" | "card" | "transfer";

// Daftar metode pembayaran dengan label dan icon masing-masing
const paymentMethods: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "cash", label: "Tunai", icon: Banknote },
  { id: "qris", label: "QRIS", icon: QrCode },
  { id: "card", label: "Kartu", icon: CreditCard },
  { id: "transfer", label: "Transfer", icon: Building2 },
];

// Komponen utama untuk dialog pembayaran
export default function PaymentDialog({
  items, // Daftar item yang dibeli
  open, // Status dialog
  tax, // Jumlah pajak
  subTotal, // Subtotal
  total, // Total pembayaran
  onClose, // Handler untuk menutup dialog
  onSuccess, // Handler untuk pembayaran sukses
}: PaymentDialogProps) {
  // State untuk menyimpan metode pembayaran yang dipilih (default: cash)
  const [paymentMethod, setPaymentMethod] =
    React.useState<PaymentMethod>("cash");

  // State untuk menyimpan jumlah uang yang dibayarkan (string untuk input)
  const [amountPaid, setAmountPaid] = React.useState<string>("");

  // State untuk indikator proses pembayaran sedang berjalan
  const [isProcessing, setIsProcessing] = React.useState<boolean>(false);

  // State untuk indikator pembayaran berhasil
  const [isSuccess, setIsSuccess] = React.useState<boolean>(false);

  // Konversi string amountPaid ke number, default 0 jika invalid
  const amountPaidNum = parseFloat(amountPaid) || 0;

  // Hitung kembalian (uang dibayar - total)
  const changeNum = amountPaidNum - total;

  // Validasi: pembayaran dapat dilakukan jika bukan cash ATAU uang cukup
  const canPay = paymentMethod !== "cash" || amountPaidNum >= total;

  // Array untuk tombol quick amount (nominal cepat)
  // Filter hanya nominal yang >= total atau label "Pas" (untuk bayar pas)
  const quickAmounts = [
    { label: "Pas", value: total }, // Tombol pembayaran pas
    { label: formatCurrency(50000), value: 50000 }, // Tombol 50rb
    { label: formatCurrency(100000), value: 100000 }, // Tombol 100rb
    { label: formatCurrency(150000), value: 150000 }, // Tombol 150rb
  ].filter((q) => q.value >= total || q.label === "Pas"); // Hanya tampilkan yang relevan

  // Fungsi untuk memproses pembayaran
  const handlePayment = async () => {
    // Validasi: jangan proses jika belum bisa bayar
    if (!canPay) return;

    // Set state processing menjadi true (loading)
    setIsProcessing(true);

    try {
      // Kirim request POST ke API untuk membuat transaksi
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          // Transform items ke format yang dibutuhkan API
          items: items.map((item) => ({
            productId: item.id,
            productName: item.name,
            productSku: item.sku,
            quantity: item.quantity,
            unitPrice: item.price,
            subTotal: item.price + item.quantity, // Hitung subtotal per item
          })),
          subTotal, // Subtotal keseluruhan
          taxAmount: tax, // Jumlah pajak
          taxPercent: 10, // Persentase pajak (10%)
          total, // Total pembayaran
          paymentMethod, // Metode pembayaran yang dipilih
          // Amount paid: gunakan input user jika cash, total jika non-cash
          amountPaid: paymentMethod === "cash" ? amountPaidNum : total,
          // Change: hitung kembalian jika cash, 0 jika non-cash
          changeAmount: paymentMethod === "cash" ? Math.max(0, changeNum) : 0,
        }),
      });

      // Jika response tidak OK, lempar error
      if (!res.ok) {
        throw new Error("Failed to process payment");
      }

      // Parse response JSON
      const data = await res.json();

      // Set state success menjadi true
      setIsSuccess(true);

      // Tunggu 1.5 detik, lalu panggil callback onSuccess dan reset state
      setTimeout(() => {
        onSuccess(data.transaction); // Kirim data transaksi ke parent
        resetState(); // Reset semua state ke default
      }, 1500);
    } catch (error) {
      // Handle error: log dan tampilkan alert
      console.error("Payment error:", error);
      alert("Terjadi kesalahan saat memproses pembayaran");
    } finally {
      // Set processing ke false (loading selesai)
      setIsProcessing(false);
    }
  };

  // Fungsi untuk reset semua state ke nilai default
  const resetState = () => {
    setPaymentMethod("cash"); // Reset ke metode cash
    setAmountPaid(""); // Kosongkan input amount
    setIsProcessing(false); // Matikan loading
  };

  // Handler untuk menutup dialog
  const handleClose = () => {
    // Hanya bisa close jika tidak sedang processing
    if (!isProcessing) {
      resetState(); // Reset state
      onClose(); // Panggil callback onClose dari parent
    }
  };

  // Return placeholder div (UI dialog belum diimplementasikan)
  // TODO: Implementasi UI lengkap untuk dialog pembayaran
  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Pembayaran</DialogTitle>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Pembayaran Berhasil!</h3>
            <p className="text-muted-foreground">
              Transaksi sedang diproses...
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Order Summary */}
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Subtotal ({items.length} item)
                  </span>
                  <span>{formatCurrency(subTotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">PPN 10%</span>
                  <span>{formatCurrency(tax)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg pt-2 border-t">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
              </div>
            </div>
            {/* Payment Method Selection */}
            <div>
              <Label className="text-sm font-medium mb-3 block">
                Metode Pembayaran
              </Label>
              <div className="grid grid-cols-4 gap-2">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  return (
                    <Button
                      key={method.id}
                      variant={
                        paymentMethod === method.id ? "default" : "outline"
                      }
                      className={cn(
                        "flex-col h-auto py-3",
                        paymentMethod === method.id && "ring-2 ring-primary",
                      )}
                      onClick={() =>
                        setPaymentMethod(method.id as PaymentMethod)
                      }
                    >
                      <Icon className="h-5 w-5 mb-1" />
                      <span className="text-xs">{method.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Cash Payment Input */}
            {paymentMethod === "cash" && (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="amount" className="text-sm font-medium">
                    Jumlah Bayar
                  </Label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      Rp
                    </span>
                    <Input
                      id="amount"
                      type="number"
                      placeholder="0"
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="pl-10 text-lg font-mono"
                    />
                  </div>
                </div>

                {/* Quick Amounts */}
                <div className="flex flex-wrap gap-2">
                  {quickAmounts.map((q) => (
                    <Button
                      key={q.label}
                      variant="outline"
                      size="sm"
                      onClick={() => setAmountPaid(q.value.toString())}
                    >
                      {q.label}
                    </Button>
                  ))}
                </div>
                {/* Change Display */}
                {amountPaidNum > 0 && (
                  <div
                    className={cn(
                      "p-3 rounded-lg text-center",
                      changeNum >= 0
                        ? "bg-green-50 text-green-700"
                        : "bg-red-50 text-red-700",
                    )}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Calculator className="h-4 w-4" />
                      <span className="font-medium">
                        {changeNum >= 0
                          ? `Kembalian: ${formatCurrency(changeNum)}`
                          : `Kurang: ${formatCurrency(Math.abs(changeNum))}`}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Non-cash Payment Info */}
            {paymentMethod !== "cash" && (
              <div className="p-4 rounded-lg bg-blue-50 text-blue-700 text-sm text-center">
                {paymentMethod === "qris" && "Scan QR code untuk pembayaran"}
                {paymentMethod === "card" &&
                  "Tap atau insert kartu pada mesin EDC"}
                {paymentMethod === "transfer" && "Transfer ke rekening toko"}
              </div>
            )}

            {/* Pay Button */}
            <Button
              className="w-full"
              size="lg"
              onClick={handlePayment}
              disabled={!canPay || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                `Bayar ${formatCurrency(total)}`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
