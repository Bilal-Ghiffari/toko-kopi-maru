import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain";
import { allPosTools } from "./tools";

// ======================
// CONFIGURATION TYPES
// ======================

// Interface untuk konfigurasi model LLM
interface ModelConfig {
  model: string; // Nama model yang akan digunakan
  temperature: number; // Tingkat kreativitas (0 = deterministik, 1 = sangat kreatif)
  maxTokens: number; // Batas maksimal token output
  streaming?: boolean; // Apakah response di-stream secara real-time
}

// ======================
// ENVIRONMENT CONFIGURATION
// ======================

/**
 * Konfigurasi OpenRouter dengan GPT-4o-mini
 * Model: openai/gpt-4o-mini
 * Pricing: $0.15/M input tokens, $0.60/M output tokens
 * Cocok untuk: general tasks, chat, parsing, analytics
 */
const OPENROUTER_CONFIG = {
  baseURL: "https://openrouter.ai/api/v1", // Base URL OpenRouter API
  apiKey: process.env.OPENROUTER_API_KEY, // API key dari environment variable
  model: "openai/gpt-4o-mini", // Model GPT-4o-mini via OpenRouter
};

// ======================
// MODEL FACTORY
// ======================

/**
 * Factory function untuk membuat ChatModel instance dengan GPT-4o-mini
 *
 * @param config - Konfigurasi model (temperature, maxTokens, streaming)
 * @returns ChatModel instance yang siap digunakan
 * @throws Error jika OPENROUTER_API_KEY tidak ditemukan
 */
function createChatModel(config: ModelConfig): ChatOpenAI {
  // Validasi: Pastikan API key tersedia
  if (!OPENROUTER_CONFIG.apiKey) {
    throw new Error("❌ OPENROUTER_API_KEY tidak ditemukan! Set di .env.local");
  }

  // Buat instance ChatOpenAI dengan konfigurasi OpenRouter
  return new ChatOpenAI({
    ...config, // Spread config: temperature, maxTokens, streaming
    model: OPENROUTER_CONFIG.model, // Set model ke openai/gpt-4o-mini
    configuration: {
      baseURL: OPENROUTER_CONFIG.baseURL, // OpenRouter API endpoint
      apiKey: OPENROUTER_CONFIG.apiKey, // API key untuk autentikasi
      defaultHeaders: {
        "HTTP-Referer": process.env.APP_URL || "http://localhost:3000", // Referer untuk OpenRouter
        "X-Title": "Kasir AI", // Identifikasi aplikasi
      },
    },
  });
}

// ======================
// MODEL INSTANCES
// ======================

/**
 * Model utama untuk general tasks
 * - Model: GPT-4o-mini via OpenRouter
 * - temperature 0.3: sedikit kreatif tapi tetap konsisten
 * - maxTokens 1000: cukup untuk response standar
 * - Use case: chat biasa, pencarian produk, kalkulasi sederhana
 */
export const llm = createChatModel({
  model: "", // akan di-set otomatis ke openai/gpt-4o-mini
  temperature: 0.3,
  maxTokens: 1000,
});

/**
 * Model untuk tasks yang butuh akurasi tinggi
 * - Model: GPT-4o-mini via OpenRouter
 * - temperature 0: deterministik, output selalu konsisten
 * - maxTokens 500: fokus pada response singkat dan akurat
 * - Use case: parsing structured data, keputusan penting, JSON output
 */
export const llmHighAccuracy = createChatModel({
  model: "", // akan di-set otomatis ke openai/gpt-4o-mini
  temperature: 0,
  maxTokens: 500,
});

/**
 * Model untuk streaming responses (chat)
 * - Model: GPT-4o-mini via OpenRouter
 * - streaming: true untuk real-time typing effect
 * - temperature 0.5: lebih kreatif untuk percakapan natural
 * - maxTokens 1500: cukup untuk response panjang dalam chat
 * - Use case: chat interface, conversational AI, customer support
 */
export const llmStreaming = createChatModel({
  model: "", // akan di-set otomatis ke openai/gpt-4o-mini
  temperature: 0.5,
  maxTokens: 1500,
  streaming: true,
});

/**
 * Model untuk analytics yang kompleks
 * - Model: GPT-4o-mini via OpenRouter
 * - temperature 0.2: balance antara creativity & consistency
 * - maxTokens 2000: cukup untuk analisis mendalam
 * - Use case: sales analytics, data insights, reports, visualisasi data
 */
export const llmAnalytics = createChatModel({
  model: "", // akan di-set otomatis ke openai/gpt-4o-mini
  temperature: 0.2,
  maxTokens: 2000,
});

// ======================
// UTILITY & DEBUG
// ======================

/**
 * Mendapatkan informasi provider dan model yang sedang digunakan
 * Berguna untuk debugging dan monitoring
 *
 * @returns Object berisi info provider, model, API key status, dan base URL
 */
export const getProviderInfo = () => ({
  provider: "OpenRouter", // Provider yang digunakan
  model: OPENROUTER_CONFIG.model, // Model yang digunakan (openai/gpt-4o-mini)
  hasApiKey: !!OPENROUTER_CONFIG.apiKey, // Status ketersediaan API key
  baseURL: OPENROUTER_CONFIG.baseURL, // Base URL API
});

// ======================
// AI AGENT
// ======================

/**
 * Create Agent dengan tools (menggunakan langchain createAgent)
 * 
 * Agent ini menggunakan ReAct pattern:
 * 1. Reasoning - Model berpikir tentang apa yang harus dilakukan
 * 2. Acting - Model memutuskan tool mana yang perlu dipanggil
 * 3. Observing - Model melihat hasil tool
 * 4. Loop - Ulangi sampai mendapat final answer
 * 
 * Best practices:
 * - System prompt harus clear dan spesifik
 * - Tools harus memiliki deskripsi yang jelas
 * - Handle errors dengan graceful
 * 
 * @param systemPrompt - System prompt yang menjelaskan role dan kapan gunakan tools
 * @returns Agent yang siap untuk invoke/stream
 */
export function createPosAgent(systemPrompt: string) {
  return createAgent({
    model: llmStreaming,
    tools: allPosTools,
    systemPrompt: systemPrompt,
  });
}

// Log provider info saat startup (hanya di development)
if (process.env.NODE_ENV === "development") {
  const info = getProviderInfo(); // Ambil info provider

  // Log provider dan model yang digunakan
  console.log(`\n🤖 AI Provider: ${info.provider} | Model: ${info.model}`);

  // Log status API key (tersedia atau tidak)
  console.log(`🔑 API Key: ${info.hasApiKey ? "✅ Found" : "❌ Missing"}`);

  // Log tools yang tersedia
  console.log(`🛠️  Tools: ${allPosTools.length} tools loaded`);

  // Debug: Tampilkan preview API key (7 karakter awal + 4 karakter akhir)
  if (info.hasApiKey) {
    const key = OPENROUTER_CONFIG.apiKey || ""; // Ambil API key
    const masked =
      key.length > 10
        ? `${key.substring(0, 7)}...${key.substring(key.length - 4)}` // Mask tengah
        : "***"; // Jika key terlalu pendek, mask semua
    console.log(`🔍 Key Preview: ${masked}`);
  }
  console.log(); // Baris kosong untuk readability
}
