"use client";

import { useDebounce } from "@/hooks/useDebounce";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Search, Sparkles, X } from "lucide-react";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

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

interface SearchBarProps {
  onResults: (products: Product[]) => void;
  onLoading?: (isLoading: boolean) => void;
  className?: string;
}

interface AIParsed {
  searchTerms: string[];
  category: string | null;
  priceRange: {
    min: number | null;
    max: number | null;
  };
  sortBy: string | null;
  attributes?: {
    isSweet: boolean | null;
    isCold: boolean | null;
    hasMilk: boolean | null;
    isSpicy: boolean | null;
  };
}

export function SearchBar({ onResults, onLoading, className }: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [aiParsed, setAiParsed] = useState<AIParsed | null>(null);
  const [resultCount, setResultCount] = useState<number | null>(null);

  const debounceQuery = useDebounce(query, 400);

  const handleSearch = useCallback(
    async (searchQuery: string) => {
      setIsSearching(true);
      onLoading?.(true);

      try {
        const res = await fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: searchQuery }),
        });

        if (!res.ok) throw new Error("Search API error");

        const data = await res.json();
        onResults(data.products);
        setAiParsed(data.aiParsed);

        setResultCount(data.products.length);
      } catch {
        onResults([]);
        setAiParsed(null);
        setResultCount(0);
      } finally {
        setIsSearching(false);
        onLoading?.(false);
      }
    },
    [onResults, onLoading]
  );

  useEffect(() => {
    handleSearch(debounceQuery);
  }, [debounceQuery, handleSearch]);

  const clearSearch = () => {
    setQuery("");
    setAiParsed(null);
  };

  const getAttributeBadges = () => {
    if (!aiParsed?.attributes) return null;

    const badges: { label: string; variant: "default" | "secondary" }[] = [];

    if (aiParsed.attributes.isSweet === true)
      badges.push({ label: "🍬 Manis", variant: "secondary" });
    if (aiParsed.attributes.isSweet === false)
      badges.push({ label: "☕ Tidak Manis", variant: "secondary" });
    if (aiParsed.attributes.isCold === true)
      badges.push({ label: "🧊 Dingin", variant: "secondary" });
    if (aiParsed.attributes.hasMilk === false)
      badges.push({ label: "🥛 Tanpa Susu", variant: "secondary" });

    return badges;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

        <Input
          type="text"
          placeholder='Cari produk... (coba: "kopi dingin murah" atau "snack manis")'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-10 pr-20 h-12 text-base"
        />

        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={clearSearch}
            >
              <X className="h-4 w-4" />
            </Button>
          )}

          {isSearching ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : aiParsed ? (
            <Sparkles className="h-4 w-4 text-yellow-500" />
          ) : null}
        </div>
      </div>

      {/* AI Parsing Result */}
      {aiParsed && query && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          {/* AI Indicator */}
          <Badge
            variant="outline"
            className="text-xs bg-yellow-50 border-yellow-200"
          >
            <Sparkles className="h-3 w-3 mr-1 text-yellow-500" />
            AI Search
          </Badge>

          {/* Category Badge */}
          {aiParsed.category && (
            <Badge variant="secondary" className="text-xs">
              📁 {aiParsed.category}
            </Badge>
          )}

          {/* Price Range Badge */}
          {(aiParsed.priceRange.min || aiParsed.priceRange.max) && (
            <Badge variant="secondary" className="text-xs">
              💰{" "}
              {aiParsed.priceRange.min
                ? `Min Rp${(aiParsed.priceRange.min / 1000).toFixed(0)}K`
                : ""}
              {aiParsed.priceRange.min && aiParsed.priceRange.max ? " - " : ""}
              {aiParsed.priceRange.max
                ? `Max Rp${(aiParsed.priceRange.max / 1000).toFixed(0)}K`
                : ""}
            </Badge>
          )}

          {/* Sort Badge */}
          {aiParsed.sortBy && (
            <Badge variant="secondary" className="text-xs">
              ↕️{" "}
              {aiParsed.sortBy === "price_asc"
                ? "Termurah"
                : aiParsed.sortBy === "price_desc"
                ? "Termahal"
                : aiParsed.sortBy}
            </Badge>
          )}

          {/* Attribute Badges */}
          {getAttributeBadges()?.map((badge, i) => (
            <Badge key={i} variant={badge.variant} className="text-xs">
              {badge.label}
            </Badge>
          ))}

          {/* Result Count */}
          {resultCount !== null && (
            <span className="text-xs text-muted-foreground ml-auto">
              {resultCount} produk ditemukan
            </span>
          )}
        </div>
      )}

      {/* Quick Filters */}
      {!query && (
        <div className="flex flex-wrap gap-2 px-1">
          <span className="text-xs text-muted-foreground">Coba:</span>
          {["kopi dingin", "minuman manis", "makanan berat", "snack murah"].map(
            (suggestion) => (
              <Button
                key={suggestion}
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setQuery(suggestion)}
              >
                {suggestion}
              </Button>
            )
          )}
        </div>
      )}
    </div>
  );
}
