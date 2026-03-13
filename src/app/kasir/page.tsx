"use client";

import { QuickStats } from "@/components/analytics/QuickStats";
import AIAssistant from "@/components/pos/AIAssistant";
import { Cart } from "@/components/pos/Cart";
import PaymentDialog from "@/components/pos/PaymentDialog";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { SearchBar } from "@/components/pos/SearchBar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, formatCurrency } from "@/lib/utils";
import {
  Loader2,
  MessageSquare,
  Package,
  Receipt,
  RefreshCcw,
} from "lucide-react";
import Image from "next/image";
import React from "react";

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  sku: string;
  category: {
    id: string;
    name: string;
  };
}

interface CartItem extends Product {
  quantity: number;
}

export default function Kasir() {
  // Product State
  const [products, setProducts] = React.useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] =
    React.useState<boolean>(true);
  const [searchLoading, setSearchLoading] = React.useState<boolean>(false);

  // Cart State
  const [cart, setCart] = React.useState<CartItem[]>([]);

  // UI State
  const [activeTab, setActiveTab] = React.useState<"cart" | "ai">("cart");
  const [showPayment, setShowPayment] = React.useState<boolean>(false);

  // ============================================
  // LOAD INITIAL PRODUCTS
  // ============================================
  const loadProducts = React.useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const res = await fetch("/api/products");
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products);
      }
    } catch (error) {
      console.error("Failed to load products:", error);
    } finally {
      setIsLoadingProducts(false);
    }
  }, []);

  React.useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  // ============================================
  // CART OPERATIONS
  // ============================================
  const addToCart = React.useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);

      if (existing) {
        // Check stock
        if (existing.quantity >= product.stock) {
          alert(`Stok ${product.name} tidak cukup!`);
          return prev;
        }

        // Update quantity
        return prev.map((item) =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }

      // Add new item
      return [...prev, { ...product, quantity: 1 }];
    });
  }, []);

  const updateQuantity = React.useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        setCart((prev) => prev.filter((item) => item.id !== productId));
        return;
      }

      setCart((prev) =>
        prev.map((item) => {
          if (item.id !== productId) return item;

          // Check stock
          if (quantity > item.stock) {
            alert(`Stok ${item.name} tidak cukup!`);
            return item;
          }

          return { ...item, quantity };
        }),
      );
    },
    [],
  );

  const removeFromCart = React.useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  }, []);

  const clearCart = React.useCallback(() => {
    setCart([]);
  }, []);

  // ============================================
  // CART CALCULATIONS
  // ============================================

  // Subtotal, Tax, Total
  const subtotal = cart.reduce(
    // Menghitung subtotal dari item di keranjang
    (sum, item) => sum + +item.price * item.quantity,
    0,
  );
  const tax = subtotal * 0.1; // PPN 10%
  const total = subtotal + tax; // Total akhir
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0); // Jumlah item di keranjang

  // ============================================
  // PAYMENT SUCCESS HANDLER
  // ============================================
  const handlePaymentSuccess = React.useCallback(
    async (transactionData: any) => {
      // Clear cart
      clearCart();

      // Refresh products (untuk update stok)
      await loadProducts();

      // Close payment dialog
      setShowPayment(false);

      // Show success message (bisa pakai toast)
      alert(
        `✅ Transaksi berhasil!\\nNo. Invoice: ${transactionData.invoiceNumber}`,
      );
    },
    [clearCart, loadProducts],
  );

  // ============================================
  // SEARCH RESULTS HANDLER
  // ============================================
  const handleSearchResults = React.useCallback((results: Product[]) => {
    setProducts(results);
  }, []);

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-background border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center"> */}
              <div className="h-20 w-20 rounded-lg flex items-center justify-center">
                {/* <Receipt className="h-5 w-5 text-primary-foreground" /> */}
                <Image
                  src="/logo-kopi-maru.jpg"
                  alt="Logo Kopi Maru"
                  width={80}
                  height={80}
                  className="rounded-lg object-cover"
                />
              </div>
              <div>
                <h1 className="font-bold text-lg">Toko Kopi Maru</h1>
                <p className="text-xs text-muted-foreground">
                  Smart Point of Sale
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadProducts}
                disabled={isLoadingProducts}
              >
                <RefreshCcw
                  className={cn(
                    "h-4 w-4 mr-1",
                    isLoadingProducts && "animate-spin",
                  )}
                />
                Refresh
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-4">
        {/* Quick Stats */}
        <div className="mb-4">
          <QuickStats />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* LEFT: Products Section (2 cols) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search */}
            <Card>
              <CardContent className="pt-4">
                <SearchBar
                  onResults={handleSearchResults}
                  onLoading={setSearchLoading}
                />
              </CardContent>
            </Card>

            {/* Products Grid */}
            <Card className="min-h-125">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Produk
                    <Badge variant="secondary">{products.length}</Badge>
                  </CardTitle>

                  {searchLoading && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <ProductGrid
                  products={products}
                  onAddToCart={addToCart}
                  isLoading={isLoadingProducts}
                  cartItems={cart}
                />
              </CardContent>
            </Card>
          </div>

          {/* RIGHT: Cart & AI (1 col) */}
          <div className="space-y-4">
            {/* Tabs: Cart / AI Assistant */}
            <Tabs
              value={activeTab}
              onValueChange={(v) => setActiveTab(v as "cart" | "ai")}
              className="h-full"
            >
              <TabsList className="w-full">
                <TabsTrigger value="cart" className="flex-1">
                  {/* <ShoppingCart className="h-4 w-4 mr-2" /> */}
                  Keranjang
                  {totalItems > 0 && (
                    <Badge className="ml-2" variant="default">
                      {totalItems}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="ai" className="flex-1">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  AI Assistant
                </TabsTrigger>
              </TabsList>

              <TabsContent value="cart" className="mt-4">
                <Card className="h-[calc(100vh-320px)]">
                  <CardContent className="p-0 h-full flex flex-col">
                    {/* Cart Items */}
                    <div className="flex-1 overflow-auto p-4">
                      <Cart
                        items={cart}
                        onUpdateQuantity={updateQuantity}
                        onRemove={removeFromCart}
                        onClear={clearCart}
                      />
                    </div>

                    {/* Cart Summary & Checkout */}
                    {cart.length > 0 && (
                      <div className="border-t p-4 bg-muted/30">
                        <div className="space-y-2 text-sm mb-4">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Subtotal
                            </span>
                            <span>{formatCurrency(subtotal)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              PPN (10%)
                            </span>
                            <span>{formatCurrency(tax)}</span>
                          </div>
                          <div className="flex justify-between font-bold text-base pt-2 border-t">
                            <span>Total</span>
                            <span className="text-primary">
                              {formatCurrency(total)}
                            </span>
                          </div>
                        </div>

                        <Button
                          className="w-full"
                          size="lg"
                          onClick={() => setShowPayment(true)}
                        >
                          Bayar ({totalItems} item)
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ai" className="mt-4">
                <AIAssistant
                  className="h-[calc(100vh-320px)]"
                  onProductSelect={(id) => {
                    const product = products.find((p) => p.id === id);
                    if (product) {
                      addToCart(product);
                      setActiveTab("cart");
                    }
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Payment Dialog */}
      <PaymentDialog
        open={showPayment}
        onClose={() => setShowPayment(false)}
        items={cart}
        subTotal={subtotal}
        tax={tax}
        total={total}
        onSuccess={handlePaymentSuccess}
      />
    </div>
  );
}
