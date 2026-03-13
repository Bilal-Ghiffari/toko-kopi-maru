"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Skeleton } from "../ui/skeleton";

interface QuickStatsProps {
  className?: string;
}

interface Stats {
  todayRevenue: number;
  todayTransactions: number;
  yesterdayRevenue: number;
  trend: "up" | "down" | "neutral";
  trendPercent: number;
}

export function QuickStats({ className }: QuickStatsProps) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/analytics/quick");
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (error) {
        console.error("Failed to fetch quick stats:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchStats();

    // Refresh setiap 5 menit
    const interval = setInterval(fetchStats, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-8 w-32" />
            </div>
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const TrendIcon =
    stats.trend === "up"
      ? TrendingUp
      : stats.trend === "down"
      ? TrendingDown
      : Minus;

  return (
    <Card className={className}>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Penjualan Hari Ini</p>
            <p className="text-2xl font-bold">
              {formatCurrency(stats.todayRevenue)}
            </p>
            <div className="flex items-center gap-1 mt-1">
              <TrendIcon
                className={cn(
                  "h-4 w-4",
                  stats.trend === "up"
                    ? "text-green-500"
                    : stats.trend === "down"
                    ? "text-red-500"
                    : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-sm",
                  stats.trend === "up"
                    ? "text-green-500"
                    : stats.trend === "down"
                    ? "text-red-500"
                    : "text-muted-foreground"
                )}
              >
                {stats.trend === "neutral"
                  ? "Sama dengan"
                  : `${stats.trendPercent}% ${
                      stats.trend === "up" ? "lebih tinggi" : "lebih rendah"
                    }`}{" "}
                dari kemarin
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Transaksi</p>
            <p className="text-xl font-semibold">{stats.todayTransactions}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
