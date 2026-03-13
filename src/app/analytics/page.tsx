"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn, formatCurrency } from "@/lib/utils";
import {
  BarChart3,
  Calendar,
  DollarSign,
  Loader2,
  MessageSquare,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import React from "react";

interface AnalyticsData {
  summary: {
    totalRevenue: number;
    totalTransactions: number;
    averageTransaction: number;
    totalDiscount: number;
  };
  topProducts: Array<{
    rank: number;
    name: string;
    quantitySold: number;
    revenue: number;
  }>;
  categoryBreakdown: Array<{
    categoryName: string;
    itemsSold: number;
    revenue: number;
  }>;
  paymentMethods: Array<{
    method: string;
    transactions: number;
    total: number;
    percentage: string;
  }>;
}

export default function Analytics() {
  const [question, setQuestion] = React.useState("");
  const [dateRange, setDateRange] = React.useState<string>("week");
  const [analysis, setAnalysis] = React.useState<string>("");
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!question.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question, dateRange }),
      });

      if (!res.ok) {
        throw new Error("Failed to fetch analytics");
      }

      const result = await res.json();
      setAnalysis(result.analysis);
      setData(result.data);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "An unknown error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Preset questions
  const presetQuestions = [
    {
      icon: "💰",
      label: "Total penjualan",
      query: "Berapa total penjualan dan rata-rata per transaksi?",
    },
    {
      icon: "🏆",
      label: "Produk terlaris",
      query: "Apa saja 5 produk terlaris dan berapa kontribusinya?",
    },
    {
      icon: "📊",
      label: "Kategori terbaik",
      query: "Kategori mana yang paling menguntungkan?",
    },
    {
      icon: "💳",
      label: "Metode bayar",
      query: "Bagaimana breakdown metode pembayaran?",
    },
    {
      icon: "⏰",
      label: "Jam sibuk",
      query: "Jam berapa penjualan paling ramai?",
    },
    {
      icon: "📈",
      label: "Trend harian",
      query: "Bagaimana trend penjualan harian?",
    },
    {
      icon: "👤",
      label: "Performa kasir",
      query: "Siapa kasir dengan penjualan tertinggi?",
    },
    {
      icon: "🎯",
      label: "Ringkasan lengkap",
      query: "Berikan ringkasan lengkap performa penjualan",
    },
  ];

  // Payment method labels
  const paymentLabels: Record<string, { label: string; icon: string }> = {
    cash: { label: "Tunai", icon: "💵" },
    qris: { label: "QRIS", icon: "📱" },
    card: { label: "Kartu", icon: "💳" },
    transfer: { label: "Transfer", icon: "🏦" },
  };

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-background border-b">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Maru Analytics</h1>
              <p className="text-muted-foreground">
                Tanya apapun tentang data penjualan dengan bahasa natural
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Query Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Tanya Maru Analyst
            </CardTitle>
            <CardDescription>
              Ketik pertanyaan dalam bahasa Indonesia, Maru akan menganalisis
              data dan memberikan insight
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range & Input */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={dateRange} onValueChange={setDateRange}>
                <SelectTrigger className="w-full sm:w-45">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Pilih periode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Hari ini</SelectItem>
                  <SelectItem value="yesterday">Kemarin</SelectItem>
                  <SelectItem value="week">7 hari terakhir</SelectItem>
                  <SelectItem value="month">30 hari terakhir</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex-1 flex gap-2">
                <Input
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Contoh: Produk apa yang paling laris minggu ini?"
                  onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
                  className="flex-1"
                />
                <Button
                  onClick={handleAnalyze}
                  disabled={isLoading || !question.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    "Analyze"
                  )}
                </Button>
              </div>
            </div>

            {/* Preset Questions */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Pertanyaan populer:
              </p>
              <div className="flex flex-wrap gap-2">
                {presetQuestions.map((preset) => (
                  <Button
                    key={preset.label}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      setQuestion(preset.query);
                      // Auto submit after short delay
                      setTimeout(() => {
                        const btn = document.querySelector(
                          'button[type="submit"]',
                        ) as HTMLButtonElement;
                        btn?.click();
                      }, 100);
                    }}
                  >
                    <span className="mr-1">{preset.icon}</span>
                    {preset.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Error Display */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <p className="text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Analysis Result */}
        {analysis && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Hasil Analisis AI
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {analysis}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Data Cards */}
        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total Revenue
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(data.summary.totalRevenue)}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                      <DollarSign className="h-6 w-6 text-green-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total Transaksi
                      </p>
                      <p className="text-2xl font-bold">
                        {data.summary.totalTransactions}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Rata-rata / Transaksi
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(data.summary.averageTransaction)}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <BarChart3 className="h-6 w-6 text-purple-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">
                        Total Diskon
                      </p>
                      <p className="text-2xl font-bold">
                        {formatCurrency(data.summary.totalDiscount)}
                      </p>
                    </div>
                    <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                      <TrendingDown className="h-6 w-6 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Detailed Data */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Products */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">🏆 Top 5 Produk</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.topProducts.slice(0, 5).map((product, index) => (
                      <div
                        key={product.name}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold",
                              index === 0
                                ? "bg-yellow-100 text-yellow-700"
                                : index === 1
                                  ? "bg-gray-100 text-gray-700"
                                  : index === 2
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-muted text-muted-foreground",
                            )}
                          >
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {product.quantitySold} terjual
                            </p>
                          </div>
                        </div>
                        <p className="font-semibold">
                          {formatCurrency(product.revenue)}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Payment Methods */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    💳 Metode Pembayaran
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {data.paymentMethods.map((method) => {
                      const info = paymentLabels[method.method] || {
                        label: method.method,
                        icon: "💰",
                      };
                      return (
                        <div
                          key={method.method}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">{info.icon}</span>
                            <div>
                              <p className="font-medium">{info.label}</p>
                              <p className="text-sm text-muted-foreground">
                                {method.transactions} transaksi
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">
                              {formatCurrency(method.total)}
                            </p>
                            <Badge variant="secondary" className="text-xs">
                              {method.percentage}%
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Category Breakdown */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-lg">
                    📊 Breakdown per Kategori
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {data.categoryBreakdown.map((category) => (
                      <div
                        key={category.categoryName}
                        className="p-4 rounded-lg bg-muted/50 text-center"
                      >
                        <p className="text-sm text-muted-foreground mb-1">
                          {category.categoryName}
                        </p>
                        <p className="text-xl font-bold">
                          {formatCurrency(category.revenue)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {category.itemsSold} item terjual
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
