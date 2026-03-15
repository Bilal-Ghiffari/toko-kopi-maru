/**
 * useVoiceCommand Hook
 *
 * Custom React Hook untuk Web Speech API dengan browser compatibility support.
 * Hook ini menyediakan interface yang clean dan mudah digunakan untuk speech recognition.
 *
 * @description
 * Hook ini membungkus Web Speech API browser dengan fitur tambahan:
 * - Browser compatibility check dengan fallback
 * - Auto-stop timeout untuk mencegah listening terlalu lama
 * - Real-time interim results (transcript sementara)
 * - Comprehensive error handling dengan pesan user-friendly
 * - Automatic cleanup pada component unmount
 *
 * @example
 * ```tsx
 * const { transcript, isListening, toggleListening } = useVoiceCommand({
 *   onResult: (text) => console.log('Final:', text),
 *   language: 'id-ID',
 *   autoStop: 30000
 * });
 * ```
 */

import { useState, useEffect, useRef, useCallback } from "react";

// ============================================
// TYPE DEFINITIONS
// ============================================

/**
 * Interface untuk event hasil speech recognition dari browser
 * Extends Event API standard dengan properties khusus untuk speech
 */
interface SpeechRecognitionEvent extends Event {
  // results: Collection dari semua hasil recognition
  results: {
    length: number; // Jumlah total hasil
    // item(): Method untuk mengakses hasil by index
    item(index: number): {
      [index: number]: {
        transcript: string; // Text hasil recognition
        confidence: number; // Confidence score (0-1)
      };
      isFinal: boolean; // true = hasil final, false = interim (sementara)
      length: number; // Jumlah alternatif hasil
    };
    // Array accessor untuk akses langsung
    [index: number]: {
      [index: number]: {
        transcript: string;
        confidence: number;
      };
      isFinal: boolean;
      length: number;
    };
  };
  resultIndex: number; // Index dari hasil baru yang ditambahkan
}

/**
 * Interface untuk error event dari speech recognition
 * Berisi informasi detail tentang error yang terjadi
 */
interface SpeechRecognitionErrorEvent extends Event {
  error: string; // Error code (no-speech, not-allowed, etc)
  message: string; // Error message detail
}

/**
 * Options untuk konfigurasi useVoiceCommand hook
 * Semua properties adalah optional dengan default values
 */
interface UseVoiceCommandOptions {
  /** Callback dipanggil saat recognition selesai dengan hasil final */
  onResult?: (transcript: string) => void;

  /** Callback dipanggil saat ada interim result (real-time) */
  onInterimResult?: (transcript: string) => void;

  /** Language code untuk recognition (default: 'id-ID') */
  language?: string;

  /** Continuous mode - terus listening tanpa stop (default: false) */
  continuous?: boolean;

  /** Show interim results (real-time feedback, default: true) */
  interimResults?: boolean;

  /** Auto-stop timeout dalam milliseconds (default: 30000 = 30s) */
  autoStop?: number;
}

// ============================================
// MAIN HOOK
// ============================================

