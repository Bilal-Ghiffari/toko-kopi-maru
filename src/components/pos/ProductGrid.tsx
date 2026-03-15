"use client";

import { cn, formatCurrency } from "@/lib/utils";
import { memo } from "react";
import { Badge } from "../ui/badge";
import { AlertTriangle, Package, Plus } from "lucide-react";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";

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

interface ProductCardProps {
  product: Product;
  onAdd: () => void;
  inCartQuantity: number;
}

const ProductCard = memo(function ProductCard({
  product,
  onAdd,
  inCartQuantity,
}: ProductCardProps) {
  const isOutOfStock = product.stock === 0; // Cek apakah stok habis
  const remainingStock = product.stock - inCartQuantity; // Hitung sisa stok setelah dikurangi di cart
  return (
    <div
      className={cn(
        "group relative p-4 rounded-xl border bg-card transition-all",
        "hover:shadow-lg hover:border-primary/30",
        isOutOfStock && "opacity-60",
      )}
    >
      {/* Category Badge */}
      <Badge variant="secondary" className="absolute top-2 right-2 text-[10px]">
        {product.category.name}
      </Badge>

      {/* Product Icon/Image Placeholder */}
      <div className="h-16 w-16 mx-auto mb-3 rounded-lg bg-muted flex items-center justify-center">
        <Package className="h-8 w-8 text-muted-foreground" />
      </div>

      {/* Product Info */}
      <div className="text-center mb-3">
        <h3 className="font-medium text-sm line-clamp-2 min-h-10">
          {product.name}
        </h3>
        <p className="text-lg font-bold text-primary mt-1">
          {formatCurrency(product.price)}
        </p>
      </div>

      {/* Stock Info */}
      <div className="flex items-center justify-center gap-1 mb-3">
        {isOutOfStock ? (
          <Badge
            variant="outline"
            className="text-[10px] border-orange-300 text-orange-600"
          >
            <AlertTriangle className="h-3 w-3 mr-1" />
            Sisa {remainingStock}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">
            Stock: {remainingStock}
          </span>
        )}

        {inCartQuantity > 0 && (
          <Badge className="text-[10px] ml-1">
            {inCartQuantity} di keranjang
          </Badge>
        )}
      </div>

      {/* Add Button */}
      <Button
        size="sm"
        className="w-full"
        onClick={onAdd}
        disabled={remainingStock <= 0}
      >
        <Plus className="h-4 w-4 mr-2" />
        Tambah
      </Button>
    </div>
  );
});

interface ProductGridProps {
  products: Product[];
  onAddToCart: (product: Product) => void;
  isLoading?: boolean;
  cartItems?: CartItem[];
}

export function ProductGrid({
  products,
  cartItems = [],
  isLoading,
  onAddToCart,
}: ProductGridProps) {
  // Loading Skeleton
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl border">
            <Skeleton className="h-16 w-16 mx-auto mb-3 rounded-lg" />
            <Skeleton className="h-4 w-3/4 mx-auto mb-2" />
            <Skeleton className="h-6 w-1/2 mx-auto mb-3" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (products.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Tidak ada produk ditemukan</p>
        <p className="text-sm text-muted-foreground mt-1">
          Coba kata kunci pencarian lain
        </p>
      </div>
    );
  }

  // Get quantity in cart for each product
  const getInCartQuantity = (productId: string) => {
    const item = cartItems.find((i) => i.id === productId);
    return item?.quantity || 0;
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          onAdd={() => onAddToCart(product)}
          inCartQuantity={getInCartQuantity(product.id)}
        />
      ))}
    </div>
  );
}
