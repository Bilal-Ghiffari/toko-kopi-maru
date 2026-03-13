# 🎤 Voice Commands - Complete Flow Documentation

## 📚 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Component Flow](#component-flow)
3. [Data Flow Diagram](#data-flow-diagram)
4. [Integration Points](#integration-points)
5. [State Management](#state-management)
6. [Error Handling Flow](#error-handling-flow)

---

## 🏗️ Architecture Overview

Voice Commands di Toko Kopi Maru menggunakan **Web Speech API** yang diintegrasikan dengan **React hooks** dan **AI Assistant chat interface**.

### High-Level Architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser Layer                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Web Speech API (SpeechRecognition)                   │ │
│  │  - Microphone access                                   │ │
│  │  - Audio processing                                    │ │
│  │  - Speech-to-text conversion (Google Cloud)          │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕️
┌─────────────────────────────────────────────────────────────┐
│                  React Hook Layer                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  useVoiceCommand.ts                                   │ │
│  │  - State management                                    │ │
│  │  - Event handling                                      │ │
│  │  - Error handling                                      │ │
│  │  - Lifecycle management                               │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕️
┌─────────────────────────────────────────────────────────────┐
│                  Component Layer                             │
│  ┌──────────────────┐  ┌─────────────────────────────────┐ │
│  │ VoiceCommand     │  │  AIAssistant.tsx                │ │
│  │ Button.tsx       │  │  - Integration logic            │ │
│  │ - UI controls    │  │  - Auto-submit                  │ │
│  │ - Visual feedback│  │  - State sync                   │ │
│  └──────────────────┘  └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            ↕️
┌─────────────────────────────────────────────────────────────┐
│                     API Layer                                │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  /api/chat (SSE Streaming)                            │ │
│  │  - Receives transcript                                 │ │
│  │  - Processes with AI                                   │ │
│  │  - Returns response                                    │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Component Flow

### 1. **User Interaction Flow**

```
USER ACTION
    │
    ├─► [Klik Mic Button] ──────────────────────────────┐
    │                                                     │
    └─► [Press Ctrl+M / Cmd+M] ─────────────────────────┤
                                                          │
                                                          ▼
                                              ┌────────────────────┐
                                              │  toggleListening() │
                                              └────────────────────┘
                                                          │
                                    ┌─────────────────────┴──────────────────┐
                                    ▼                                        ▼
                          ┌──────────────────┐                    ┌──────────────────┐
                          │ startListening() │                    │ stopListening()  │
                          └──────────────────┘                    └──────────────────┘
                                    │                                        │
                                    ▼                                        ▼
                    ┌───────────────────────────┐              ┌────────────────────┐
                    │ Request Mic Permission    │              │ Stop Recognition   │
                    └───────────────────────────┘              └────────────────────┘
                                    │
                                    ▼
                          ┌──────────────────┐
                          │ Recognition Start│
                          │ (onstart event)  │
                          └──────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────┐
                    │ Update UI:                │
                    │ - isListening = true      │
                    │ - Show indicator          │
                    │ - Enable waveform         │
                    └───────────────────────────┘
```

### 2. **Speech Recognition Flow**

```
MICROPHONE ACTIVE
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Browser captures audio                                  │
│  → Sends to Google Speech API (requires internet)       │
│  → Processes speech-to-text                             │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  onresult Event Triggered (multiple times)              │
│                                                           │
│  Loop through results:                                   │
│  ┌────────────────────────────────────────────────────┐ │
│  │  For each result:                                   │ │
│  │    if (result.isFinal):                            │ │
│  │      ✅ finalText += transcript                    │ │
│  │      ✅ Call onResult callback                     │ │
│  │      ✅ Auto-stop (if not continuous)              │ │
│  │    else:                                            │ │
│  │      🔄 interimText = transcript                   │ │
│  │      🔄 Call onInterimResult callback              │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
    │
    ├──► Interim Results (Real-time)
    │    │
    │    └──► Update input field with temporary text
    │         │
    │         └──► User sees text appearing as they speak
    │
    └──► Final Result
         │
         └──► Set final transcript
              │
              └──► Trigger auto-submit
                   │
                   └──► Send to AI Assistant
```

### 3. **Auto-Submit Flow**

```
FINAL RESULT RECEIVED
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  onResult Callback (AIAssistant.tsx)                    │
│                                                           │
│  const finalText = text.trim();                          │
│  if (finalText) {                                        │
│    setInput(finalText);  ← Set input field              │
│    setTimeout(() => {                                    │
│      const form = document.querySelector('form');       │
│      form.dispatchEvent(new Event('submit'));           │
│    }, 100);              ← Trigger form submit (100ms)  │
│  }                                                        │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  handleSubmit() Function                                 │
│                                                           │
│  1. Validate input (not empty, not loading)             │
│  2. Create user message object                           │
│  3. Add to messages array                                │
│  4. Clear input field                                    │
│  5. Set isLoading = true                                 │
│  6. Fetch /api/chat with POST                           │
│  7. Stream response (SSE)                                │
│  8. Display AI response                                  │
└─────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────┐
│  Cleanup                                                 │
│                                                           │
│  1. Clear voice transcript (after 1s delay)             │
│  2. Reset voice state                                    │
│  3. Set isLoading = false                                │
└─────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagram

### Complete Data Flow:

```
┌─────────────┐
│   USER      │
│  🗣️ Speaks  │
└──────┬──────┘
       │ Audio Input
       ▼
┌──────────────────────────────────────────┐
│  Browser SpeechRecognition API           │
│  ┌────────────────────────────────────┐  │
│  │ 1. Capture audio via microphone    │  │
│  │ 2. Send to Google Cloud            │  │
│  │ 3. Process speech-to-text          │  │
│  │ 4. Return results (interim & final)│  │
│  └────────────────────────────────────┘  │
└──────┬───────────────────────────────────┘
       │ Events (onresult, onerror, onend)
       ▼
┌──────────────────────────────────────────┐
│  useVoiceCommand Hook                    │
│  ┌────────────────────────────────────┐  │
│  │ STATE:                             │  │
│  │ - transcript: ""                   │  │
│  │ - interimTranscript: ""            │  │
│  │ - isListening: false               │  │
│  │ - isSupported: true                │  │
│  │ - error: null                      │  │
│  └────────────────────────────────────┘  │
│                                           │
│  ┌────────────────────────────────────┐  │
│  │ METHODS:                           │  │
│  │ - startListening()                 │  │
│  │ - stopListening()                  │  │
│  │ - toggleListening()                │  │
│  │ - resetTranscript()                │  │
│  └────────────────────────────────────┘  │
└──────┬───────────────────────────────────┘
       │ Return state & methods
       ▼
┌──────────────────────────────────────────┐
│  AIAssistant Component                   │
│  ┌────────────────────────────────────┐  │
│  │ INTEGRATION:                       │  │
│  │                                     │  │
│  │ const {                            │  │
│  │   transcript: voiceTranscript,     │  │
│  │   interimTranscript,               │  │
│  │   isListening,                     │  │
│  │   toggleListening,                 │  │
│  │   resetTranscript,                 │  │
│  │ } = useVoiceCommand({              │  │
│  │   onResult: (text) => {            │  │
│  │     setInput(text);                │  │
│  │     triggerAutoSubmit();           │  │
│  │   },                               │  │
│  │   language: 'id-ID',               │  │
│  │ });                                │  │
│  └────────────────────────────────────┘  │
│                                           │
│  ┌────────────────────────────────────┐  │
│  │ UI COMPONENTS:                     │  │
│  │                                     │  │
│  │ 1. VoiceCommandButton              │  │
│  │    - Mic icon                      │  │
│  │    - Click handler                 │  │
│  │    - Visual states                 │  │
│  │                                     │  │
│  │ 2. Voice Indicator (Header)        │  │
│  │    - Animated waveform             │  │
│  │    - "Mendengarkan" text           │  │
│  │    - Only show when listening      │  │
│  │                                     │  │
│  │ 3. Input Field                     │  │
│  │    - Shows interim transcript      │  │
│  │    - Placeholder changes           │  │
│  │    - Auto-filled with final text   │  │
│  │                                     │  │
│  │ 4. Error Message                   │  │
│  │    - Below input field             │  │
│  │    - Red alert icon                │  │
│  └────────────────────────────────────┘  │
└──────┬───────────────────────────────────┘
       │ Auto-submit on final result
       ▼
┌──────────────────────────────────────────┐
│  Form Submit Event                       │
│  ┌────────────────────────────────────┐  │
│  │ handleSubmit()                     │  │
│  │ → Create user message              │  │
│  │ → POST to /api/chat                │  │
│  │ → Stream AI response               │  │
│  └────────────────────────────────────┘  │
└──────┬───────────────────────────────────┘
       │ HTTP POST
       ▼
┌──────────────────────────────────────────┐
│  /api/chat Endpoint (SSE)                │
│  ┌────────────────────────────────────┐  │
│  │ 1. Receive transcript text         │  │
│  │ 2. Process with LangChain agent    │  │
│  │ 3. Execute tools if needed         │  │
│  │ 4. Stream response back            │  │
│  └────────────────────────────────────┘  │
└──────┬───────────────────────────────────┘
       │ SSE Stream
       ▼
┌──────────────────────────────────────────┐
│  AI Response Display                     │
│  ┌────────────────────────────────────┐  │
│  │ - Show streaming response          │  │
│  │ - Format markdown                  │  │
│  │ - Add to message history           │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

---

## 🔗 Integration Points

### 1. **AIAssistant.tsx Integration**

```typescript
// Location: src/components/pos/AIAssistant.tsx

// ════════════════════════════════════════════════════════════
// STEP 1: Import Hook & Components
// ════════════════════════════════════════════════════════════
import { useVoiceCommand } from "@/hooks/useVoiceCommand";
import { VoiceCommandButton } from "../ui/voice-command-button";

// ════════════════════════════════════════════════════════════
// STEP 2: Initialize Hook
// ════════════════════════════════════════════════════════════
const {
  transcript: voiceTranscript, // Final transcript
  interimTranscript, // Real-time transcript
  isListening, // Listening state
  isSupported: isVoiceSupported, // Browser support
  error: voiceError, // Error message
  toggleListening, // Toggle method
  resetTranscript, // Reset method
} = useVoiceCommand({
  // ┌────────────────────────────────────────────────────┐
  // │ onResult: Called when speech recognition finishes  │
  // │ This is where we auto-submit the transcript       │
  // └────────────────────────────────────────────────────┘
  onResult: (text) => {
    const finalText = text.trim();
    if (finalText) {
      // Set input field value
      setInput(finalText);

      // Auto-submit after 100ms
      // Short delay ensures state update completes
      setTimeout(() => {
        const form = document.querySelector("form");
        if (form) {
          form.dispatchEvent(
            new Event("submit", {
              cancelable: true,
              bubbles: true,
            }),
          );
        }
      }, 100);
    }
  },

  language: "id-ID", // Bahasa Indonesia
  continuous: false, // Stop after one phrase
  interimResults: true, // Show real-time feedback
  autoStop: 30000, // 30 seconds timeout
});

// ════════════════════════════════════════════════════════════
// STEP 3: Sync Interim Transcript to Input Field
// ════════════════════════════════════════════════════════════
React.useEffect(() => {
  // Update input field with interim transcript (real-time)
  if (interimTranscript) {
    setInput(interimTranscript);
  }
}, [interimTranscript]);

// ════════════════════════════════════════════════════════════
// STEP 4: Cleanup After Submit
// ════════════════════════════════════════════════════════════
React.useEffect(() => {
  // Clear voice transcript after submit (1s delay)
  if (isLoading && voiceTranscript) {
    setTimeout(() => resetTranscript(), 1000);
  }
}, [isLoading, voiceTranscript, resetTranscript]);

// ════════════════════════════════════════════════════════════
// STEP 5: Keyboard Shortcut (Ctrl+M / Cmd+M)
// ════════════════════════════════════════════════════════════
React.useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Check for Ctrl+M (Windows/Linux) or Cmd+M (Mac)
    if ((e.ctrlKey || e.metaKey) && e.key === "m") {
      e.preventDefault(); // Prevent default browser action
      toggleListening(); // Toggle voice on/off
    }
  };

  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [toggleListening]);
```

### 2. **UI Components Integration**

#### **Header - Voice Indicator**

```typescript
// Location: AIAssistant.tsx - Header Section

{/* Simple voice indicator (only show when listening) */}
{isListening && (
  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full
                  bg-primary/10 animate-pulse">
    {/* Mic icon */}
    <Mic className="h-3 w-3 text-primary" />

    {/* Animated waveform (3 bars) */}
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

    {/* Status text */}
    <span className="text-xs text-primary font-medium">
      Mendengarkan
    </span>
  </div>
)}
```

#### **Input Section - Voice Button & Input Field**

```typescript
// Location: AIAssistant.tsx - Input Section

<form onSubmit={handleSubmit}>
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

    {/* Text Input Field */}
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

    {/* Send/Stop Button */}
    {isLoading ? (
      <Button type="button" variant="destructive" onClick={cancelRequest}>
        Stop
      </Button>
    ) : (
      <Button type="submit" disabled={!input.trim()}>
        <Send className="h-4 w-4" />
      </Button>
    )}
  </div>

  {/* Error Message */}
  {voiceError && (
    <div className="flex items-center gap-2 mt-2 text-xs text-destructive">
      <AlertCircle className="h-3 w-3" />
      <span>{voiceError}</span>
    </div>
  )}
</form>
```

---

## 🗂️ State Management

### Voice Command States:

```typescript
// ┌───────────────────────────────────────────────────────────┐
// │                   STATE MACHINE                            │
// └───────────────────────────────────────────────────────────┘

States:
  ┌─────────────┐
  │   IDLE      │ → isListening = false, transcript = ""
  └──────┬──────┘
         │ User clicks mic or presses Ctrl+M
         ▼
  ┌─────────────┐
  │ LISTENING   │ → isListening = true, interim text updates
  └──────┬──────┘
         │
         ├──► INTERIM_RESULT → Update input field (real-time)
         │
         └──► FINAL_RESULT
              │
              ▼
         ┌─────────────┐
         │ SUBMITTING  │ → Auto-submit transcript to AI
         └──────┬──────┘
                │
                ▼
         ┌─────────────┐
         │ PROCESSING  │ → isLoading = true, waiting for AI
         └──────┬──────┘
                │
                ▼
         ┌─────────────┐
         │  COMPLETE   │ → Clear transcript, back to IDLE
         └─────────────┘

// Error States (any time):
  ┌─────────────┐
  │   ERROR     │ → error != null, show error message
  └─────────────┘
```

### State Synchronization:

```typescript
// ┌───────────────────────────────────────────────────────────┐
// │          Voice State → Input Field Sync                   │
// └───────────────────────────────────────────────────────────┘

1. Interim Transcript Update:
   interimTranscript changes → setInput(interimTranscript)
   ↓
   Input field shows real-time text as user speaks

2. Final Transcript Update:
   onResult callback fires → setInput(finalText)
   ↓
   Input field shows final confirmed text
   ↓
   Auto-submit after 100ms

3. Clear After Submit:
   isLoading = true → resetTranscript() after 1s
   ↓
   Voice state cleared, ready for next input
```

---

## ⚠️ Error Handling Flow

### Error Detection & Recovery:

```typescript
// ┌───────────────────────────────────────────────────────────┐
// │                  ERROR HANDLING FLOW                       │
// └───────────────────────────────────────────────────────────┘

ERROR SOURCE                    DETECTION                    RECOVERY
─────────────                   ─────────                    ────────

1. Browser Not Supported
   ├─ SpeechRecognition = null
   └─► Set isSupported = false
       └─► Disable voice button
           └─► Show tooltip: "Browser tidak mendukung"

2. Permission Denied
   ├─ onerror: "not-allowed"
   └─► Set error message
       └─► Show error below input
           └─► Guide user: "Allow microphone permission"

3. No Speech Detected
   ├─ onerror: "no-speech"
   └─► Set error message
       └─► Show error: "Tidak ada suara terdeteksi"
           └─► Auto-clear error after 3s
               └─► User can retry

4. Network Error
   ├─ onerror: "network"
   └─► Set error message
       └─► Show error: "Koneksi internet diperlukan"
           └─► Check internet connection

5. Audio Capture Error
   ├─ onerror: "audio-capture"
   └─► Set error message
       └─► Show error: "Microphone tidak dapat diakses"
           └─► Check mic hardware/settings

6. Auto-Stop Timeout
   ├─ setTimeout triggers (30s)
   └─► Call stopListening()
       └─► Recognition ends normally
           └─► Return to IDLE state
```

### Error Recovery Strategy:

```typescript
// ┌───────────────────────────────────────────────────────────┐
// │              ERROR RECOVERY MECHANISMS                     │
// └───────────────────────────────────────────────────────────┘

1. Automatic Retry (for transient errors):
   - Network errors
   - No-speech errors
   → Clear error after 3 seconds
   → User can click mic again to retry

2. Manual Recovery (for permission errors):
   - Not-allowed errors
   → Show clear instructions
   → Link to browser settings
   → Require user action

3. Graceful Degradation:
   - Browser not supported
   → Hide voice button
   → Voice features disabled
   → Text input still works

4. State Reset:
   - On any error
   → Set isListening = false
   → Clear interim transcript
   → Maintain input field state
   → User can continue with text input
```

---

## 🎯 Best Practices Implemented

### 1. **Performance Optimization**

- ✅ Use `useCallback` untuk methods (prevent re-creation)
- ✅ Use `useRef` untuk recognition instance (persist across renders)
- ✅ Cleanup on unmount (prevent memory leaks)
- ✅ Debounced interim updates (avoid excessive re-renders)

### 2. **User Experience**

- ✅ Real-time feedback (interim transcript)
- ✅ Visual indicators (waveform animation)
- ✅ Auto-submit (hands-free operation)
- ✅ Keyboard shortcuts (accessibility)
- ✅ Error messages in Indonesian (user-friendly)

### 3. **Error Handling**

- ✅ Comprehensive error detection
- ✅ User-friendly error messages
- ✅ Graceful degradation
- ✅ Recovery mechanisms

### 4. **Browser Compatibility**

- ✅ Check for SpeechRecognition support
- ✅ Fallback for unsupported browsers
- ✅ Vendor prefix handling (webkit, moz, ms)

### 5. **Security & Privacy**

- ✅ Audio not saved to server
- ✅ Processing by browser API only
- ✅ Permission request handled by browser
- ✅ Clear user consent

---

## 📝 Developer Checklist

When modifying voice commands:

- [ ] Update type definitions if API changes
- [ ] Test in Chrome, Safari, Edge
- [ ] Verify microphone permission flow
- [ ] Check error messages are clear
- [ ] Test auto-stop timeout
- [ ] Verify cleanup on unmount
- [ ] Test keyboard shortcut
- [ ] Check visual feedback animations
- [ ] Verify auto-submit works
- [ ] Test with poor internet connection
- [ ] Check error recovery flows

---

## 🔍 Debugging Tips

### Console Logs:

```typescript
// Enable debug mode dengan uncomment console.logs in:
// - useVoiceCommand.ts: recognition events
// - AIAssistant.tsx: integration points

// Useful logs:
[Voice] Recognition started
[Voice] Interim: "cari kopi..."
[Voice] Final: "cari kopi americano"
[Voice] Recognition ended
[Voice] Error: no-speech
```

### Browser DevTools:

```javascript
// Check recognition state in Console:
window.SpeechRecognition; // Should exist in supported browsers

// Check permissions:
navigator.permissions
  .query({ name: "microphone" })
  .then((result) => console.log(result.state));
```

---

**Happy Coding! 🎤💻**