export function useVoiceCommand(options: UseVoiceCommandOptions = {}) {
  // Destructure options dengan default values
  // Ini memungkinkan caller untuk skip properties yang tidak diperlukan
  const {
    onResult, // Optional callback untuk final result
    onInterimResult, // Optional callback untuk interim result
    language = "id-ID", // Default Bahasa Indonesia
    continuous = false, // Default: stop setelah satu kalimat
    interimResults = true, // Default: show real-time feedback
    autoStop = 30000, // Default: 30 detik timeout
  } = options;

  // ============================================
  // STATE MANAGEMENT
  // ============================================

  /**
   * transcript: Final transcript text yang sudah confirmed
   * Ini adalah hasil akhir yang akan digunakan (bukan interim)
   */
  const [transcript, setTranscript] = useState("");

  /**
   * interimTranscript: Temporary transcript saat user masih bicara
   * Real-time text yang berubah-ubah sebelum finalized
   * Berguna untuk feedback visual kepada user
   */
  const [interimTranscript, setInterimTranscript] = useState("");

  /**
   * isListening: Flag boolean apakah sedang listening atau tidak
   * true = microphone aktif, false = microphone off
   */
  const [isListening, setIsListening] = useState(false);

  /**
   * isSupported: Flag boolean browser support Web Speech API
   * false jika browser tidak support (perlu fallback atau notification)
   */
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!(
      (window as Window & typeof globalThis & Record<string, unknown>)
        .SpeechRecognition ||
      (window as Window & typeof globalThis & Record<string, unknown>)
        .webkitSpeechRecognition ||
      (window as Window & typeof globalThis & Record<string, unknown>)
        .mozSpeechRecognition ||
      (window as Window & typeof globalThis & Record<string, unknown>)
        .msSpeechRecognition
    );
  });

  /**
   * error: Error message string jika ada kesalahan
   * null = tidak ada error, string = ada error dengan pesan
   */
  const [error, setError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const w = window as Window & typeof globalThis & Record<string, unknown>;
    const hasSpeechRecognition = !!(
      w.SpeechRecognition ||
      w.webkitSpeechRecognition ||
      w.mozSpeechRecognition ||
      w.msSpeechRecognition
    );
    return hasSpeechRecognition
      ? null
      : "Browser tidak mendukung Voice Commands. Gunakan Chrome, Edge, atau Safari.";
  });

  // ============================================
  // REFS (untuk persist values across renders)
  // ============================================

  /**
   * recognitionRef: Menyimpan instance SpeechRecognition
   * Menggunakan ref agar tidak recreate instance setiap render
   * Type 'any' karena SpeechRecognition belum standard di TypeScript
   */
  const recognitionRef = useRef<{
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    maxAlternatives: number;
    onstart: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start: () => void;
    stop: () => void;
  } | null>(null);

  /**
   * autoStopTimeoutRef: Menyimpan timeout ID untuk auto-stop
   * Digunakan untuk clear timeout saat component unmount atau manual stop
   */
  const autoStopTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ============================================
  // EFFECT: INITIALIZE SPEECH RECOGNITION
  // ============================================

  /**
   * Effect ini berjalan sekali saat component mount dan setup speech recognition
   * Dependencies: language, continuous, interimResults, callbacks, autoStop
   * Re-run jika salah satu dependency berubah
   */
  useEffect(() => {
    // Guard: Return early jika di server-side (no window object)
    if (typeof window === "undefined") return;

    // ---- Browser Compatibility Check ----
    // Coba berbagai vendor prefixes untuk SpeechRecognition API
    type SpeechRecognitionConstructor = new () => {
      lang: string;
      continuous: boolean;
      interimResults: boolean;
      maxAlternatives: number;
      onstart: (() => void) | null;
      onresult: ((event: SpeechRecognitionEvent) => void) | null;
      onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
      onend: (() => void) | null;
      start: () => void;
      stop: () => void;
    };
    const w = window as Window & typeof globalThis & Record<string, unknown>;
    const SpeechRecognition = (
      w.SpeechRecognition ||
      w.webkitSpeechRecognition ||
      w.mozSpeechRecognition ||
      w.msSpeechRecognition
    ) as SpeechRecognitionConstructor | undefined;

    // Jika browser tidak support, set flag dan show error
    if (!SpeechRecognition) {
      return; // Stop execution, error already set in initial state
    }

    // Browser support — isSupported already initialized via lazy useState

    // ---- Create Recognition Instance ----
    // Buat instance baru dari SpeechRecognition dengan config
    const recognition = new SpeechRecognition();

    // Config: Language untuk recognition
    recognition.lang = language;

    // Config: Continuous mode (true = tidak auto-stop)
    recognition.continuous = continuous;

    // Config: Interim results (true = show real-time feedback)
    recognition.interimResults = interimResults;

    // Config: Max alternatives (jumlah alternatif hasil)
    recognition.maxAlternatives = 1; // Kita hanya butuh 1 hasil terbaik

    // ============================================
    // EVENT HANDLERS
    // ============================================

    /**
     * onstart: Dipanggil saat recognition mulai (microphone aktif)
     * Update UI state untuk show bahwa sedang listening
     */
    recognition.onstart = () => {
      setIsListening(true); // Set flag listening ke true
      setError(null); // Clear error sebelumnya jika ada
      console.log("[Voice] Recognition started"); // Debug log
    };

    /**
     * onresult: Dipanggil setiap kali ada hasil recognition
     * Event ini bisa dipanggil multiple times (untuk interim & final results)
     *
     * @param event - SpeechRecognitionEvent dengan results array
     */
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      // Initialize accumulators untuk interim & final text
      let interimText = ""; // Untuk temporary results (masih berubah)
      let finalText = ""; // Untuk confirmed results (sudah fix)

      // ---- Loop Through Results ----
      // resultIndex: Starting index untuk hasil baru
      // results.length: Total jumlah hasil sejauh ini
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]; // Get result object
        const text = result[0].transcript; // Get transcript text (alternative pertama)

        // Check apakah hasil ini final atau masih interim
        if (result.isFinal) {
          // Final result: User selesai bicara untuk phrase ini
          finalText += text + " "; // Tambahkan space untuk join phrases
        } else {
          // Interim result: User masih bicara, text bisa berubah
          interimText += text; // Tidak perlu space (single phrase)
        }
      }

      // ---- Process Final Text ----
      if (finalText) {
        // Update transcript state (append ke existing)
        setTranscript((prev) => prev + finalText);

        // Call onResult callback jika provided
        // Trim untuk remove extra spaces
        onResult?.(finalText.trim());
      }

      // ---- Process Interim Text ----
      // Update interim transcript state (replace, bukan append)
      setInterimTranscript(interimText.trim());

      // Call onInterimResult callback jika provided
      onInterimResult?.(interimText.trim());

      // ---- Auto-stop for non-continuous mode ----
      // Jika dapat final result dan bukan continuous mode, stop recognition
      if (finalText && !continuous) {
        recognition.stop(); // Stop listening otomatis
      }
    };

    /**
     * onerror: Dipanggil saat terjadi error
     * Handle berbagai jenis error dan provide user-friendly messages
     *
     * @param event - SpeechRecognitionErrorEvent dengan error code
     */
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      // Default error message
      let errorMessage = "Terjadi kesalahan pada voice command.";

      // ---- Map error codes ke user-friendly messages ----
      switch (event.error) {
        case "no-speech":
          // User tidak bicara atau mic tidak detect audio
          errorMessage = "Tidak ada suara terdeteksi. Coba lagi.";
          break;

        case "audio-capture":
          // Mic tidak tersedia atau tidak bisa diakses
          errorMessage = "Microphone tidak dapat diakses.";
          break;

        case "not-allowed":
          // User menolak permission atau permission di-block
          errorMessage = "Permission microphone ditolak.";
          break;

        case "network":
          // Speech recognition butuh internet (Google's server)
          errorMessage = "Koneksi internet diperlukan.";
          break;

        case "aborted":
          // Recognition di-abort (biasanya manual stop)
          errorMessage = "Voice recognition dibatalkan.";
          break;

        // Default: use error message as-is
      }

      // Update state dengan error message
      setError(errorMessage);
      setIsListening(false); // Set listening flag ke false

      console.error("[Voice] Error:", event.error, errorMessage); // Debug log
    };

    /**
     * onend: Dipanggil saat recognition berakhir (microphone off)
     * Cleanup state dan clear timeout
     */
    recognition.onend = () => {
      setIsListening(false); // Set listening flag ke false
      setInterimTranscript(""); // Clear interim text

      // Clear auto-stop timeout jika ada
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null; // Reset ref
      }

      console.log("[Voice] Recognition ended"); // Debug log
    };

    // ---- Save recognition instance ke ref ----
    // Ini memungkinkan kita control recognition dari methods
    recognitionRef.current = recognition;

    // ============================================
    // CLEANUP FUNCTION
    // ============================================

    /**
     * Cleanup function dipanggil saat:
     * 1. Component unmount
     * 2. Dependencies berubah (re-run effect)
     *
     * Penting untuk cleanup untuk avoid memory leaks
     */
    return () => {
      // Stop recognition jika masih running
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // Ignore error jika sudah stopped
        }
      }

      // Clear auto-stop timeout
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current);
      }
    };
  }, [
    // ---- Effect Dependencies ----
    // Effect re-run jika salah satu dari ini berubah
    language, // Re-create jika language berubah
    continuous, // Re-create jika mode berubah
    interimResults, // Re-create jika config berubah
    onResult, // Re-create jika callback berubah
    onInterimResult, // Re-create jika callback berubah
    autoStop, // Re-create jika timeout berubah
  ]);

  // ============================================
  // PUBLIC METHODS (useCallback untuk optimization)
  // ============================================

  /**
   * startListening: Start voice recognition
   *
   * Flow:
   * 1. Validate preconditions (supported, not already listening)
   * 2. Reset state (transcript, error)
   * 3. Start recognition
   * 4. Setup auto-stop timeout
   *
   * @throws Error jika gagal start
   */
  /**
   * stopListening: Stop voice recognition
   *
   * Flow:
   * 1. Stop recognition instance
   * 2. Clear auto-stop timeout
   * 3. State akan di-update via onend event handler
   */
  const stopListening = useCallback(() => {
    // Check jika recognition instance exists
    if (!recognitionRef.current) return;

    try {
      // ---- Stop Recognition ----
      // Ini akan trigger onend event handler
      recognitionRef.current.stop();

      console.log("[Voice] Stopping recognition..."); // Debug log

      // ---- Clear Auto-Stop Timeout ----
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null;
      }
    } catch (err) {
      // ---- Error Handling ----
      // Ignore error jika recognition sudah stopped
      console.error("[Voice] Stop error (ignored):", err);
    }
  }, []); // No dependencies = stable function

  /**
   * startListening: Start voice recognition
   *
   * Flow:
   * 1. Validate preconditions (supported, not already listening)
   * 2. Reset state (transcript, error)
   * 3. Start recognition
   * 4. Setup auto-stop timeout
   *
   * @throws Error jika gagal start
   */
  const startListening = useCallback(() => {
    // ---- Validation Guards ----
    // Check jika recognition instance exists
    if (!recognitionRef.current) return;

    // Check jika browser support
    if (!isSupported) return;

    // Check jika sudah listening (prevent duplicate)
    if (isListening) return;

    try {
      // ---- Reset State ----
      // Clear previous transcript
      setTranscript("");
      setInterimTranscript("");
      setError(null);

      // ---- Start Recognition ----
      // Browser akan request microphone permission jika belum granted
      recognitionRef.current.start();

      console.log("[Voice] Starting recognition..."); // Debug log

      // ---- Setup Auto-Stop Timeout ----
      // Hanya jika autoStop > 0 (0 = disable auto-stop)
      if (autoStop > 0) {
        autoStopTimeoutRef.current = setTimeout(() => {
          console.log("[Voice] Auto-stop triggered"); // Debug log
          stopListening(); // Stop setelah timeout
        }, autoStop);
      }
    } catch (err) {
      // ---- Error Handling ----
      // Bisa gagal jika permission ditolak atau recognition error
      console.error("[Voice] Start error:", err);
      setError("Gagal memulai voice recognition.");
    }
  }, [isSupported, isListening, autoStop, stopListening]); // Dependencies untuk useCallback

  /**
   * toggleListening: Toggle voice recognition on/off
   *
   * Convenience method untuk UI button yang toggle state
   *
   * Flow:
   * - Jika listening: call stopListening()
   * - Jika tidak listening: call startListening()
   */
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening(); // Currently listening → stop
    } else {
      startListening(); // Currently not listening → start
    }
  }, [isListening, startListening, stopListening]); // Dependencies

  /**
   * resetTranscript: Clear all transcript text
   *
   * Berguna untuk reset state sebelum listening baru
   * atau untuk clear transcript setelah submit
   */
  const resetTranscript = useCallback(() => {
    setTranscript(""); // Clear final transcript
    setInterimTranscript(""); // Clear interim transcript
  }, []); // No dependencies

  /**
   * clearError: Clear error state
   *
   * Berguna untuk dismiss error message di UI
   */
  const clearError = useCallback(() => {
    setError(null); // Reset error ke null
  }, []); // No dependencies

  // ============================================
  // RETURN PUBLIC API
  // ============================================

  /**
   * Return object dengan state dan methods
   * Ini adalah public API yang bisa digunakan oleh caller
   */
  return {
    // ---- State (read-only) ----
    transcript, // Final transcript text
    interimTranscript, // Temporary transcript (real-time)
    isListening, // Boolean: sedang listening
    isSupported, // Boolean: browser support
    error, // Error message (string | null)

    // ---- Methods (functions) ----
    startListening, // Function: start voice input
    stopListening, // Function: stop voice input
    toggleListening, // Function: toggle on/off
    resetTranscript, // Function: clear transcript
    clearError, // Function: clear error
  };
}
