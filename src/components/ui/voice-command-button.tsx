/**
 * VoiceCommandButton Component
 * Button untuk mengontrol voice input dengan visual feedback
 */

import React from "react";
import { Mic, MicOff, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

interface VoiceCommandButtonProps {
  isListening: boolean;
  isSupported: boolean;
  error?: string | null;
  onClick: () => void;
  disabled?: boolean;
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export function VoiceCommandButton({
  isListening,
  isSupported,
  error,
  onClick,
  disabled = false,
  size = "icon",
  className,
}: VoiceCommandButtonProps) {
  const getIcon = () => {
    if (error) return <AlertCircle className="h-4 w-4" />;
    if (isListening) return <Mic className="h-4 w-4" />;
    return <MicOff className="h-4 w-4 opacity-50" />;
  };

  const getVariant = () => {
    if (error) return "destructive" as const;
    if (isListening) return "default" as const;
    return "outline" as const;
  };

  const getTooltip = () => {
    if (!isSupported) return "Browser tidak mendukung Voice Commands";
    if (error) return error;
    if (isListening) return "Klik untuk stop (Ctrl+M)";
    return "Klik untuk mulai voice command (Ctrl+M)";
  };

  return (
    <div className="relative">
      <Button
        type="button"
        size={size}
        variant={getVariant()}
        onClick={onClick}
        disabled={disabled || !isSupported}
        className={cn(
          "relative transition-all duration-200",
          isListening && "animate-pulse shadow-lg shadow-primary/50",
          (!isSupported || disabled) && "cursor-not-allowed opacity-50",
          className,
        )}
        title={getTooltip()}
        aria-label={getTooltip()}
        aria-pressed={isListening}
      >
        {getIcon()}
      </Button>

      {/* Audio waveform saat listening */}
      {isListening && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 flex gap-0.5">
          {[4, 8, 6, 10, 5].map((height, i) => (
            <div
              key={i}
              className="w-0.5 bg-primary rounded-full animate-wave"
              style={{
                height: `${height}px`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
