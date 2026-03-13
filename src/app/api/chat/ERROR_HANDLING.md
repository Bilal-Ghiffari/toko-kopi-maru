# Error Handling & Security Best Practices

## Overview
Implementasi error handling komprehensif untuk chat API dengan fokus pada security, reliability, dan user experience.

---

## 🛡️ Security Features

### 1. **Rate Limiting**
Mencegah abuse dan DDoS attacks dengan membatasi requests per IP.

```typescript
// Configuration
const RATE_LIMIT = 20;           // Max requests per window
const RATE_WINDOW = 60 * 1000;   // 1 minute window

// Implementation
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const requests = rateLimitMap.get(ip) || [];
  
  // Filter requests dalam window (auto cleanup)
  const recentRequests = requests.filter(time => now - time < RATE_WINDOW);
  
  if (recentRequests.length >= RATE_LIMIT) {
    return false; // Blocked
  }
  
  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);
  return true; // Allowed
}
```

**Benefits:**
- ✅ Prevent abuse (spam, DDoS)
- ✅ Fair resource allocation
- ✅ Cost control (API usage)
- ✅ No external dependencies

**Response:**
```json
{
  "error": "Terlalu banyak request. Tunggu sebentar ya. 🙏",
  "retryAfter": 60
}
```
Status: `429 Too Many Requests`

---

### 2. **Input Validation**

#### A. Message Length Validation
Prevent long inputs yang bisa:
- Consume excessive memory
- Cost banyak tokens (API billing)
- Slow down response time

```typescript
const MAX_MESSAGE_LENGTH = 1000; // characters

if (lastMessage.length > MAX_MESSAGE_LENGTH) {
  return new Response(
    JSON.stringify({
      error: `Pesan terlalu panjang. Maksimal ${MAX_MESSAGE_LENGTH} karakter.`
    }),
    { status: 400 }
  );
}
```

#### B. Conversation History Validation
Limit total messages untuk prevent:
- Memory overflow
- Context window exceeded
- Slow processing

```typescript
const MAX_MESSAGES_HISTORY = 50; // messages

if (messages.length > MAX_MESSAGES_HISTORY) {
  return new Response(
    JSON.stringify({
      error: `Percakapan terlalu panjang. Maksimal ${MAX_MESSAGES_HISTORY} pesan.`
    }),
    { status: 400 }
  );
}
```

#### C. XSS Prevention
Sanitize input untuk prevent injection attacks:

```typescript
const sanitizedMessage = lastMessage
  .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove <script>
  .replace(/javascript:/gi, '')                                        // Remove javascript:
  .replace(/on\w+\s*=/gi, '');                                        // Remove onclick, etc
```

**Protected Against:**
- `<script>alert('XSS')</script>`
- `<img src=x onerror=alert(1)>`
- `javascript:alert(1)`

---

### 3. **Timeout Handling**
Prevent hanging requests yang bisa:
- Block resources
- Cause poor UX
- Increase costs

```typescript
const LLM_TIMEOUT = 30 * 1000; // 30 seconds

const timeoutPromise = new Promise<never>((_, reject) => {
  setTimeout(() => reject(new Error('Request timeout')), LLM_TIMEOUT);
});

// Race: LLM vs Timeout
const streamResponse = await Promise.race([
  llmStreaming.stream(fullPrompt),
  timeoutPromise
]);
```

**Benefits:**
- ✅ Predictable response time
- ✅ Better resource management
- ✅ User-friendly error messages

**Response:**
```json
{
  "type": "error",
  "error": "Maaf, permintaan terlalu lama. Coba lagi dengan pertanyaan yang lebih sederhana. ⏱️"
}
```

---

## 🎯 Error Handling Strategy

### Error Categories

#### 1. **Client Errors (4xx)**
User atau client-side issues.

| Error | Status | Handling |
|-------|--------|----------|
| Empty message | 400 | Validation - reject with clear message |
| Message too long | 400 | Validation - show character count |
| History too long | 400 | Validation - suggest new conversation |
| Rate limited | 429 | Rate limit - show retry time |
| Invalid format | 400 | JSON parse - show format hint |

#### 2. **Server Errors (5xx)**
Backend atau infrastructure issues.

| Error | Status | Handling |
|-------|--------|----------|
| Timeout | Streaming | Detect in stream - user-friendly message |
| API failure | Streaming | Detect pattern - specific message |
| Network error | Streaming | Detect fetch fail - suggest retry |
| Database error | 500 | Catch global - log + generic message |
| Runtime error | 500 | Catch global - log + safe message |

### Error Response Format

#### REST Errors (Non-streaming)
```json
{
  "error": "User-friendly message",
  "retryAfter": 60,           // Optional: for rate limits
  "details": "Dev info only"  // Only in development
}
```

#### Streaming Errors (SSE)
```
data: {"type":"error","error":"User-friendly message"}

```

---

## 📊 Monitoring & Logging

### What to Log

#### 1. **Security Events**
```typescript
console.warn(`[Rate Limit] IP ${ip} exceeded rate limit`);
```

