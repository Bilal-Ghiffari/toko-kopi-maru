// ============================================
// IMPORT DEPENDENCIES
// ============================================
import React from "react"; // React hooks untuk state management
import { Input } from "../ui/input"; // Input component dari shadcn/ui
import { Button } from "../ui/button"; // Button component dari shadcn/ui
import {
  AlertCircle, // Icon untuk error message
  Bot, // Icon untuk AI assistant
  ChevronDown, // Icon untuk scroll button
  Loader2, // Icon loading spinner
  Mic, // Icon untuk voice indicator
  Send, // Icon untuk send button
  Sparkles, // Icon dekorasi untuk AI badge
  Trash2, // Icon untuk clear chat button
  User, // Icon untuk user message
} from "lucide-react"; // Icon library
import { cn } from "@/lib/utils"; // Utility untuk merge className
import { ScrollArea } from "../ui/scroll-area"; // ScrollArea component dari shadcn/ui
import { useVoiceCommand } from "@/hooks/useVoiceCommand"; // Voice command hook
import { VoiceCommandButton } from "../ui/voice-command-button"; // Voice button

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Interface untuk single message dalam chat
 * Menyimpan informasi tentang satu pesan dari user atau assistant
 */
interface Message {
  id: string; // Unique identifier untuk message (untuk React key)
  role: "user" | "assistant"; // Pengirim pesan: user atau AI
  content: string; // Isi pesan (text content)
  timestamp: Date; // Waktu pesan dibuat
  isStreaming?: boolean; // Flag untuk indicate pesan sedang di-stream (optional)
  isError?: boolean; // Flag untuk indicate pesan adalah error (optional)
}

/**
 * Props untuk AIAssistant component
 */
interface AIAssistantProps {
  className?: string; // Custom className untuk styling (optional)
  onProductSelect?: (productId: string) => void; // Callback saat produk dipilih dari hasil AI (optional)
}

// ============================================
// MAIN COMPONENT
// ============================================
/**
 * AIAssistant Component
 * Komponen chat interface untuk berinteraksi dengan AI Assistant
 * Mendukung streaming response real-time dengan SSE (Server-Sent Events)
 */
