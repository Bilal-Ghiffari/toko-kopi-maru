# 🔧 Troubleshooting - OpenRouter API Issues

## Error: "401 No cookie auth credentials found"

### Penyebab

LangChain's ChatOpenAI perlu konfigurasi khusus untuk OpenRouter.

### Solusi yang Sudah Diimplementasikan

Kode di `src/lib/ai/langchain.ts` sudah diperbaiki dengan:

```typescript
// API key diset di configuration.apiKey, bukan openAIApiKey
configuration: {
  baseURL: providerConfig.baseURL,
  apiKey: providerConfig.apiKey, // ← Key point!
  defaultHeaders: {
    "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
    "X-Title": "Kasir AI",
  },
}
```

### Checklist Debugging

Jika masih error, cek hal berikut:

#### 1. **Verify .env.local**

```bash
# Pastikan file ada
ls -la .env.local

# Cek isi (masked)
cat .env.local | grep "OPENROUTER_API_KEY"
```

Expected output:

```
OPENROUTER_API_KEY=sk-or-v1-xxxxxxxxxxxxx
```

#### 2. **Verify API Key Format**

```bash
# First 10 chars harus: sk-or-v1-
cat .env.local | grep "OPENROUTER_API_KEY" | cut -d'=' -f2 | head -c 10
```

Expected: `sk-or-v1-`

#### 3. **Restart Next.js Completely**

```bash
# Kill all node processes
pkill -9 node

# Clear Next.js cache
rm -rf .next

# Restart
npm run dev
```

#### 4. **Test API Key Directly**

```bash
# Test dengan curl
curl https://openrouter.ai/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat .env.local | grep OPENROUTER_API_KEY | cut -d'=' -f2)" \
  -d '{
    "model": "x-ai/grok-4.1-fast",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

Expected: JSON response dengan `choices` array

#### 5. **Check Environment Variables Loading**

Add temporary debug di route:

```typescript
// src/app/api/test-ai/route.ts
export async function GET() {
  console.log("🔍 Debug ENV:", {
    hasOpenRouterKey: !!process.env.OPENROUTER_API_KEY,
    keyPreview: process.env.OPENROUTER_API_KEY?.substring(0, 10) + "...",
  });
  // ... rest of code
}
```

#### 6. **Verify Port & Process**

```bash
# Check if old process still running
lsof -ti:3000

# Kill if needed
lsof -ti:3000 | xargs kill -9
```

## Common Issues

### Issue 1: API Key Not Loading in Production

**Problem:** Environment variables not loaded in production build

**Solution:**

- Vercel/Netlify: Add `OPENROUTER_API_KEY` di dashboard settings
- Docker: Pass via `--env` atau `docker-compose.yml`
- PM2: Use `ecosystem.config.js` dengan env vars

### Issue 2: CORS Error

**Problem:** OpenRouter rejects requests from unauthorized origins

**Solution:**
Already handled dengan `HTTP-Referer` header:

```typescript
defaultHeaders: {
  "HTTP-Referer": process.env.APP_URL || "http://localhost:3000",
  "X-Title": "Kasir AI",
}
```

Set `APP_URL` di `.env.local`:

```bash
APP_URL=http://localhost:3000
# atau production URL
APP_URL=https://yourdomain.com
```

### Issue 3: Rate Limit (429)

**Problem:** Free tier limit: 60 req/min

**Solution:**

1. Add credits: https://openrouter.ai/settings/credits
2. Implement rate limiting di app
3. Add exponential backoff retry

### Issue 4: Model Not Found (404)

**Problem:** Model name salah

**Solution:** Pastikan format: `x-ai/grok-4.1-fast` (bukan `grok-beta`)

```typescript
// ✅ Correct
"x-ai/grok-4.1-fast";

// ❌ Wrong
"grok-4.1-fast";
"grok-beta";
```

## Testing Tools

### 1. Quick Test Script

```bash
# Create test file
cat > test-api.sh << 'EOF'
#!/bin/bash
source .env.local
curl -X GET http://localhost:3000/api/test-ai | jq
EOF

chmod +x test-api.sh
./test-api.sh
```

### 2. Node.js Test

```javascript
// test-openrouter.js already created
node test-openrouter.js
```

### 3. Check Logs

```bash
# Terminal yang running npm run dev
# Look for:
# 🤖 AI Provider: GROK | Model: x-ai/grok-4.1-fast
# 🔑 API Key: ✅ Found
```

## Still Not Working?

### Option 1: Fallback to OpenAI

```bash
# .env.local
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

### Option 2: Use Different Model

```typescript
// Try simpler model first
models: {
  fast: "openai/gpt-3.5-turbo", // OpenRouter format untuk GPT-3.5
  accurate: "x-ai/grok-4",
}
```

### Option 3: Check OpenRouter Status

- https://status.openrouter.ai/
- https://openrouter.ai/activity (your usage dashboard)

## Getting Help

1. **Check OpenRouter Docs:** https://openrouter.ai/docs
2. **Discord:** https://discord.gg/fVyRaUDgxW
3. **GitHub Issues:** Report bugs di repo OpenRouter
4. **Check this file:** Always updated with latest solutions

## Success Indicators

✅ Server log shows:

```
🤖 AI Provider: GROK | Model: x-ai/grok-4.1-fast
🔑 API Key: ✅ Found
🔍 Key Preview: sk-or-v1-...1234
```

✅ API response:

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
  "aiResponse": "..."
}
```
