/**
 * VoiceTranscriptDisplay Component
 * Display real-time transcript dari voice recognition
 */

import React, { useEffect, useRef } from "react";
import { Mic, Volume2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

interface VoiceTranscriptDisplayProps {
  transcript: string;
  interimTranscript?: string;
  isListening: boolean;
  error?: string | null;
  className?: string;
  maxHeight?: string;
  placeholder?: string;
}

export function VoiceTranscriptDisplay({
  transcript,
  interimTranscript = "",
  isListening,
  error,
  className,
  maxHeight = "150px",
  placeholder = "Klik tombol mic untuk mulai...",
}: VoiceTranscriptDisplayProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [transcript, interimTranscript]);

  const isEmpty = !transcript && !interimTranscript && !isListening;

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        isListening && "ring-2 ring-primary ring-offset-2",
        error && "ring-2 ring-destructive ring-offset-2",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b p-2 bg-muted/30">
        <div className="flex items-center gap-2">
          {error ? (
            <AlertCircle className="h-4 w-4 text-destructive" />
          ) : isListening ? (
            <Mic className="h-4 w-4 text-primary animate-pulse" />
          ) : (
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-xs font-medium">
            {error ? (
              <span className="text-destructive">Error</span>
            ) : isListening ? (
              <span className="text-primary">Mendengarkan...</span>
            ) : transcript ? (
              <span className="text-muted-foreground">Selesai</span>
            ) : (
              <span className="text-muted-foreground">Voice Command</span>
            )}
          </span>
        </div>
      </div>

      {/* Content */}
      <div
        ref={contentRef}
        className="overflow-y-auto p-3"
        style={{ maxHeight }}
      >
        {error && (
          <div className="flex items-start gap-2 text-xs text-destructive">
            <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {!error && isEmpty && (
          <div className="flex flex-col items-center justify-center py-4 text-center">
            <Mic className="h-8 w-8 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground">{placeholder}</p>
          </div>
        )}

        {!error && (transcript || interimTranscript || isListening) && (
          <div className="space-y-1">
            {transcript && (
              <p className="text-xs leading-relaxed text-foreground">
                {transcript}
              </p>
            )}

            {interimTranscript && (
              <p className="text-xs leading-relaxed text-muted-foreground italic">
                {interimTranscript}
                <span className="inline-block w-0.5 h-3 bg-primary animate-pulse ml-1" />
              </p>
            )}

            {isListening && !transcript && !interimTranscript && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="flex gap-1">
                  <span
                    className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
                <span className="text-xs">Menunggu suara...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
