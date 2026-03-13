# 🤖 Setup AI Provider - Grok via OpenRouter

## 📋 Overview

Aplikasi ini mendukung **multi-provider AI** dengan fallback mechanism:

- **Grok** (xAI via OpenRouter) - Default, lebih cepat & murah
- **OpenAI** (GPT) - Fallback atau manual selection

## 🚀 Quick Start

### 1. Dapatkan API Key

#### Option A: OpenRouter (Recommended - untuk Grok)

1. Kunjungi [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
2. Sign up / Login (support Google, GitHub)
3. Click "Create Key"
4. Copy API key (format: `sk-or-v1-...`)

**Free Tier:**

- 60 requests/minute
- $0.20/M input tokens untuk Grok 4.1 Fast
- $0.50/M output tokens

#### Option B: OpenAI (Fallback)

1. Kunjungi [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Login / Sign up
3. Create new secret key
4. Copy API key (format: `sk-...`)

### 2. Setup Environment Variables

Buat file `.env.local` di root project:

```bash
# Pilih provider: "grok" atau "openai"
AI_PROVIDER=grok

# OpenRouter API Key (untuk akses Grok models)
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# OpenAI API Key (optional, untuk fallback)
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Database (sudah ada)
DATABASE_URL=postgresql://user:password@localhost:5432/kasir_db
```

### 3. Test Koneksi

```bash
# Restart development server
npm run dev

# Test endpoint
curl http://localhost:3000/api/test-ai
```

Response yang diharapkan:

```json
{
  "status": "ok",
  "message": "LangChain is working!",
  "provider": {
    "provider": "grok",
    "model": "x-ai/grok-4.1-fast",
    "hasApiKey": true,
    "baseURL": "https://openrouter.ai/api/v1"
  },
  "aiResponse": "Sistem kasir berfungsi untuk mencatat transaksi..."
}
```

## 🏗️ Architecture

### Model Instances

Aplikasi menyediakan 4 model instances:

1. **`llm`** - General tasks

   - Model: Grok 4.1 Fast / GPT-4o-mini
   - Temperature: 0.3
   - Use case: Chat, pencarian produk

2. **`llmHighAccuracy`** - Akurasi tinggi

   - Model: Grok 4 / GPT-4o
   - Temperature: 0
   - Use case: Parsing structured data

3. **`llmStreaming`** - Streaming responses

   - Model: Grok 4.1 Fast / GPT-4o-mini
   - Streaming: true
   - Use case: Chat interface

4. **`llmAnalytics`** - Analytics kompleks
   - Model: Grok 4.1 Fast / GPT-4o-mini
   - Temperature: 0.2
   - Use case: Sales analytics

### Fallback Mechanism

```
1. Coba provider yang dipilih (AI_PROVIDER)
   ↓
2. Jika API key tidak ada → Fallback ke OpenAI
   ↓
3. Jika OpenAI API key juga tidak ada → Throw error
```

### Provider Configuration

```typescript
const PROVIDER_CONFIG = {
  grok: {
    baseURL: "https://openrouter.ai/api/v1",
    models: {
      fast: "x-ai/grok-4.1-fast",
      accurate: "x-ai/grok-4",
    },
  },
  openai: {
    baseURL: "https://api.openai.com/v1",
    models: {
      fast: "gpt-4o-mini",
      accurate: "gpt-4o",
    },
  },
};
```

## 🔧 Configuration

### Switch Provider

Di `.env.local`:

```bash
# Gunakan Grok
AI_PROVIDER=grok

# ATAU gunakan OpenAI
AI_PROVIDER=openai
```

### Custom Model

Edit `src/lib/ai/langchain.ts`:

```typescript
const PROVIDER_CONFIG = {
  grok: {
    models: {
      fast: "x-ai/grok-4.1-fast",
      accurate: "x-ai/grok-4", // Ganti sesuai kebutuhan
      // Opsi lain: "x-ai/grok-3", "x-ai/grok-code-fast-1"
    },
  },
};
```

**Model Options via OpenRouter:**

- `x-ai/grok-4.1-fast` - Fastest & cheapest (recommended)
- `x-ai/grok-4-fast` - Multimodal with reasoning
- `x-ai/grok-4` - Most accurate (256k context)
- `x-ai/grok-code-fast-1` - Best for coding tasks
- `x-ai/grok-3` - Previous flagship model

Lihat semua model: [openrouter.ai/x-ai](https://openrouter.ai/x-ai)

## 📊 Cost Comparison

| Provider          | Model            | Input (per 1M tokens) | Output (per 1M tokens) | Speed  |
| ----------------- | ---------------- | --------------------- | ---------------------- | ------ |
| Grok (OpenRouter) | grok-4.1-fast    | $0.20                 | $0.50                  | ⚡⚡⚡ |
| Grok (OpenRouter) | grok-4           | $0.60                 | $1.50                  | ⚡⚡   |
| Grok (OpenRouter) | grok-code-fast-1 | $0.20                 | $0.50                  | ⚡⚡⚡ |
| OpenAI            | gpt-4o-mini      | $0.15                 | $0.60                  | ⚡⚡   |
| OpenAI            | gpt-4o           | $2.50                 | $10.00                 | ⚡     |

**💰 Cost Example (1000 requests, ~500 tokens each):**

- Grok 4.1 Fast: ~$0.35 (0.5M tokens × $0.70)
- GPT-4o-mini: ~$0.37 (0.5M tokens × $0.75)
- GPT-4o: ~$6.25 (0.5M tokens × $12.50)

**Rekomendasi:** Grok 4.1 Fast via OpenRouter untuk best value

## 🐛 Troubleshooting

### Error: 429 Rate Limit

**OpenRouter (Grok):**

- Free tier: 60 requests/minute
- Solusi:
  - Tambahkan payment method di [openrouter.ai/settings/credits](https://openrouter.ai/settings/credits)
  - Atau tambahkan delay antar request
  - Atau implement rate limiting

**OpenAI:**

- Cek usage di [platform.openai.com/usage](https://platform.openai.com/usage)
- Tambahkan payment method

### Error: API Key Not Found

Cek file `.env.local`:

```bash
# Pastikan ada salah satu
OPENROUTER_API_KEY=sk-or-v1-...
# ATAU
OPENAI_API_KEY=sk-...
```

Restart server:

```bash
npm run dev
```

### Error: Invalid API Key

- OpenRouter: Pastikan key format `sk-or-v1-...`
- OpenAI: Pastikan key format `sk-...`
- Regenerate key jika perlu

### Error: Model Not Found

Pastikan model name benar:

```typescript
// ✅ Correct (OpenRouter format)
"x-ai/grok-4.1-fast";

// ❌ Wrong (direct xAI format)
"grok-beta";
```

## 📚 Usage Examples

### Basic Chat

```typescript
import { llm } from "@/lib/ai/langchain";

const response = await llm.invoke("Halo, apa kabar?");
console.log(response.content);
```

### With Tools

```typescript
import { llm } from "@/lib/ai/langchain";
import { allPosTools } from "@/lib/ai/tools";

const llmWithTools = llm.bind({ tools: allPosTools });
const response = await llmWithTools.invoke("Cari produk kopi");
```

### Streaming

```typescript
import { llmStreaming } from "@/lib/ai/langchain";

const stream = await llmStreaming.stream("Ceritakan tentang kopi");
for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

## 🔍 Debug

Check provider info:

```typescript
import { getProviderInfo } from "@/lib/ai/langchain";

const info = getProviderInfo();
console.log(info);
// {
//   provider: "grok",
//   model: "grok-beta",
//   hasApiKey: true,
//   baseURL: "https://api.x.ai/v1"
// }
```

## 📖 References

- [OpenRouter](https://openrouter.ai/) - Unified AI API Gateway
- [OpenRouter Docs](https://openrouter.ai/docs) - Documentation
- [Grok Models](https://openrouter.ai/x-ai) - xAI models on OpenRouter
- [LangChain Docs](https://js.langchain.com/docs/) - LangChain JS
- [OpenAI Platform](https://platform.openai.com/) - OpenAI API

## 💡 Best Practices

1. **Use Grok 4.1 Fast via OpenRouter** - Best cost/performance ratio
2. **Set OpenAI fallback** - For production reliability
3. **Monitor usage** - Check [openrouter.ai/activity](https://openrouter.ai/activity)
4. **Use appropriate model** - Fast untuk chat, Accurate untuk parsing
5. **Handle rate limits** - Implement retry logic with exponential backoff
6. **Log provider info** - Auto-logged in dev mode
7. **Test both providers** - Ensure fallback works
8. **Set HTTP referer** - Optional but helps with OpenRouter analytics

## 🎯 Next Steps

1. ✅ Setup API keys
2. ✅ Test endpoint `/api/test-ai`
3. ✅ Verify logs di terminal
4. 🔄 Test semua endpoints:
   - `/api/chat`
   - `/api/search`
   - `/api/analytics`
5. 🚀 Deploy ke production dengan OpenAI fallback
