# AI Agent Best Practices - Toko Kopi Maru

## Overview
AI Agent menggunakan **React Agent Pattern** dari LangGraph dengan 5 custom tools untuk operasional POS.

## Architecture

```
User Input 
    ↓
Rate Limiting (20 req/min)
    ↓
Input Validation & Sanitization
    ↓
Context Gathering (Database)
    ↓
React Agent (GPT-4o-mini)
    ├─→ search_products
    ├─→ check_stock
    ├─→ calculate_discount
    ├─→ get_sales_summary
    └─→ get_payment_methods_breakdown
    ↓
Response Streaming (SSE)
    ↓
User
```

## Best Practices Implemented

### 1. **Security First** 🔒

#### Rate Limiting
```typescript
// Global: 100 req/min untuk semua endpoints
// Chat: 20 req/min per IP
const rateLimitResult = await chatLimiter.check(ip);
```

#### Input Validation
```typescript
// Max message length
const MAX_MESSAGE_LENGTH = 1000;

// XSS Protection - REJECT suspicious patterns
const xssPatterns = [
  /<script\b/i,
  /javascript:/i,
  /on\w+\s*=/i,
  // ... more patterns
];
```

#### Timeout Protection
```typescript
const LLM_TIMEOUT = 30 * 1000; // 30 seconds max

await Promise.race([
  agent.stream({ messages }),
  timeoutPromise,
]);
```

### 2. **Agent Design** 🤖

#### React Agent Pattern
```typescript
export function createPosAgent(systemPrompt: string) {
  return createReactAgent({
    llm: llmStreaming,        // Streaming model
    tools: allPosTools,       // Array of 5 tools
    messageModifier: systemPrompt,  // System instructions
  });
}
```

**Kenapa React Agent?**
- ✅ Otomatis decide tool mana yang dipakai
- ✅ Bisa chain multiple tools
- ✅ Self-correcting (retry jika tool error)
- ✅ Better reasoning untuk complex queries

#### Clear System Prompt
```typescript
// ❌ BAD - Vague
"You are a helpful assistant"

// ✅ GOOD - Specific with examples
export const POS_ASSISTANT_SYSTEM_PROMPT = `
## TOOLS YANG TERSEDIA
1. search_products - Cari produk...
   Gunakan saat: "Cari kopi", "Produk kategori snack"

## CONTOH INTERAKSI
USER: "Cari produk kopi dibawah 30rb"
AI: [Gunakan search_products dengan category="Kopi", maxPrice=30000]
`;
```

### 3. **Tool Design** 🛠️

#### Tool Schema (Zod Validation)
```typescript
export const searchProductsTool = tool(
  async ({ query, category, minPrice, maxPrice, limit }) => {
    // Implementation...
  },
  {
    name: "search_products",
    description: "Cari produk berdasarkan keyword, kategori, atau range harga",
    schema: z.object({
      query: z.string().optional().describe("Kata kunci pencarian"),
      category: z.string().optional().describe("Filter kategori"),
      minPrice: z.number().optional().describe("Harga minimum"),
      maxPrice: z.number().optional().describe("Harga maksimum"),
      limit: z.number().optional().describe("Max hasil (default 10)"),
    }),
  }
);
```

**Tool Best Practices:**
1. ✅ Clear, descriptive names (`search_products` not `search`)
2. ✅ Detailed descriptions untuk AI understanding
3. ✅ Zod schema untuk type safety
4. ✅ All parameters documented
5. ✅ Return strings (human-readable)
6. ✅ Error handling dengan try-catch
7. ✅ User-friendly error messages

#### Tool Error Handling
```typescript
try {
  const products = await prisma.product.findMany({...});
  
  if (products.length === 0) {
    return "Tidak ditemukan produk yang sesuai.";
  }
  
  return formatResults(products);
} catch (error) {
  console.error("Error searching products:", error); // Log detail
  return "Terjadi kesalahan saat mencari produk."; // User-friendly
}
```

### 4. **Context Management** 📊

#### Gather Context Efficiently
```typescript
// ✅ GOOD - Parallel queries
const [productStats, lowStockProducts, todaySales] = await Promise.all([
  prisma.product.count({ where: { isActive: true } }),
  prisma.product.findMany({ where: { stock: { lte: 10 } } }),
  prisma.transaction.aggregate({ where: { ... } }),
]);

// ❌ BAD - Sequential (slow)
const productStats = await prisma.product.count(...);
const lowStockProducts = await prisma.product.findMany(...);
const todaySales = await prisma.transaction.aggregate(...);
```

#### Context Format
```typescript
const contextData = `
📊 STATUS TOKO:
• Total produk: ${productStats}
• Penjualan hari ini: Rp ${formatCurrency(todaySales._sum.total)}

⚠️ STOK MENIPIS:
${lowStockProducts.map(p => `• ${p.name}: ${p.stock} unit`).join('\n')}
`.trim();
```

**Why this format?**
- ✅ Emoji untuk visual clarity
- ✅ Bullet points untuk structure
- ✅ Formatted currency
- ✅ Easy for AI to parse

### 5. **Streaming Response** 📡

#### Server-Sent Events (SSE)
```typescript
const stream = new ReadableStream({
  async start(controller) {
    const safeEnqueue = (data: string) => {
      if (controller.desiredSize !== null) {
        controller.enqueue(encoder.encode(data));
        return true;
      }
      return false;
    };

    for await (const chunk of streamResponse) {
      if (chunk.agent?.messages) {
        const content = lastMessage.content;
        safeEnqueue(`data: ${JSON.stringify({ type: "content", content })}\n\n`);
      }
    }
    
    safeEnqueue(`data: ${JSON.stringify({ type: "done" })}\n\n`);
  },
});

return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  },
});
```

