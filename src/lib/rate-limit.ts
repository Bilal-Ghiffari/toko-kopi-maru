/**
 * RATE LIMITING UTILITY
 *
 * Fungsi untuk membatasi jumlah request dari IP tertentu dalam periode waktu
 * Mencegah abuse dan overload pada API endpoints
 *
 * BEST PRACTICES:
 * 1. Gunakan IP-based limiting untuk public APIs
 * 2. Gunakan user-based limiting untuk authenticated APIs
 * 3. Set limit sesuai kebutuhan endpoint (read vs write operations)
 * 4. Berikan informative error messages
 * 5. Include rate limit headers untuk transparency
 * 6. Untuk production, gunakan Redis instead of in-memory storage
 */

import { NextResponse } from "next/server";

// ============================================
// TYPE DEFINITIONS
// ============================================

interface RateLimitConfig {
  interval: number; // Durasi window dalam milidetik (contoh: 60000 = 1 menit)
  uniqueTokenPerInterval: number; // Maksimal unique tokens (IPs) yang di-track
  maxRequests: number; // Maksimal requests per interval
}

interface RateLimitResult {
  success: boolean; // Apakah request diizinkan
  limit: number; // Batas maksimal requests
  remaining: number; // Sisa requests yang diperbolehkan
  reset: number; // Timestamp kapan counter akan reset (dalam detik Unix)
}

// ============================================
// IN-MEMORY STORAGE
// ============================================

/**
 * Map untuk menyimpan request count per identifier (IP/User)
 * Format: Map<identifier, { count: number, resetTime: number }>
 *
 * NOTE: Untuk production dengan multiple servers, gunakan Redis
 * agar rate limit konsisten across instances
 */
const tokenCache = new Map<
  string,
  {
    count: number; // Jumlah request dalam window saat ini
    resetTime: number; // Waktu kapan counter akan reset
  }
>();

// ============================================
// RATE LIMITER CLASS
// ============================================

export class RateLimiter {
  private interval: number;
  private uniqueTokenPerInterval: number;
  private maxRequests: number;

  /**
   * Constructor untuk RateLimiter
   *
   * @param config - Konfigurasi rate limiting
   *
   * Contoh penggunaan:
   * - API read (GET): { interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 100 }
   * - API write (POST): { interval: 60000, uniqueTokenPerInterval: 500, maxRequests: 20 }
   * - Public API: { interval: 3600000, uniqueTokenPerInterval: 1000, maxRequests: 1000 }
   */
  constructor(config: RateLimitConfig) {
    this.interval = config.interval;
    this.uniqueTokenPerInterval = config.uniqueTokenPerInterval;
    this.maxRequests = config.maxRequests;
  }

  /**
   * Check apakah request dari identifier diperbolehkan
   *
   * @param identifier - Unique identifier (biasanya IP address atau user ID)
   * @returns RateLimitResult object dengan info rate limit
   */
  async check(identifier: string): Promise<RateLimitResult> {
    const now = Date.now();
    const resetTime = now + this.interval;

    // Ambil data rate limit untuk identifier ini
    const tokenData = tokenCache.get(identifier);

    // Jika tidak ada data atau window sudah expired, reset counter
    if (!tokenData || now > tokenData.resetTime) {
      tokenCache.set(identifier, {
        count: 1,
        resetTime,
      });

      return {
        success: true,
        limit: this.maxRequests,
        remaining: this.maxRequests - 1,
        reset: Math.floor(resetTime / 1000),
      };
    }

    // Increment counter untuk request ini
    tokenData.count++;

    // Check apakah sudah melewati limit
    if (tokenData.count > this.maxRequests) {
      return {
        success: false,
        limit: this.maxRequests,
        remaining: 0,
        reset: Math.floor(tokenData.resetTime / 1000),
      };
    }

    // Update cache
    tokenCache.set(identifier, tokenData);

    return {
      success: true,
      limit: this.maxRequests,
      remaining: this.maxRequests - tokenData.count,
      reset: Math.floor(tokenData.resetTime / 1000),
    };
  }

