# 🚀 Quick Reference - Grok via OpenRouter

## Setup (1 minute)

```bash
# 1. Get API key
https://openrouter.ai/settings/keys

# 2. Add to .env.local
echo "AI_PROVIDER=grok" >> .env.local
echo "OPENROUTER_API_KEY=sk-or-v1-your-key" >> .env.local

# 3. Restart
npm run dev

# 4. Test
curl http://localhost:3000/api/test-ai
```

## Available Models

| Model          | Code                    | Cost/1M       | Best For             |
| -------------- | ----------------------- | ------------- | -------------------- |
| Grok 4.1 Fast  | `x-ai/grok-4.1-fast`    | $0.20 / $0.50 | General chat, search |
| Grok 4         | `x-ai/grok-4`           | $0.60 / $1.50 | Complex reasoning    |
| Grok Code Fast | `x-ai/grok-code-fast-1` | $0.20 / $0.50 | Coding tasks         |
| Grok 3         | `x-ai/grok-3`           | $1.00 / $2.50 | Enterprise use cases |

## Usage Examples

### Basic

```typescript
import { llm } from "@/lib/ai/langchain";

const response = await llm.invoke("Halo!");
console.log(response.content);
```

### With Streaming

```typescript
import { llmStreaming } from "@/lib/ai/langchain";

const stream = await llmStreaming.stream("Ceritakan tentang kopi");
for await (const chunk of stream) {
  process.stdout.write(chunk.content);
}
```

### Check Provider

```typescript
import { getProviderInfo } from "@/lib/ai/langchain";

const info = getProviderInfo();
console.log(info);
// { provider: "grok", model: "x-ai/grok-4.1-fast", ... }
```

## Switch Provider

```bash
# Use Grok (via OpenRouter)
AI_PROVIDER=grok
OPENROUTER_API_KEY=sk-or-v1-...

# Use OpenAI
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

## Troubleshooting

| Error              | Solution                                                                              |
| ------------------ | ------------------------------------------------------------------------------------- |
| 429 Rate Limit     | Add credits: [openrouter.ai/settings/credits](https://openrouter.ai/settings/credits) |
| API Key Missing    | Check `.env.local` has `OPENROUTER_API_KEY`                                           |
| Model Not Found    | Use format: `x-ai/grok-4.1-fast` (not `grok-beta`)                                    |
| Fallback to OpenAI | Expected if `OPENROUTER_API_KEY` missing                                              |

## Free Tier Limits

- **Requests:** 60/minute
- **Context:** Up to 2M tokens (Grok 4.1 Fast)
- **No credit card required**

## Links

- Get API Key: [openrouter.ai/settings/keys](https://openrouter.ai/settings/keys)
- View Usage: [openrouter.ai/activity](https://openrouter.ai/activity)
- Add Credits: [openrouter.ai/settings/credits](https://openrouter.ai/settings/credits)
- Model List: [openrouter.ai/x-ai](https://openrouter.ai/x-ai)

## Cost Calculator

```
1000 requests × 500 tokens avg = 500K tokens total

Grok 4.1 Fast:
  Input:  250K × $0.20 = $0.05
  Output: 250K × $0.50 = $0.125
  Total: ~$0.18

vs GPT-4o:
  Input:  250K × $2.50 = $0.625
  Output: 250K × $10 = $2.50
  Total: ~$3.13

Savings: 94% cheaper! 💰
```
