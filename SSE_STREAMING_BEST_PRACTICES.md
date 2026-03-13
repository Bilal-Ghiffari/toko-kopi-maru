# SSE Streaming Best Practices (ChatGPT-like)

## 🎯 Overview

Implementasi Server-Sent Events (SSE) untuk streaming response AI seperti ChatGPT.

---

## ✅ Best Practices yang Diterapkan

### 1. **Token-by-Token Streaming**

**❌ SALAH (Batch streaming):**

```typescript
// Mengirim full response sekaligus
const response = await agent.invoke({ messages });
stream.enqueue(response.content); // ❌ Tidak streaming!
```

**✅ BENAR (Token streaming):**

```typescript
// Stream token per token seperti ChatGPT
const streamResponse = agent.streamEvents({ messages }, { version: "v2" });

for await (const event of streamResponse) {
  if (event.event === "on_chat_model_stream") {
    const token = event.data.chunk.content; // Token individual
    stream.enqueue(token); // ✅ Stream real-time!
  }
}
```

**Benefit:**

- User melihat response muncul secara real-time
- UX lebih responsive dan engaging
- Perceived latency berkurang

---

### 2. **Event-Based Architecture**

Gunakan `streamEvents()` untuk capture berbagai event types:

```typescript
agent.streamEvents({ messages }, { version: "v2" });

// Event types yang di-handle:
for await (const event of stream) {
  switch (event.event) {
    case "on_tool_start":
      // Tool mulai dieksekusi
      sendFeedback("🔍 Mencari produk...");
      break;

    case "on_tool_end":
      // Tool selesai
      break;

    case "on_chat_model_stream":
      // Token dari LLM (STREAMING!)
      sendToken(event.data.chunk.content);
      break;

    case "on_chain_end":
      // Semua selesai
      sendCompletion();
      break;
  }
}
```

**Benefit:**

- Granular control atas streaming process
- Bisa show progress untuk tool execution
- Better debugging dan monitoring

---

### 3. **Safe Enqueue Pattern**

Selalu check apakah stream masih terbuka sebelum enqueue:

```typescript
const safeEnqueue = (data: string) => {
  try {
    // Check desiredSize !== null = stream masih terbuka
    if (controller.desiredSize !== null) {
      controller.enqueue(encoder.encode(data));
      return true;
    }
    return false;
  } catch (error) {
    console.log("[Stream] Client disconnected");
    return false;
  }
};

// Usage:
const success = safeEnqueue(`data: ${JSON.stringify(chunk)}\n\n`);
if (!success) break; // Stop streaming jika client disconnect
```

**Benefit:**

- Prevent errors ketika client disconnect
- Clean resource cleanup
- No memory leaks

---

### 4. **Proper Headers**

Set headers yang tepat untuk SSE:

```typescript
return new Response(stream, {
  headers: {
    "Content-Type": "text/event-stream", // ✅ SSE format
    "Cache-Control": "no-cache, no-transform", // ✅ No caching
    Connection: "keep-alive", // ✅ Keep connection open
    "X-Accel-Buffering": "no", // ✅ Disable nginx buffering
  },
});
```

**Critical:**

- `text/event-stream` = SSE format
- `no-cache` = Prevent proxy/browser caching
- `X-Accel-Buffering: no` = Nginx compatibility

---

### 5. **Buffer Management**

Accumulate content untuk final message:

```typescript
let accumulatedContent = "";

for await (const event of streamResponse) {
  if (event.event === "on_chat_model_stream") {
    const token = event.data.chunk.content;

    // 1. Accumulate untuk final message
    accumulatedContent += token;

    // 2. Stream ke client
    safeEnqueue(
      `data: ${JSON.stringify({
        type: "content",
        content: token,
      })}\n\n`,
    );
  }
}

// Final accumulated content bisa disave ke DB jika perlu
console.log("Final response:", accumulatedContent);
```

**Benefit:**

- Bisa track complete response
- Useful untuk logging/analytics
- Enable post-processing

---

### 6. **Tool Execution Feedback**

Beri feedback saat tool dieksekusi:

```typescript
if (event.event === "on_tool_start") {
  const toolName = event.name;

  // Map tool names ke user-friendly messages
  const messages = {
    search_products: "🔍 Mencari produk",
    check_stock: "📦 Mengecek stok",
    calculate_discount: "💰 Menghitung diskon",
    get_sales_summary: "📊 Mengambil data penjualan",
  };

  const feedback = messages[toolName] || "⚙️ Memproses";
  safeEnqueue(
    `data: ${JSON.stringify({
      type: "content",
      content: feedback + "...\n\n",
    })}\n\n`,
  );
}
```

**Benefit:**

- User tahu apa yang sedang terjadi
- Transparency meningkatkan trust
- Better UX saat proses lama

---

### 7. **Timeout Protection**

Enforce timeout untuk prevent hanging requests:

```typescript
const LLM_TIMEOUT = 30 * 1000; // 30 seconds

const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => {
    reject(new Error("Request timeout"));
  }, LLM_TIMEOUT);
});

// Race: Stream vs Timeout
const streamResponse = await Promise.race([
  agent.streamEvents({ messages }),
  timeoutPromise, // ✅ Auto-cancel setelah 30s
]);
```

**Benefit:**

- Prevent infinite hanging
- Resource protection
- Better error handling

---

### 8. **Error Handling**

Handle berbagai error types dengan graceful degradation:

```typescript
try {
  // Streaming logic
} catch (error) {
  let errorMessage = "Terjadi kesalahan";

  if (error.message === "Request timeout") {
    errorMessage = "⏱️ Request timeout. Coba pertanyaan lebih sederhana.";
  } else if (error.message.includes("429")) {
    errorMessage = "😊 AI sedang sibuk. Tunggu sebentar ya.";
  } else if (error.message.includes("fetch")) {
    errorMessage = "🌐 Koneksi gagal. Periksa internet kamu.";
  }

  // Send error via SSE (bukan throw!)
  safeEnqueue(
    `data: ${JSON.stringify({
      type: "error",
      error: errorMessage,
    })}\n\n`,
  );
}
```

**Benefit:**

- User-friendly error messages
- No abrupt disconnections
- Better error recovery

---

### 9. **Message Protocol**

Gunakan structured message protocol:

```typescript
// Message types
type StreamMessage =
  | { type: "content"; content: string } // Token streaming
  | { type: "tool"; tool: string } // Tool execution
  | { type: "done" } // Completion
  | { type: "error"; error: string }; // Error

// Client-side parsing
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case "content":
      appendToChat(data.content); // Append token
      break;
    case "tool":
      showToolIndicator(data.tool);
      break;
    case "done":
      finalizeMessage();
      break;
    case "error":
      showError(data.error);
      break;
  }
};
```

**Benefit:**

- Type-safe message handling
- Easy to extend dengan new message types
- Clear separation of concerns

---

### 10. **Client-Side Implementation**

Frontend harus properly handle SSE:

```typescript
const handleSubmit = async () => {
  const response = await fetch("/api/chat", {
    method: "POST",
    body: JSON.stringify({ messages }),
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    // Decode chunk
    const chunk = decoder.decode(value, { stream: true });
    buffer += chunk;

    // Split by newline (SSE format)
    const lines = buffer.split("\n");
    buffer = lines.pop() || ""; // Keep incomplete line

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      const data = line.slice(6);
      const parsed = JSON.parse(data);

      if (parsed.type === "content") {
        // Append token ke UI (REAL-TIME!)
        setStreamingContent((prev) => prev + parsed.content);
      } else if (parsed.type === "done") {
        // Finalize message
        saveMessage(streamingContent);
        setStreamingContent("");
      }
    }
  }
};
```

---

## 🚀 Performance Tips

### 1. **Debounce Updates**

Jangan update UI setiap token (terlalu frequent):

```typescript
let updateBuffer = "";
let lastUpdate = Date.now();

const DEBOUNCE_MS = 50; // Update setiap 50ms

for await (const token of stream) {
  updateBuffer += token;

  if (Date.now() - lastUpdate > DEBOUNCE_MS) {
    updateUI(updateBuffer);
    updateBuffer = "";
    lastUpdate = Date.now();
  }
}
```

### 2. **Batch Small Tokens**

Batch small tokens untuk reduce overhead:

```typescript
let tokenBatch = [];
const BATCH_SIZE = 3;

for await (const token of stream) {
  tokenBatch.push(token);

  if (tokenBatch.length >= BATCH_SIZE) {
    safeEnqueue(tokenBatch.join(""));
    tokenBatch = [];
  }
}

// Flush remaining
if (tokenBatch.length > 0) {
  safeEnqueue(tokenBatch.join(""));
}
```

### 3. **Connection Pooling**

Reuse connections untuk multiple requests:

```typescript
// Server-side: Keep connection alive
headers: {
  "Connection": "keep-alive",
  "Keep-Alive": "timeout=5, max=100"
}
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "Stream completed but no content"

**Problem:** `streamEvents()` tidak mengembalikan tokens

**Solution:** Pastikan menggunakan `version: "v2"`

```typescript
agent.streamEvents(
  { messages },
  {
    version: "v2", // ✅ REQUIRED!
  },
);
```

---

### Issue 2: "Content appears all at once"

**Problem:** Buffering di proxy/nginx

**Solution:** Set proper headers

```typescript
headers: {
  "X-Accel-Buffering": "no", // ✅ Disable nginx buffering
  "Cache-Control": "no-cache, no-transform"
}
```

---

### Issue 3: "Stream closes prematurely"

**Problem:** Client disconnect tidak di-handle

**Solution:** Check `desiredSize` sebelum enqueue

```typescript
if (controller.desiredSize === null) {
  console.log("Client disconnected");
  break; // ✅ Stop streaming
}
```

---

## 📊 Monitoring & Metrics

Track streaming performance:

```typescript
const startTime = Date.now();
let tokenCount = 0;
let bytesSent = 0;

for await (const token of stream) {
  tokenCount++;
  bytesSent += token.length;

  // Send token
}

const duration = Date.now() - startTime;
const throughput = tokenCount / (duration / 1000); // tokens/sec

console.log({
  duration,
  tokenCount,
  bytesSent,
  throughput: `${throughput.toFixed(1)} tokens/sec`,
});
```

---

## 🎓 Summary

**Key Takeaways:**

1. ✅ Use `streamEvents()` bukan `stream()` untuk token-level streaming
2. ✅ Handle `on_chat_model_stream` untuk real-time tokens
3. ✅ Implement safe enqueue pattern untuk handle disconnects
4. ✅ Set proper SSE headers (`text/event-stream`, `no-cache`)
5. ✅ Give feedback saat tool execution (`on_tool_start`)
6. ✅ Enforce timeout untuk prevent hanging
7. ✅ Use structured message protocol (type + content)
8. ✅ Accumulate content untuk logging/analytics
9. ✅ Handle errors gracefully dengan user-friendly messages
10. ✅ Debounce UI updates untuk better performance

**Result:** Streaming experience seperti ChatGPT! 🚀