  /**
   * Cleanup expired entries dari cache
   * Panggil secara periodik untuk mencegah memory leak
   *
   * Untuk production, pertimbangkan:
   * - Gunakan setInterval untuk cleanup otomatis
   * - Atau gunakan Redis dengan TTL bawaan
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of tokenCache.entries()) {
      if (now > value.resetTime) {
        tokenCache.delete(key);
      }
    }
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract IP address dari request
 * Prioritas: X-Forwarded-For > X-Real-IP > connection.remoteAddress
 *
 * @param request - Next.js request object
 * @returns IP address string atau 'unknown' jika tidak ditemukan
 */
export function getClientIp(request: Request): string {
  // Check X-Forwarded-For header (untuk proxy/load balancer)
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  // Check X-Real-IP header
  const realIp = request.headers.get("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback ke unknown (untuk development/testing)
  return "unknown";
}

/**
 * Buat response error untuk rate limit exceeded
 * Mengembalikan 429 status dengan informative message
 *
 * @param result - Rate limit result object
 * @returns NextResponse dengan status 429
 */
export function createRateLimitResponse(result: RateLimitResult): NextResponse {
  const retryAfter = result.reset - Math.floor(Date.now() / 1000);

  return NextResponse.json(
    {
      error: "Too Many Requests",
      message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
      retryAfter,
    },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": result.limit.toString(),
        "X-RateLimit-Remaining": result.remaining.toString(),
        "X-RateLimit-Reset": result.reset.toString(),
        "Retry-After": retryAfter.toString(),
      },
    },
  );
}

/**
 * Add rate limit headers ke response
 * Memberikan transparency ke client tentang rate limit status
 *
 * @param response - NextResponse object
 * @param result - Rate limit result object
 * @returns Response dengan rate limit headers
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: RateLimitResult,
): NextResponse {
  response.headers.set("X-RateLimit-Limit", result.limit.toString());
  response.headers.set("X-RateLimit-Remaining", result.remaining.toString());
  response.headers.set("X-RateLimit-Reset", result.reset.toString());
  return response;
}

// ============================================
// PRECONFIGURED RATE LIMITERS
// ============================================

/**
 * Rate limiter untuk GET endpoints (read operations)
 * Lebih permisif karena read operations tidak mengubah data
 * Limit: 100 requests per menit
 */
export const readLimiter = new RateLimiter({
  interval: 60 * 1000, // 1 menit
  uniqueTokenPerInterval: 500, // Track 500 unique IPs
  maxRequests: 100, // 100 requests per menit
});

/**
 * Rate limiter untuk POST/PUT/DELETE endpoints (write operations)
 * Lebih ketat karena write operations mengubah data
 * Limit: 20 requests per menit
 */
export const writeLimiter = new RateLimiter({
  interval: 60 * 1000, // 1 menit
  uniqueTokenPerInterval: 500, // Track 500 unique IPs
  maxRequests: 20, // 20 requests per menit
});

/**
 * Rate limiter untuk authentication endpoints
 * Sangat ketat untuk mencegah brute force attacks
 * Limit: 5 requests per 15 menit
 */
export const authLimiter = new RateLimiter({
  interval: 15 * 60 * 1000, // 15 menit
  uniqueTokenPerInterval: 1000, // Track 1000 unique IPs
  maxRequests: 5, // 5 requests per 15 menit
});

/**
 * Rate limiter untuk chat/AI endpoints
 * Moderate limiting karena AI calls costly tapi perlu responsive
 * Limit: 20 requests per menit
 */
export const chatLimiter = new RateLimiter({
  interval: 60 * 1000, // 1 menit
  uniqueTokenPerInterval: 500, // Track 500 unique IPs
  maxRequests: 20, // 20 requests per menit
});

// ============================================
// CLEANUP SCHEDULER
// ============================================

/**
 * Jalankan cleanup setiap 10 menit untuk free memory
 * Di production, pertimbangkan untuk menggunakan Redis dengan auto-expiry
 */
if (typeof setInterval !== "undefined") {
  setInterval(
    () => {
      readLimiter.cleanup();
      writeLimiter.cleanup();
      authLimiter.cleanup();
      chatLimiter.cleanup();
    },
    10 * 60 * 1000,
  ); // 10 menit
}