**Benefits:**
- ✅ Real-time typing effect
- ✅ Better UX (no waiting)
- ✅ Handle long responses
- ✅ Client can cancel anytime

### 6. **Error Handling** 🚨

#### Multi-Layer Error Handling
```typescript
// Layer 1: Tool-level
try {
  const result = await prisma.product.findMany(...);
  return formatResult(result);
} catch (error) {
  return "Terjadi kesalahan saat mencari produk.";
}

// Layer 2: Agent-level
try {
  const streamResponse = await agent.stream({ messages });
  // Process stream...
} catch (error) {
  if (error.message === "Request timeout") {
    errorMessage = "Permintaan terlalu lama. Coba lagi.";
  } else if (error.message.includes("429")) {
    errorMessage = "AI sedang sibuk. Tunggu sebentar.";
  }
  safeEnqueue(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`);
}

// Layer 3: Global error handler
catch (error) {
  console.error("Chat API critical error:", error);
  return new Response(JSON.stringify({ error: "Server error" }), { status: 500 });
}
```

### 7. **Performance Optimization** ⚡

#### Caching Strategy
```typescript
// In-memory cache untuk rate limiting
const tokenCache = new Map<string, { count: number; resetTime: number }>();

// Cleanup expired entries
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of tokenCache.entries()) {
    if (now > value.resetTime) {
      tokenCache.delete(key);
    }
  }
}, 10 * 60 * 1000); // Every 10 minutes
```

#### Database Query Optimization
```typescript
// ✅ Select only needed fields
const products = await prisma.product.findMany({
  select: { 
    name: true, 
    price: true, 
    stock: true,
    category: { select: { name: true } }
  },
  take: limit ?? 10,
  orderBy: { name: "asc" },
});

// ✅ Use pagination
take: limit ?? 10,

// ✅ Use indexes (in schema.prisma)
@@index([name, isActive])
@@index([createdAt, status])
```

## Common Patterns

### Pattern 1: Search with Filters
```typescript
USER: "Cari kopi harga dibawah 50rb"
→ Tool: search_products({ category: "Kopi", maxPrice: 50000 })
→ AI formats results with recommendations
```

### Pattern 2: Multi-Tool Chain
```typescript
USER: "Produk apa yang stoknya menipis dan laku hari ini?"
→ Tool 1: check_stock({ checkLowStock: true })
→ Tool 2: get_sales_summary({ period: "today" })
→ AI correlates both results
```

### Pattern 3: Calculation with Context
```typescript
USER: "Hitungin diskon 20% untuk total 150rb"
→ Tool: calculate_discount({ subTotal: 150000, discountType: "percentage", discountValue: 20 })
→ AI shows breakdown dengan emoji dan format currency
```

## Monitoring & Debugging

### Logging Best Practices
```typescript
// ✅ Structured logging
console.log("[Rate Limit] IP ${ip} exceeded limit");
console.warn("[Validation] Message too long: ${length}");
console.error("[Critical] Database connection failed", { error, timestamp });

// ✅ Development only
if (process.env.NODE_ENV === "development") {
  console.log("🤖 Tools loaded:", allPosTools.length);
}
```

### Error Tracking
```typescript
// Log errors dengan context
console.error("[Chat Error]", {
  ip,
  error: errorDetails,
  timestamp: new Date().toISOString(),
  userAgent: req.headers.get("user-agent"),
});
```

## Testing Checklist

- [ ] Test semua tools individually
- [ ] Test tool chaining (multiple tools)
- [ ] Test rate limiting (exceed limit)
- [ ] Test timeout (long response)
- [ ] Test XSS patterns (security)
- [ ] Test empty/invalid inputs
- [ ] Test database errors
- [ ] Test streaming disconnect
- [ ] Test concurrent requests
- [ ] Load test (high traffic)

## Production Considerations

### Environment Variables
```bash
OPENROUTER_API_KEY=sk-or-v1-xxx
DATABASE_URL=postgresql://...
NODE_ENV=production
APP_URL=https://your-domain.com
```

### Scaling
1. **Redis for Rate Limiting** (multi-server sync)
   ```typescript
   import Redis from 'ioredis';
   const redis = new Redis(process.env.REDIS_URL);
   ```

2. **Database Connection Pool**
   ```typescript
   // prisma/schema.prisma
   datasource db {
     url = env("DATABASE_URL")
     directUrl = env("DIRECT_URL")
   }
   ```

3. **CDN for Static Assets**
4. **Load Balancer** untuk multiple instances

### Monitoring
- **Sentry** untuk error tracking
- **Prometheus** untuk metrics
- **Grafana** untuk visualization
- **Logs** → CloudWatch/DataDog

## Resources

- [LangGraph Docs](https://langchain-ai.github.io/langgraph/)
- [OpenRouter Docs](https://openrouter.ai/docs)
- [Next.js Streaming](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#streaming)
- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)

## Summary

✅ **Security**: Rate limiting, input validation, XSS protection, timeouts
✅ **Agent**: React pattern, clear prompts, tool descriptions
✅ **Tools**: Type-safe schemas, error handling, human-readable returns
✅ **Performance**: Parallel queries, caching, streaming, pagination
✅ **Monitoring**: Structured logging, error tracking, metrics
✅ **Production**: Environment config, scaling strategies, monitoring stack

**Result**: Robust, scalable, secure AI agent untuk POS system! 🚀
