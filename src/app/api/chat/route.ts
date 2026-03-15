// ============================================
// IMPORT DEPENDENCIES
// ============================================
import { POS_ASSISTANT_SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { createPosAgent } from "@/lib/ai/langchain";
import {
  chatLimiter,
  getClientIp,
  createRateLimitResponse,
} from "@/lib/rate-limit";
import type { NextRequest } from "next/server";

// ============================================
// RUNTIME CONFIGURATION
// ============================================
// Menggunakan Node.js runtime untuk akses penuh ke database dan file system
export const runtime = "nodejs";

// ============================================
// VALIDATION CONFIGURATION
// ============================================
/**
 * MAX_MESSAGE_LENGTH: Maximum characters untuk single message
 * 1000 chars = cukup untuk pertanyaan detail, prevent spam/abuse
 */
const MAX_MESSAGE_LENGTH = 1000;

/**
 * MAX_MESSAGES_HISTORY: Maximum messages dalam conversation history
 * 50 messages = cukup untuk context, prevent memory issues
 */
const MAX_MESSAGES_HISTORY = 50;

// ============================================
// TIMEOUT CONFIGURATION
// ============================================
/**
 * LLM_TIMEOUT: Maximum time untuk LLM response (milliseconds)
 * 30 seconds = cukup untuk response kompleks, prevent hanging
 */
const LLM_TIMEOUT = 30 * 1000;

// ============================================
// MAIN POST HANDLER
// ============================================
/**
 * POST /api/chat
 * Endpoint untuk chat dengan AI assistant
 * Menerima array messages dan mengembalikan streaming response
 *
 * Security features:
 * - Rate limiting: 20 req/min per IP
 * - Input validation: Max 1000 chars per message
 * - Timeout: 30 seconds max response time
 * - XSS protection: Message sanitization
 */
export async function POST(req: NextRequest) {
  try {
    // ============================================
    // 1. RATE LIMITING CHECK
    // ============================================
    /**
     * Extract IP address dari request untuk rate limiting
     * Menggunakan utility function getClientIp yang sudah handle:
     * - X-Forwarded-For (proxy/load balancer)
     * - X-Real-IP (nginx)
     * - Fallback untuk local dev
     */
    const ip = getClientIp(req);
    console.log("🚀 ~ POST ~ ip:", ip);

    // Check rate limit menggunakan chatLimiter (20 req/min)
    const rateLimitResult = await chatLimiter.check(ip);

    // Jika melewati limit, return 429 error dengan info lengkap
    if (!rateLimitResult.success) {
      console.warn(`[Rate Limit] IP ${ip} exceeded rate limit`); // Log untuk monitoring
      return createRateLimitResponse(rateLimitResult);
    }

    // ============================================
    // 2. PARSE & VALIDATE REQUEST
    // ============================================
    const { messages } = await req.json();

    // Validation 1: Messages must be non-empty array
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Messages array is required" }),
        { status: 400 },
      );
    }

    // Validation 2: Limit conversation history length
    if (messages.length > MAX_MESSAGES_HISTORY) {
      console.warn(
        `[Validation] Messages length ${messages.length} exceeds limit ${MAX_MESSAGES_HISTORY}`,
      );
      return new Response(
        JSON.stringify({
          error: `Percakapan terlalu panjang. Maksimal ${MAX_MESSAGES_HISTORY} pesan. Silakan mulai percakapan baru.`,
        }),
        { status: 400 },
      );
    }

    // Extract last message untuk validation
    const lastMessage = messages[messages.length - 1].content;

    // Validation 3: Message content must be string
    if (typeof lastMessage !== "string") {
      return new Response(
        JSON.stringify({ error: "Message content must be string" }),
        { status: 400 },
      );
    }

    // Validation 4: Message length check
    if (lastMessage.length > MAX_MESSAGE_LENGTH) {
      console.warn(
        `[Validation] Message length ${lastMessage.length} exceeds limit ${MAX_MESSAGE_LENGTH}`,
      );
      return new Response(
        JSON.stringify({
          error: `Pesan terlalu panjang. Maksimal ${MAX_MESSAGE_LENGTH} karakter. (Kamu: ${lastMessage.length} karakter)`,
        }),
        { status: 400 },
      );
    }

    // Validation 5: Empty message check
    if (lastMessage.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Pesan tidak boleh kosong" }),
        { status: 400 },
      );
    }

    // Validation 6: XSS Detection (REJECT suspicious patterns)
    /**
     * Detect dan REJECT requests dengan XSS patterns
     * Lebih aman daripada hanya sanitize
     */
    const xssPatterns = [
      /<script\b/i, // <script> tags
      /<\/script>/i, // </script> closing tags
      /javascript:/i, // javascript: protocol
      /on\w+\s*=/i, // Event handlers (onclick, onerror, etc)
      /<iframe\b/i, // <iframe> tags
      /<object\b/i, // <object> tags
      /<embed\b/i, // <embed> tags
      /<img[^>]+onerror/i, // <img> with onerror
      /eval\s*\(/i, // eval() function
      /expression\s*\(/i, // CSS expression
      /<svg\b.*onload/i, // SVG with onload
      /&#/, // HTML entities (common in XSS)
      /\\x[0-9a-f]{2}/i, // Hex encoding
      /\\u[0-9a-f]{4}/i, // Unicode encoding
    ];

    // Check all patterns
    for (const pattern of xssPatterns) {
      if (pattern.test(lastMessage)) {
        return new Response(
          JSON.stringify({
            error:
              "Pesan mengandung konten yang tidak diizinkan. Hindari menggunakan HTML tags atau script. 🚫",
            code: "XSS_DETECTED",
          }),
          { status: 400 },
        );
      }
    }

    // Additional check: Detect excessive HTML-like patterns
    const htmlTagCount = (lastMessage.match(/<[^>]+>/g) || []).length;
    if (htmlTagCount > 2) {
      // Allow max 2 HTML-like patterns (bisa false positive)
      console.warn(
        `[XSS Attempt] IP ${ip} excessive HTML tags: ${htmlTagCount}`,
      );
      return new Response(
        JSON.stringify({
          error:
            "Pesan mengandung terlalu banyak HTML tags. Gunakan text biasa. 🚫",
          code: "HTML_DETECTED",
        }),
        { status: 400 },
      );
    }

    // ============================================
    // 3. GATHER CONTEXT DATA
    // ============================================
    // Ambil data konteks toko secara parallel untuk performa optimal
    const [productStats, lowStockProducts, todaySales, recentTransactions] =
      await Promise.all([
        // Total produk aktif di database
        prisma.product.count({ where: { isActive: true } }),

        // Produk dengan stok menipis (≤10 unit)
        prisma.product.findMany({
          where: {
            isActive: true,
            stock: { lte: 10 },
          },
          select: { name: true, stock: true },
          orderBy: { stock: "asc" },
          take: 5,
        }),

        // Agregasi penjualan hari ini
        prisma.transaction.aggregate({
          where: {
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
            },
            status: "completed",
          },
          _sum: { total: true },
          _count: true,
        }),

        // 3 transaksi terakhir yang berhasil
        prisma.transaction.findMany({
          where: { status: "completed" },
          orderBy: { createdAt: "desc" },
          take: 3,
          select: {
            invoiceNumber: true,
            total: true,
            paymentMethod: true,
            createdAt: true,
          },
        }),
      ]);

    // ============================================
    // 4. FORMAT CONTEXT FOR AI
    // ============================================
    // Format konteks dalam bentuk yang mudah dibaca AI
    const contextData = `
📊 STATUS TOKO SAAT INI:
• Total produk aktif: ${productStats}
• Penjualan hari ini: ${formatCurrency(todaySales._sum.total || 0)} (${
      todaySales._count
    } transaksi)

⚠️ STOK MENIPIS:
${
  lowStockProducts.length > 0
    ? lowStockProducts.map((p) => `• ${p.name}: ${p.stock} unit`).join("\n")
    : "• Semua stok aman!"
}

🧾 TRANSAKSI TERAKHIR:
${recentTransactions
  .map(
    (t) =>
      `• ${t.invoiceNumber}: ${formatCurrency(t.total)} (${t.paymentMethod})`,
  )
  .join("\n")}
    `.trim();

    // ============================================
    // 5. PREPARE MESSAGES FOR AGENT
    // ============================================
    // Agent expects messages dalam format standar
    const allMessages = messages.map((msg: { role: string; content: string }) => ({
      role: msg.role,
      content: msg.content,
    }));

    // ============================================
    // 6. GET CURRENT DATE
    // ============================================
    // Format tanggal untuk konteks AI
    const currentDate = new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    // ============================================
    // 7. CREATE AGENT
    // ============================================
    // Create system prompt dengan context
    const systemPrompt = POS_ASSISTANT_SYSTEM_PROMPT.replace(
      "{context}",
      contextData,
    ).replace("{currentDate}", currentDate);

    // Create agent dengan tools
    const agent = createPosAgent(systemPrompt);

    // ============================================
    // 8. CREATE STREAMING RESPONSE WITH TIMEOUT
    // ============================================
    const encoder = new TextEncoder(); // Encoder untuk mengubah string ke Uint8Array

    // Buat ReadableStream untuk streaming response
    const stream = new ReadableStream({
      async start(controller) {
        /**
         * Helper function untuk safely enqueue data
         * Check apakah controller masih terbuka sebelum enqueue
         */
        const safeEnqueue = (data: string) => {
          try {
            // Check desiredSize untuk memastikan stream masih terbuka
            // desiredSize = null artinya stream sudah closed
            if (controller.desiredSize !== null) {
              controller.enqueue(encoder.encode(data));
              return true;
            }
            return false;
          } catch {
            // Catch any enqueue errors (stream closed, etc)
            console.log("[Stream] Enqueue failed - stream likely closed");
            return false;
          }
        };

        try {
          // ---- Setup timeout promise ----
          /**
           * Create promise yang reject setelah LLM_TIMEOUT
           * Digunakan dengan Promise.race untuk enforce timeout
           */
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
              reject(new Error("Request timeout")); // Reject setelah timeout
            }, LLM_TIMEOUT);
          });

          // ---- Race: Agent stream vs timeout ----
          /**
           * Promise.race: Return first promise yang settle (resolve/reject)
           * Jika Agent stream selesai duluan = success
           * Jika timeout duluan = error
           *
           * streamEvents() memberikan token-by-token streaming seperti ChatGPT
           * - on_chat_model_stream: Token dari LLM (streaming text)
           * - on_tool_start: Tool mulai dieksekusi
           * - on_tool_end: Tool selesai dengan result
           */
          const streamResponse = await Promise.race([
            agent.streamEvents(
              { messages: allMessages },
              {
                version: "v2", // Gunakan v2 untuk fitur streaming terbaru
                streamMode: "values", // Stream event values only
              },
            ),
            timeoutPromise, // Timeout guard
          ]);

          let isToolCalling = false;
          let accumulatedContent = "";

          // ---- Iterate melalui events dari stream ----
          for await (const event of streamResponse) {
            // Debug log untuk melihat event types (comment out di production)
            // console.log("[Stream Event]", event.event, event.name);

            // ============================================
            // EVENT 1: TOOL START
            // ============================================
            if (event.event === "on_tool_start") {
              isToolCalling = true;
              const toolName = event.name;

              // Send feedback bahwa tool sedang dijalankan dengan emoji spesifik
              const toolStartMsg =
                toolName === "search_products"
                  ? "🔍 Mencari produk..."
                  : toolName === "check_stock"
                    ? "📦 Mengecek stok..."
                    : toolName === "calculate_discount"
                      ? "🧮 Menghitung diskon..."
                      : toolName === "get_sales_summary"
                        ? "📊 Mengambil data penjualan..."
                        : toolName === "get_payment_methods_breakdown"
                          ? "💳 Menganalisis metode pembayaran..."
                          : "⚙️ Memproses...";

              const success = safeEnqueue(
                `data: ${JSON.stringify({ type: "content", content: toolStartMsg })}\n\n`,
              );
              if (!success) break;
            }

            // ============================================
            // EVENT 2: TOOL END
            // ============================================
            else if (event.event === "on_tool_end") {
              isToolCalling = false;
              // Tool selesai, result akan masuk ke LLM untuk diformat
            }

            // ============================================
            // EVENT 3: CHAT MODEL STREAM (Token streaming)
            // ============================================
            else if (event.event === "on_chat_model_stream") {
              // Skip jika sedang tool calling (avoid duplicate output)
              if (isToolCalling) continue;

              const chunk = event.data?.chunk;

              if (chunk?.content) {
                // Extract token dari chunk
                let token = "";

                if (typeof chunk.content === "string") {
                  token = chunk.content;
                } else if (Array.isArray(chunk.content)) {
                  // Handle content array (some models return array)
                  token = chunk.content
                    .filter(
                      (c: unknown) => typeof c === "string" || (c !== null && typeof c === "object" && (c as { type?: string }).type === "text"),
                    )
                    .map((c: unknown) => (typeof c === "string" ? c : (c as { text: string }).text))
                    .join("");
                }

                if (token) {
                  // Accumulate content untuk final message
                  accumulatedContent += token;

                  // Stream token ke client (REAL-TIME seperti ChatGPT!)
                  const data = JSON.stringify({
                    type: "content",
                    content: token, // Send token incrementally
                  });

                  const success = safeEnqueue(`data: ${data}\n\n`);
                  if (!success) {
                    console.log(
                      "[Stream] Client disconnected, stopping stream",
                    );
                    break;
                  }
                }
              }
            }

            // ============================================
            // EVENT 4: CHAIN END (Optional completion signal)
            // ============================================
            else if (event.event === "on_chain_end") {
              // Chain complete, semua processing selesai
              console.log("[Stream] Chain completed");
            }
          }

          // ---- Kirim signal completion ----
          // Only jika stream masih terbuka
          safeEnqueue(`data: ${JSON.stringify({ type: "done" })}\n\n`);

          // Log accumulated content length untuk monitoring
          console.log(
            `[Stream] Completed - Total content length: ${accumulatedContent.length} chars`,
          );
        } catch (error) {
          console.error("Agent streaming error:", error);

          // ---- Determine error type ----
          let errorMessage = "Terjadi kesalahan";
          let errorDetails = "";

          if (error instanceof Error) {
            // Timeout error
            if (error.message === "Request timeout") {
              errorMessage =
                "Maaf, permintaan terlalu lama. Coba lagi dengan pertanyaan yang lebih sederhana. ⏱️";
              errorDetails = `Timeout setelah ${LLM_TIMEOUT / 1000} detik`;
              console.warn(`[Timeout] Request timeout for IP ${ip}`);
            }
            // Network/API error
            else if (error.message.includes("fetch")) {
              errorMessage =
                "Koneksi ke AI gagal. Periksa koneksi internet kamu. 🌐";
              errorDetails = error.message;
            }
            // Rate limit from OpenRouter
            else if (error.message.includes("429")) {
              errorMessage =
                "AI sedang sibuk. Tunggu sebentar dan coba lagi ya. 😊";
              errorDetails = "OpenRouter rate limit";
            }
            // Generic error
            else {
              errorMessage = "Terjadi kesalahan. Silakan coba lagi. 🔄";
              errorDetails = error.message;
            }
          }

          // Log error untuk debugging (production monitoring)
          console.error("[Chat Error]", {
            ip,
            error: errorDetails,
            timestamp: new Date().toISOString(),
          });

          // ---- Kirim error message ke client ----
          // Only jika stream masih terbuka
          safeEnqueue(
            `data: ${JSON.stringify({
              type: "error",
              error: errorMessage,
            })}\n\n`,
          );
        } finally {
          // ---- Cleanup: Tutup stream ----
          // Check dulu apakah sudah closed untuk avoid error
          try {
            if (controller.desiredSize !== null) {
              controller.close();
            }
          } catch {
            // Stream sudah closed, ignore error
            console.log("[Stream] Controller already closed");
          }
        }
      },
    });

    // ============================================
    // 9. RETURN STREAMING RESPONSE
    // ============================================
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream", // SSE (Server-Sent Events)
        "Cache-Control": "no-cache, no-transform", // Disable caching
        Connection: "keep-alive", // Keep connection open
        "X-Accel-Buffering": "no", // Disable nginx buffering
      },
    });
  } catch (error) {
    // ============================================
    // 10. GLOBAL ERROR HANDLING
    // ============================================
    /**
     * Catch-all untuk errors yang tidak di-handle di dalam try block
     * Biasanya untuk:
     * - JSON parsing errors
     * - Database connection errors
     * - Unexpected runtime errors
     */
    console.error("Chat API critical error:", error);

    // Determine status code berdasarkan error type
    let statusCode = 500; // Default: Internal Server Error
    let errorMessage =
      "Terjadi kesalahan server. Tim kami akan segera memperbaikinya. 🔧";

    if (error instanceof SyntaxError) {
      // JSON parsing error
      statusCode = 400;
      errorMessage = "Format request tidak valid. Periksa data yang dikirim.";
    } else if (error instanceof TypeError) {
      // Type error (null/undefined access)
      statusCode = 400;
      errorMessage = "Data request tidak lengkap atau tidak valid.";
    }

    // Log untuk monitoring/debugging
    console.error("[Critical Error]", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        error: errorMessage,
        // Hanya include details di development
        ...(process.env.NODE_ENV === "development" && {
          details: error instanceof Error ? error.message : String(error),
        }),
      }),
      {
        status: statusCode,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
