# Chat API Implementation - LangChain 1.2.3 Best Practices

## Overview

Implementasi chat endpoint dengan LangChain 1.2.3 menggunakan streaming response untuk real-time typing effect.

## Best Practices

### 1. **Import yang Diperlukan**

```typescript
import { llmStreaming } from "@/lib/ai/langchain";
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import type { NextRequest } from "next/server";
```

**Kenapa?**

- `llmStreaming`: Instance LLM yang sudah dikonfigurasi dengan streaming enabled
- `HumanMessage`, `AIMessage`: Type-safe message format untuk LangChain
- `NextRequest`: Type safety untuk Next.js request

### 2. **Runtime Configuration**

```typescript
export const runtime = "nodejs";
```

**Kenapa?**

- Akses penuh ke database (Prisma)
- File system access
- Environment variables
- Tidak ada batasan edge runtime

### 3. **Request Validation**

```typescript
const { messages } = await req.json();

if (!messages || !Array.isArray(messages) || messages.length === 0) {
  return new Response(JSON.stringify({ error: "Messages array is required" }), {
    status: 400,
  });
}
```

**Kenapa?**

- Early return untuk invalid request
- Mencegah error di downstream processing
- Clear error message untuk debugging

### 4. **Parallel Data Fetching**

```typescript
const [productStats, lowStockProducts, todaySales, recentTransactions] =
  await Promise.all([
    prisma.product.count({ where: { isActive: true } }),
    prisma.product.findMany({
      /* ... */
    }),
    prisma.transaction.aggregate({
      /* ... */
    }),
    prisma.transaction.findMany({
      /* ... */
    }),
  ]);
```

**Kenapa?**

- Fetch semua data secara parallel
- Mengurangi total latency
- 4 query parallel lebih cepat dari 4 query sequential

### 5. **Message Format Conversion**

```typescript
const chatHistory = messages
  .slice(0, -1)
  .map((msg: any) =>
    msg.role === "user"
      ? new HumanMessage(msg.content)
      : new AIMessage(msg.content)
  );

const lastMessage = messages[messages.length - 1].content;
```

**Kenapa?**

- LangChain memerlukan format `HumanMessage`/`AIMessage`
- Pisahkan chat history dan current message
- Type-safe message handling

### 6. **Prompt Construction**

```typescript
const fullPrompt = `${POS_ASSISTANT_SYSTEM_PROMPT}

KONTEKS TOKO:
${contextData}

TANGGAL: ${currentDate}

CHAT HISTORY:
${chatHistory.map((msg) => `${msg._getType()}: ${msg.content}`).join("\n")}

USER: ${lastMessage}

A:`;
```

**Kenapa?**

- Gabungkan semua context dalam satu prompt
- Clear separation antara system, context, history, dan user input
- Format yang mudah dipahami LLM

### 7. **Streaming Response**

```typescript
const stream = new ReadableStream({
  async start(controller) {
    try {
      const streamResponse = await llmStreaming.stream(fullPrompt);

      for await (const chunk of streamResponse) {
        const content = chunk.content;

        if (content) {
          const data = JSON.stringify({
            type: "content",
            content: content,
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
      }

      controller.enqueue(
        encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
      );
    } catch (error) {
      // Error handling
    } finally {
      controller.close();
    }
  },
});
```

**Kenapa?**

- Real-time streaming untuk better UX
- Server-Sent Events (SSE) format
- Chunked transfer untuk progressive rendering
- Type indicator untuk client-side handling

### 8. **Response Headers**

```typescript
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  },
});
```

**Kenapa?**

- `text/event-stream`: Standard SSE content type
- `no-cache`: Prevent caching of streaming response
- `keep-alive`: Keep connection open untuk streaming
- `X-Accel-Buffering: no`: Disable nginx buffering (production)

## Comparison: Old vs New

### ❌ Old Approach (dengan Agents)

```typescript
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
// ⚠️ Module tidak tersedia di langchain 1.2.3

const agent = createToolCallingAgent({
  llm,
  tools: allPosTools,
  prompt,
});

const executor = new AgentExecutor({
  agent,
  tools: allPosTools,
  // ...
});

const response = await executor.invoke({
  input: lastMessage,
  // ...
});
```

**Masalah:**

- Module `langchain/agents` tidak tersedia
- Lebih kompleks untuk use case sederhana
- Overhead untuk simple chat

### ✅ New Approach (Direct Streaming)

```typescript
import { llmStreaming } from "@/lib/ai/langchain";

const streamResponse = await llmStreaming.stream(fullPrompt);

for await (const chunk of streamResponse) {
  // Stream chunks to client
}
```

**Keuntungan:**

- Simple dan straightforward
- Direct streaming support
- Menggunakan config yang sudah ada
- Lebih maintainable

## Performance Tips

### 1. **Optimize Context Data**

```typescript
// ✅ Good: Limit data yang diambil
prisma.product.findMany({
  take: 5, // Hanya 5 produk
  select: { name: true, stock: true }, // Hanya field yang diperlukan
});

// ❌ Bad: Ambil semua data
prisma.product.findMany(); // Bisa ribuan records
```

### 2. **Batch Operations**

```typescript
// ✅ Good: Parallel queries
await Promise.all([query1, query2, query3]);

// ❌ Bad: Sequential queries
await query1;
await query2;
await query3;
```

### 3. **Stream Chunking**

```typescript
// ✅ Good: Stream as-is dari LLM
for await (const chunk of streamResponse) {
  controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
}

// ❌ Bad: Buffer semua response dulu
const fullResponse = await llm.invoke(prompt);
// Lalu stream character by character
```

## Error Handling

### 1. **Graceful Degradation**

```typescript
try {
  // Stream response
} catch (error) {
  console.error("LLM streaming error:", error);

  // Kirim error ke client dengan format yang sama
  controller.enqueue(
    encoder.encode(
      `data: ${JSON.stringify({
        type: "error",
        error: errorMessage,
      })}\n\n`
    )
  );
}
```

### 2. **Always Close Stream**

```typescript
finally {
  controller.close();  // Pastikan stream selalu ditutup
}
```

## Testing

### Manual Test dengan curl

```bash
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "Halo"}
    ]
  }' \
  -N  # Enable streaming
```

### Expected Response Format

```
data: {"type":"content","content":"Hal"}

data: {"type":"content","content":"o! "}

data: {"type":"content","content":"Ada "}

data: {"type":"done"}
```

## Migration Checklist

- [ ] Remove `langchain/agents` imports
- [ ] Replace Agent/Executor with direct LLM streaming
- [ ] Update message format to HumanMessage/AIMessage
- [ ] Test streaming response di browser
- [ ] Verify error handling
- [ ] Check production nginx config untuk streaming
- [ ] Monitor response latency

## References

- [LangChain Streaming Docs](https://js.langchain.com/docs/expression_language/streaming)
- [Server-Sent Events MDN](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)
- [Next.js Streaming](https://nextjs.org/docs/app/building-your-application/routing/route-handlers#streaming)
