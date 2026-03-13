// Quick test script untuk verify OpenRouter API key
require("dotenv").config({ path: ".env.local" });

const apiKey = process.env.OPENROUTER_API_KEY;

console.log("🔍 Testing OpenRouter API...\n");
console.log(
  "API Key:",
  apiKey
    ? `${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 4)}`
    : "❌ NOT FOUND"
);
console.log("");

if (!apiKey) {
  console.error("❌ OPENROUTER_API_KEY not found in .env.local");
  process.exit(1);
}

fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "http://localhost:3000",
    "X-Title": "Kasir AI Test",
  },
  body: JSON.stringify({
    model: "x-ai/grok-4.1-fast",
    messages: [{ role: "user", content: "Say hello in 5 words" }],
    max_tokens: 50,
  }),
})
  .then((res) => {
    console.log("📡 Status:", res.status, res.statusText);
    return res.json();
  })
  .then((data) => {
    if (data.error) {
      console.error("❌ Error:", data.error);
    } else {
      console.log("✅ Success!");
      console.log("Response:", data.choices[0]?.message?.content);
    }
  })
  .catch((err) => {
    console.error("❌ Fetch Error:", err.message);
  });
