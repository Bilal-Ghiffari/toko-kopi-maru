"use client";

import { Minus, Plus, ShoppingBag, Trash, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import { formatCurrency } from "@/lib/utils";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
}

interface CartProps {
  items: CartItem[];
  onUpdateQuantity: (productId: string, quantity: number) => void;
  onRemove: (productId: string) => void;
  onClear: () => void;
}

export function Cart({
  items,
  onUpdateQuantity,
  onRemove,
  onClear,
}: CartProps) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12">
        <ShoppingBag className="h-16 w-16 text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground text-center">Keranjang kosong</p>
        <p className="text-sm text-muted-foreground text-center mt-1">
          Klik produk untuk menambahkan
        </p>
      </div>
    );
  }
  return (
    <div className="">
      {/* Cart Button */}
      <div className="space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="text-destructive hover:text-destructive"
        >
          <Trash className="mr-2 h-4 w-4" />
          Kosongkan
        </Button>
        {/* Cart Items */}
        {items.map((product) => (
          <div
            key={product.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
          >
            {/* Item Info */}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{product.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatCurrency(product.price)}
              </p>
            </div>
            {/* Quantity Controls */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  onUpdateQuantity(product.id, product.quantity - 1)
                }
                disabled={product.quantity <= 1}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="w-8 text-center font-medium">
                {product.quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() =>
                  onUpdateQuantity(product.id, product.quantity + 1)
                }
                disabled={product.quantity >= product.stock}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
            {/* Subtotal */}
            <div className="text-right min-w-20">
              <p className="font-semibold text-sm">
                {formatCurrency(product.price * product.quantity)}
              </p>
            </div>
            {/* Remove Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onRemove(product.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