export default function AIAssistant({
  className, // Custom styling dari parent
  onProductSelect, // Callback untuk product selection
}: AIAssistantProps) {
  // ============================================
  // STATE MANAGEMENT
  // ============================================

  /**
   * messages: Array of all chat messages
   * Dimulai dengan welcome message dari AI
   */
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome", // ID khusus untuk welcome message
      role: "assistant", // Pesan dari AI
      content: `Halo! 👋 Saya **Kasir AI**, siap membantu kamu.

Beberapa hal yang bisa saya bantu:
• Cari produk ("cari kopi dingin")
• Cek stok ("stok apa yang menipis?")
• Hitung diskon ("hitung diskon 15% dari 100rb")
• Laporan penjualan ("penjualan hari ini gimana?")

Silakan tanya apa saja! 😊`,
      timestamp: new Date(), // Timestamp saat component mount
    },
  ]);

  /**
   * input: Current value dari input field
   * Berisi text yang sedang diketik user
   */
  const [input, setInput] = React.useState<string>("");

  /**
   * isLoading: Flag untuk indicate request sedang diproses
   * true = menunggu response dari API, false = idle
   */
  const [isLoading, setIsLoading] = React.useState<boolean>(false);

  /**
   * streamingContent: Content yang sedang di-stream dari AI
   * Digunakan untuk menampilkan partial response saat streaming
   */
  const [streamingContent, setStreamingContent] = React.useState<string>("");

  /**
   * showScrollButton: Flag untuk show/hide scroll-to-bottom button
   * true = user scroll ke atas, false = user di bottom
   */
  const [showScrollButton, setShowScrollButton] =
    React.useState<boolean>(false);

  // ============================================
  // REFS
  // ============================================

  /**
   * scrollAreaRef: Reference ke ScrollArea component
   * Digunakan untuk programmatic scrolling
   */
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);

  /**
   * inputRef: Reference ke Input element
   * Digunakan untuk auto-focus setelah send message
   */
  const inputRef = React.useRef<HTMLInputElement>(null);

  /**
   * abortControllerRef: Reference ke AbortController instance
   * Digunakan untuk cancel ongoing fetch request
   */
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // ============================================
  // VOICE COMMAND
  // ============================================

  const {
    transcript: voiceTranscript,
    interimTranscript,
    isListening,
    isSupported: isVoiceSupported,
    error: voiceError,
    toggleListening,
    resetTranscript,
  } = useVoiceCommand({
    onResult: (text) => {
      // Set input dan langsung submit tanpa delay
      const finalText = text.trim();
      if (finalText) {
        setInput(finalText);
        // Trigger submit langsung
        setTimeout(() => {
          const form = document.querySelector("form");
          if (form) {
            form.dispatchEvent(
              new Event("submit", { cancelable: true, bubbles: true }),
            );
          }
        }, 100);
      }
    },
    language: "id-ID",
    continuous: false,
    interimResults: true,
    autoStop: 30000,
  });

  // Update input dengan interim transcript
  React.useEffect(() => {
    if (interimTranscript) {
      setInput(interimTranscript);
    }
  }, [interimTranscript]);

  // Clear voice transcript setelah submit berhasil
  React.useEffect(() => {
    if (isLoading && voiceTranscript) {
      setTimeout(() => resetTranscript(), 1000);
    }
  }, [isLoading, voiceTranscript, resetTranscript]);

  // Keyboard shortcut: Ctrl+M atau Cmd+M
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "m") {
        e.preventDefault();
        toggleListening();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleListening]);

  // ============================================
  // CALLBACKS
  // ============================================

  /**
   * scrollToBottom: Scroll chat area ke paling bawah
   * Dipanggil setiap kali ada message baru atau streaming update
   */
  const scrollToBottom = React.useCallback(() => {
    // Cek apakah scrollAreaRef sudah ter-mount
    if (scrollAreaRef.current) {
      // Cari actual scroll container (Radix UI wrapper)
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      // Set scrollTop ke scrollHeight (scroll ke bawah)
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, []); // Empty dependency array = function stable across renders

  /**
   * Effect: Auto-scroll setiap kali messages atau streamingContent berubah
   * Memastikan user selalu melihat message terbaru
   */
  React.useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom, streamingContent]); // Re-run saat ada perubahan

  /**
   * handleScroll: Handle scroll event untuk show/hide scroll button
   * Button muncul saat user scroll ke atas (tidak di bottom)
   */
  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.target as HTMLDivElement; // Get scroll container
    // Cek apakah user berada dekat dengan bottom (dalam 100px)
    const isNearButtom =
      target.scrollHeight - target.scrollTop - target.clientHeight < 100;
    // Show button jika TIDAK di bottom
    setShowScrollButton(!isNearButtom);
  }, []); // No dependencies = stable function

  /**
   * generateId: Generate unique ID untuk message
   * Format: msg_<timestamp>_<random>
   * Digunakan sebagai React key untuk list rendering
   */
  const generateId = () =>
    `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  // ============================================
  // MAIN SUBMIT HANDLER
  // ============================================
  /**
   * handleSubmit: Handle form submission (send message)
   * Proses:
   * 1. Validate input
   * 2. Add user message ke state
   * 3. Fetch API dengan streaming
   * 4. Parse dan display streaming response
   * 5. Handle completion dan errors
   */
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault(); // Prevent default form submission

    const trimmedInput = input.trim(); // Remove whitespace
    // Guard: Return jika input kosong atau sedang loading
    if (!trimmedInput || isLoading) return;

    // Clear input field immediately untuk better UX
    setInput("");

    // ---- Step 1: Create user message object ----
    const userMessage: Message = {
      id: generateId(), // Generate unique ID
      role: "user", // Mark sebagai user message
      content: trimmedInput, // User's question
      timestamp: new Date(), // Current time
    };

    // Add user message ke messages array
    setMessages((prev) => [...prev, userMessage]);

    // Set loading state
    setIsLoading(true);

    // Clear previous streaming content
    setStreamingContent("");

    // ---- Step 2: Create AbortController untuk cancellation support ----
    abortControllerRef.current = new AbortController();

    try {
      // ---- Step 3: Fetch API dengan POST request ----
      const response = await fetch("/api/chat", {
        method: "POST", // HTTP method
        headers: { "Content-Type": "application/json" }, // JSON content type
        body: JSON.stringify({
          // Send all messages (history + new message)
          messages: [...messages, userMessage].map((m) => ({
            role: m.role, // user atau assistant
            content: m.content, // message text
          })),
        }),
        signal: abortControllerRef.current.signal, // Support for aborting request
      });

      // ---- Step 4: Validate response ----
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Check if response body exists
      if (!response.body) {
        throw new Error("Response body is null");
      }

      // ---- Step 5: Setup streaming reader ----
      const reader = response.body.getReader(); // untuk membaca stream
      const decoder = new TextDecoder(); // Decode binary to text

      let fullContent = ""; // Accumulator untuk full response

      // ---- Step 6: Read stream chunks ----
      while (true) {
        // Read next chunk
        const { done, value } = await reader.read();
        if (done) break; // Exit loop jika stream selesai

        // Decode binary chunk ke string
        const chunk = decoder.decode(value, { stream: true });

        // Split chunk by newline (SSE format)
        const lines = chunk.split("\n");

        // ---- Step 7: Parse each line ----
        for (const line of lines) {
          // Skip lines yang bukan SSE data
          if (!line.startsWith("data: ")) continue;

          // Extract JSON data (remove "data: " prefix)
          const data = line.slice(6);
          if (!data) continue; // Skip empty data

          try {
            // Parse JSON data
            const parsed = JSON.parse(data);

            // ---- Handle different message types ----
            if (parsed.type === "content") {
              // Content chunk: Append to fullContent dan update UI
              fullContent += parsed.content;
              setStreamingContent(fullContent);
            } else if (parsed.type === "done") {
              // Stream completed: Save final message
              setMessages((prev) => [
                ...prev,
                {
                  id: generateId(), // Generate new ID
                  role: "assistant", // AI message
                  content: fullContent, // Complete response
                  timestamp: new Date(), // Current timestamp
                },
              ]);
              setStreamingContent(""); // Clear streaming state
            } else if (parsed.type === "error") {
              // Error from API: Throw to catch block
              throw new Error(
                parsed.error || "Error tidak diketahui dari AI Assistant",
              );
            }
          } catch (error) {
            // Skip invalid JSON (malformed chunks)
          }
        }
      }
    } catch (error) {
      // ---- Step 8: Error handling ----

      // Check if error is from user cancellation (AbortError)
      if (error instanceof Error && error.name === "AbortError") {
        console.log("[Chat] Request cancelled by user");

        // Clear streaming content saat di-cancel
        setStreamingContent("");

        // Optional: Add cancelled message (comment out jika tidak ingin tampil)
        // setMessages((prev) => [
        //   ...prev,
        //   {
        //     id: generateId(),
        //     role: "assistant",
        //     content: "Permintaan dibatalkan.",
        //     timestamp: new Date(),
        //   },
        // ]);

        return; // Early return, tidak perlu show error
      }

      // Log error untuk debugging
      console.error("[Chat] Error:", error);

      // Add error message ke UI untuk errors lainnya
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(), // Generate unique ID
          role: "assistant", // From AI (error response)
          content: "Maaf, terjadi kesalahan. Silakan coba lagi.", // User-friendly message
          timestamp: new Date(), // Current time
          isError: true, // Flag untuk styling
        },
      ]);
      setStreamingContent(""); // Clear streaming state
    } finally {
      // ---- Step 9: Cleanup ----
      // Always execute, bahkan jika ada error

      setIsLoading(false); // Reset loading state
      abortControllerRef.current = null; // Clear abort controller
      inputRef.current?.focus(); // Focus kembali ke input
    }
  };

  // ============================================
  // UTILITY FUNCTIONS
  // ============================================

  /**
   * cancelRequest: Cancel ongoing API request
   * Dipanggil saat user click tombol "Stop"
   */
  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort(); // untuk cancel fetch request
    }
  };

  /**
   * clearChat: Reset chat history
   * Keep welcome message, hapus semua message lainnya
   */
  const clearChat = () => {
    setMessages([messages[0]]); // Keep only first message (welcome)
    setStreamingContent(""); // Clear streaming state
  };

  // ============================================
  // CONFIGURATION DATA
  // ============================================

  /**
   * quickActions: Pre-defined quick questions
   * Ditampilkan sebagai buttons untuk easy access
   */
  const quickActions = [
    { label: "📦 Stok menipis", query: "Stok apa yang menipis?" },
    { label: "💰 Penjualan hari ini", query: "Bagaimana penjualan hari ini?" },
    {
      label: "🏆 Produk terlaris",
      query: "Produk apa yang paling laris minggu ini?",
    },
    { label: "💳 Metode bayar", query: "Breakdown pembayaran hari ini" },
  ];

  /**
   * formatContent: Format message content dengan proper markdown parsing
   * Support:
   * - **text** → bold
   * - *text* → italic
   * - Line breaks
   * - Bullet lists (• - *)
   * - Numbered lists (1. 2. 3.)
   * - Code blocks (`code`)
   */
  const formatContent = (content: string) => {
    let formatted = content;

    // 1. Code blocks (inline) - `code` → <code>
    formatted = formatted.replace(
      /`([^`]+)`/g,
      '<code class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">$1</code>',
    );

    // 2. Bold - **text** → <strong>
    formatted = formatted.replace(
      /\*\*([^\*]+)\*\*/g,
      '<strong class="font-semibold">$1</strong>',
    );

    // 3. Italic - *text* → <em>
    formatted = formatted.replace(
      /\*([^\*]+)\*/g,
      '<em class="italic">$1</em>',
    );

    // 4. Line breaks - \n → <br/>
    formatted = formatted
      .split("\n")
      .map((line) => {
        // Trim untuk remove extra whitespace
        line = line.trim();

        // Skip empty lines
        if (!line) return "<br/>";

        // 5. Bullet lists (•, -, *) → styled list items
        if (/^[•\-\*]\s/.test(line)) {
          const content = line.substring(2).trim();
          return `<div class="flex gap-2 my-1"><span class="text-primary mt-0.5">•</span><span>${content}</span></div>`;
        }

        // 6. Numbered lists (1., 2., etc) → styled numbered items
        if (/^\d+\.\s/.test(line)) {
          const match = line.match(/^(\d+)\.\s(.+)$/);
          if (match) {
            const [, number, content] = match;
            return `<div class="flex gap-2 my-1"><span class="text-primary font-semibold min-w-6">${number}.</span><span>${content}</span></div>`;
          }
        }

        // 7. Headers (###) → styled headers (optional, jika diperlukan)
        if (/^#{1,3}\s/.test(line)) {
          const match = line.match(/^(#{1,3})\s(.+)$/);
          if (match) {
            const [, hashes, content] = match;
            const level = hashes.length;
            const sizes = { 1: "text-base", 2: "text-sm", 3: "text-sm" };
            return `<div class="${sizes[level as 1 | 2 | 3]} font-semibold mt-2 mb-1">${content}</div>`;
          }
        }

        // Regular paragraph
        return `<div class="my-1">${line}</div>`;
      })
      .join("");

    return formatted;
  };

  // ============================================
  // RENDER
  // ============================================
  return (
    <div
      className={cn(
        "relative flex flex-col h-full border rounded-lg bg-background",
        className, // Merge dengan custom className dari props
      )}
    >
      {/* ========================================
          HEADER SECTION
          Menampilkan avatar AI, nama, status, dan clear button
          ======================================== */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/30">
        {/* Left side: Avatar dan Info */}
        <div className="flex items-center gap-2">
          {/* Avatar dengan badge sparkles */}
          <div className="relative">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" /> {/* AI Icon */}
            </div>
            {/* Sparkles badge di corner */}
            <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-yellow-500" />
          </div>
          {/* Name dan Status */}
          <div>
            <h3 className="font-semibold text-sm">Tanya Maru</h3>
            {/* Status: "Sedang mengetik..." saat loading, "Online" saat idle */}
            <p className="text-xs text-muted-foreground">
              {isLoading ? "Sedang mengetik..." : "Online"}
            </p>
          </div>
        </div>

        {/* Right side: Voice indicator & Clear button */}
        <div className="flex items-center gap-2">
          {/* Simple voice indicator */}
          {isListening && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 animate-pulse">
              <Mic className="h-3 w-3 text-primary" />
              <div className="flex gap-0.5">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-primary rounded-full animate-wave"
                    style={{
                      height: `${Math.random() * 8 + 4}px`,
                      animationDelay: `${i * 0.1}s`,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs text-primary font-medium">
                Mendengarkan
              </span>
            </div>
          )}

          {/* Clear chat button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={clearChat} // Clear chat history
            title="Hapus percakapan" // Tooltip
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* ========================================
          MESSAGES SECTION
          Scrollable area untuk display chat messages
          ======================================== */}
      <ScrollArea
        ref={scrollAreaRef} // Ref untuk programmatic scrolling
        className="flex-1 overflow-auto" // flex-1 = take remaining space
        onScrollCapture={handleScroll as any} // Detect scroll position
      >
        <div className="p-4 space-y-4">
          {" "}
          {/* Vertical spacing between messages */}
          {/* Map through all messages */}
          {messages.map((message) => (
            <div
              key={message.id} // Unique key untuk React list
              className={cn(
                "flex gap-3",
                // Align right untuk user, left untuk assistant
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {/* Avatar untuk assistant (left side) */}
              {message.role === "assistant" && (
                <div
                  className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                    // Red background untuk error, primary untuk normal
                    message.isError ? "bg-destructive/10" : "bg-primary/10",
                  )}
                >
                  {/* Show AlertCircle untuk error, Bot icon untuk normal */}
                  {message.isError ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Bot className="h-4 w-4 text-primary" />
                  )}
                </div>
              )}

              {/* Message bubble */}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5", // Base styling
                  // Conditional styling based on role dan error status
                  message.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md" // User: primary color
                    : message.isError
                      ? "bg-destructive/10 text-destructive rounded-bl-md" // Error: red
                      : "bg-muted rounded-bl-md", // Assistant: muted
                )}
              >
                {/* Message content dengan formatted HTML */}
                <div
                  className={cn(
                    "text-sm leading-relaxed", // Better line height for readability
                    // Different text color for user vs assistant
                    message.role === "user"
                      ? "text-primary-foreground"
                      : "text-foreground",
                  )}
                  dangerouslySetInnerHTML={{
                    __html: formatContent(message.content), // Format markdown
                  }}
                />
                {/* Timestamp di bottom right */}
                <span className="text-[10px] opacity-60 mt-2 block">
                  {message.timestamp.toLocaleTimeString("id-ID", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>

              {/* Avatar untuk user (right side) */}
              {message.role === "user" && (
                <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {/* ========================================
              STREAMING CONTENT
              Display partial response yang sedang di-stream
              ======================================== */}
          {streamingContent && ( // Only show jika ada streaming content
            <div className="flex gap-3 justify-start">
              {/* AI Avatar */}
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              {/* Message bubble dengan cursor animation */}
              <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-2.5 bg-muted">
                {/* Streaming text content */}
                <div
                  className="text-sm leading-relaxed text-foreground"
                  dangerouslySetInnerHTML={{
                    __html: formatContent(streamingContent),
                  }}
                />
                {/* Blinking cursor untuk indicate sedang mengetik */}
                <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5 rounded-sm" />
              </div>
            </div>
          )}
          {/* ========================================
              LOADING INDICATOR
              Show sebelum streaming dimulai
              ======================================== */}
          {isLoading &&
            !streamingContent && ( // Show saat loading tapi belum ada content
              <div className="flex gap-3 justify-start">
                {/* Spinning loader icon */}
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                </div>
                {/* Bouncing dots animation */}
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    {/* 3 dots dengan staggered bounce animation */}
                    <div
                      className="h-2 w-2 rounded-full bg-primary/40 animate-bounce"
                      style={{ animationDelay: "0ms" }} // First dot
                    />
                    <div
                      className="h-2 w-2 rounded-full bg-primary/40 animate-bounce"
                      style={{ animationDelay: "150ms" }} // Second dot (delayed)
                    />
                    <div
                      className="h-2 w-2 rounded-full bg-primary/40 animate-bounce"
                      style={{ animationDelay: "300ms" }} // Third dot (more delayed)
                    />
                  </div>
                </div>
              </div>
            )}
        </div>
      </ScrollArea>

      {/* ========================================
          SCROLL TO BOTTOM BUTTON
          Floating button yang muncul saat user scroll ke atas
          ======================================== */}
      {showScrollButton && ( // Only show jika user tidak di bottom
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-10">
          {" "}
          {/* Centered horizontally */}
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full shadow-lg" // Circular button dengan shadow
            onClick={scrollToBottom} // Scroll to bottom on click
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ========================================
          QUICK ACTIONS
          Pre-defined questions untuk easy access
          Only show di awal conversation (≤2 messages)
          ======================================== */}
      {messages.length <= 2 &&
        !isLoading && ( // Show hanya saat chat masih baru
          <div className="border-t px-4 py-2 bg-muted/20">
            <p className="text-xs text-muted-foreground mb-2">Coba tanya:</p>
            <div className="flex flex-wrap gap-2">
              {" "}
              {/* Wrap buttons ke baris baru jika perlu */}
              {/* Map through quick actions */}
              {quickActions.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => {
                    setInput(action.query); // Set input value
                    setTimeout(() => handleSubmit(), 100); // Submit after brief delay
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}

      {/* ========================================
          INPUT SECTION
          Voice command, text input, dan send/stop button
          ======================================== */}
      <div className="border-t bg-background">
        <form onSubmit={handleSubmit} className="p-3">
          <div className="flex gap-2">
            {/* Voice Command Button */}
            <VoiceCommandButton
              isListening={isListening}
              isSupported={isVoiceSupported}
              error={voiceError}
              onClick={toggleListening}
              disabled={isLoading}
              size="icon"
            />

            {/* Text input field */}
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                isListening
                  ? "🎤 Mendengarkan..."
                  : "Ketik atau bicara (Ctrl+M)..."
              }
              disabled={isLoading}
              className="flex-1"
              autoComplete="off"
            />

            {/* Send/Stop button */}
            {isLoading ? (
              <Button
                type="button"
                variant="destructive"
                onClick={cancelRequest}
              >
                Stop
              </Button>
            ) : (
              <Button type="submit" disabled={!input.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Error message jika ada */}
          {voiceError && (
            <div className="flex items-center gap-2 mt-2 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>{voiceError}</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
