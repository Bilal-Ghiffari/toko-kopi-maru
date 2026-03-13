# Quick Start - AI Agent dengan Tools

## Setup

### 1. Install Dependencies
```bash
npm install @langchain/langgraph
```

### 2. Environment Variables
```bash
# .env atau .env.local
DATABASE_URL="postgresql://postgres:secret@localhost:5432/kasir_digital"
OPENROUTER_API_KEY="sk-or-v1-your-key-here"
NODE_ENV="development"
```

### 3. Run Development
```bash
# Start database
docker compose up -d postgres

# Run dev server
npm run dev
```

## Testing AI Agent

### Test 1: Search Products
```
USER: "Cari produk kopi"
EXPECTED: AI uses search_products tool, returns list of coffee products
```

### Test 2: Check Stock
```
USER: "Produk apa yang stoknya hampir habis?"
EXPECTED: AI uses check_stock tool dengan checkLowStock=true
```

### Test 3: Calculate Discount
```
USER: "Hitungin diskon 15% untuk belanja 200ribu"
EXPECTED: AI uses calculate_discount tool, shows breakdown
```

### Test 4: Sales Summary
```
USER: "Gimana penjualan hari ini?"
EXPECTED: AI uses get_sales_summary tool dengan period="today"
```

### Test 5: Payment Methods
```
USER: "Metode pembayaran apa yang paling laris hari ini?"
EXPECTED: AI uses get_payment_methods_breakdown tool
```

### Test 6: Multi-Tool Chain
```
USER: "Cari kopi dibawah 50rb dan cek stoknya"
EXPECTED: AI chains search_products → check_stock
```

## API Endpoint

### POST /api/chat

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Cari produk kopi" }
  ]
}
```

**Response:** (Server-Sent Events)
```
data: {"type":"content","content":"Baik"}
data: {"type":"content","content":", saya"}
data: {"type":"content","content":" akan"}
data: {"type":"content","content":" mencari"}
...
data: {"type":"done"}
```

## File Structure

```
src/
├── lib/
│   └── ai/
│       ├── langchain.ts      # Agent & model config
│       ├── tools.ts          # 5 POS tools
│       ├── prompts.ts        # System prompts
│       └── cache.ts          # Response caching
├── app/
│   └── api/
│       └── chat/
│           └── route.ts      # Chat endpoint with agent
└── components/
    └── pos/
        └── AIAssistant.tsx   # UI component
```

## Debugging

### Check Tools Loaded
```bash
# Terminal output saat start
🤖 AI Provider: OpenRouter | Model: openai/gpt-4o-mini
🔑 API Key: ✅ Found
🛠️  Tools: 5 tools loaded
```

### Enable Debug Logs
```typescript
// In langchain.ts or route.ts
console.log("🚀 Agent input:", { messages, systemPrompt });
console.log("🤖 Agent output:", chunk);
console.log("🛠️  Tool called:", toolName, toolArgs);
```

### Check Errors
```bash
# In terminal
npm run dev

# Watch for errors:
# [Rate Limit] ...
# [Validation] ...
# [Chat Error] ...
```

## Common Issues

### Issue 1: "OPENROUTER_API_KEY not found"
```bash
# Solution: Add to .env
OPENROUTER_API_KEY="sk-or-v1-your-key"
```

### Issue 2: Database connection error
```bash
# Solution: Start postgres
docker compose up -d postgres

# Check connection
npm run db:studio
```

### Issue 3: Tools not being called
```
# Check system prompt clarity
# Make sure descriptions are specific
# Example in prompts.ts:
"search_products - Cari produk berdasarkan nama, kategori, atau harga"
```

### Issue 4: Streaming not working
```
# Check headers in response:
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

## Performance Tips

1. **Rate Limiting**: Default 20 req/min
   ```typescript
   // Adjust in rate-limit.ts
   const chatLimiter = new RateLimiter({
     interval: 60000,
     maxRequests: 50, // Increase for production
   });
   ```

2. **Timeout**: Default 30s
   ```typescript
   // Adjust in route.ts
   const LLM_TIMEOUT = 60 * 1000; // 60 seconds
   ```

3. **Context Size**: Limit conversation history
   ```typescript
   // Already implemented
   const MAX_MESSAGES_HISTORY = 50;
   ```

## Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use production DATABASE_URL
- [ ] Enable error monitoring (Sentry)
- [ ] Setup Redis for rate limiting
- [ ] Configure CORS if needed
- [ ] Enable compression
- [ ] Setup CDN for assets
- [ ] Configure load balancer
- [ ] Setup SSL certificate
- [ ] Enable logging (CloudWatch)

## Monitoring Commands

```bash
# Check API health
curl http://localhost:3000/api/health

# Test chat endpoint
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Halo"}]}'

# Check database
npm run db:studio

# Check logs
docker compose logs -f app
```

## Next Steps

1. **Add More Tools** - Create new tools di [tools.ts](src/lib/ai/tools.ts)
2. **Improve Prompts** - Update [prompts.ts](src/lib/ai/prompts.ts)
3. **Add Caching** - Implement response caching
4. **Add Analytics** - Track tool usage, response time
5. **Add Tests** - Unit tests untuk tools
6. **Deploy** - Deploy to Vercel/Railway/AWS

## Resources

- 📚 [AI_AGENT_BEST_PRACTICES.md](AI_AGENT_BEST_PRACTICES.md) - Detailed best practices
- 📚 [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- 📚 [OpenRouter Models](https://openrouter.ai/models)
- 📚 [Next.js Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)

## Support

Jika ada masalah, check:
1. Terminal logs (npm run dev)
2. Browser console
3. Network tab (streaming response)
4. Database (npm run db:studio)
5. [TROUBLESHOOTING.md](TROUBLESHOOTING.md)

Happy coding! 🚀