#### 2. **Validation Failures**
```typescript
console.warn(`[Validation] Message length ${len} exceeds limit ${max}`);
```

#### 3. **Timeout Events**
```typescript
console.warn(`[Timeout] Request timeout for IP ${ip}`);
```

#### 4. **Critical Errors**
```typescript
console.error('[Critical Error]', {
  error: error.message,
  stack: error.stack,
  timestamp: new Date().toISOString()
});
```

### Structured Logging Format
```typescript
{
  level: 'error' | 'warn' | 'info',
  category: 'rate-limit' | 'validation' | 'timeout' | 'api',
  ip: string,
  message: string,
  timestamp: ISO8601
}
```

**Benefits:**
- ✅ Easy to parse and analyze
- ✅ Can integrate with monitoring tools (Datadog, Sentry)
- ✅ Helps identify patterns

---

## 🚀 Performance Optimization

### 1. **Rate Limit Cleanup**
Map auto-cleans old entries saat check:

```typescript
const recentRequests = requests.filter(time => now - time < RATE_WINDOW);
```

**Memory Usage:**
- Max: `RATE_LIMIT * number_of_unique_IPs * 8 bytes`
- Example: 20 * 1000 users * 8 = ~160KB

### 2. **Early Returns**
Validate dan reject sebelum expensive operations:

```
1. Rate limit check     → 🚫 Return 429
2. Input validation     → 🚫 Return 400
3. Context gathering    → 💰 Database queries
4. LLM streaming       → 💰 API calls
```

### 3. **Timeout Protection**
Prevent resource blocking:
- Max response time: 30s
- Auto-cleanup on timeout
- Clear error message

---

## ✅ Testing Checklist

### Security Tests
- [ ] Rate limit triggers at 21st request
- [ ] Rate limit resets after 1 minute
- [ ] XSS patterns are sanitized
- [ ] Long messages are rejected
- [ ] Empty messages are rejected

### Error Handling Tests
- [ ] Timeout triggers after 30s
- [ ] Network errors show appropriate message
- [ ] Invalid JSON shows parse error
- [ ] Stream errors are caught and sent

### User Experience Tests
- [ ] Error messages are user-friendly
- [ ] Retry information is clear
- [ ] Loading states work properly
- [ ] Errors don't break UI

---

## 🔧 Production Configuration

### Environment Variables
```bash
# .env.production
NODE_ENV=production

# Rate Limiting
RATE_LIMIT=20              # requests per minute
RATE_WINDOW=60000          # 1 minute in ms

# Validation
MAX_MESSAGE_LENGTH=1000    # characters
MAX_MESSAGES_HISTORY=50    # messages

# Timeout
LLM_TIMEOUT=30000          # 30 seconds in ms
```

### Nginx Configuration
```nginx
# Disable buffering untuk streaming
location /api/chat {
    proxy_pass http://localhost:3000;
    proxy_buffering off;
    proxy_cache off;
    
    # Timeout settings
    proxy_read_timeout 35s;  # Slightly more than LLM_TIMEOUT
    proxy_send_timeout 35s;
    
    # Headers
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

---

## 📈 Metrics to Monitor

### Key Metrics
1. **Rate Limit Hits**
   - Track: How many requests are rate limited
   - Alert: If rate > 10% of total requests

2. **Timeout Rate**
   - Track: Percentage of requests that timeout
   - Alert: If rate > 5%

3. **Error Rate**
   - Track: Percentage of failed requests
   - Alert: If rate > 2%

4. **Response Time**
   - Track: P50, P95, P99 response times
   - Alert: If P95 > 25s

5. **Token Usage**
   - Track: Average tokens per request
   - Alert: If average > 2000 tokens

---

## 🎓 Best Practices Summary

### ✅ DO
- Validate input early
- Use specific error messages
- Log security events
- Implement timeouts
- Use rate limiting
- Sanitize user input
- Return appropriate status codes
- Include retry information
- Test error scenarios

### ❌ DON'T
- Expose internal errors to users
- Skip input validation
- Ignore rate limiting
- Use generic error messages
- Block requests indefinitely
- Trust user input
- Log sensitive data
- Forget to close streams
- Ignore monitoring

---

## 📚 Further Reading

- [OWASP Input Validation](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html)
- [Rate Limiting Strategies](https://www.nginx.com/blog/rate-limiting-nginx/)
- [HTTP Status Codes](https://httpstatuses.com/)
- [Server-Sent Events Spec](https://html.spec.whatwg.org/multipage/server-sent-events.html)

---

## 🆘 Troubleshooting

### Issue: Rate limit too strict
**Solution:** Increase `RATE_LIMIT` atau `RATE_WINDOW`

### Issue: Timeout too short
**Solution:** Increase `LLM_TIMEOUT` (max 60s)

### Issue: Memory leak from rate limit map
**Solution:** Implement periodic cleanup atau use Redis

### Issue: XSS patterns still passing
**Solution:** Add more sanitization rules atau use library (DOMPurify)

---

**Last Updated:** January 17, 2026
**Version:** 1.0.0
