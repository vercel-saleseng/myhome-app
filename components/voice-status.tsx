"use client"

import { cn } from "@/lib/utils"
import { AlertCircle } from "lucide-react"

interface VoiceStatusProps {
  isListening: boolean
  isProcessing: boolean
  hasTranscript: boolean
  error?: string | null
  isSupported?: boolean
  className?: string
}

export function VoiceStatus({
  isListening,
  isProcessing,
  hasTranscript,
  error,
  isSupported = true,
  className,
}: VoiceStatusProps) {
  const getStatusText = () => {
    if (error) {
      return {
        primary: "Speech Recognition Error",
        secondary: error,
      }
    }

    if (!isSupported) {
      return {
        primary: "Not Supported",
        secondary: "Speech recognition is not available in this browser. Try Chrome, Edge, or Safari.",
      }
    }

    if (isProcessing) {
      return {
        primary: "Processing your request...",
        secondary: "Please wait while I understand what you said",
      }
    }

    if (isListening) {
      return {
        primary: "Listening...",
        secondary: "Speak clearly and I'll transcribe what you say",
      }
    }

    if (hasTranscript) {
      return {
        primary: "Ready to process",
        secondary: "Tap the microphone again to send your message",
      }
    }

    return {
      primary: "Tap to speak",
      secondary: "Press the microphone to start a conversation with your AI assistant",
    }
  }

  const status = getStatusText()

  return (
    <div className={cn("text-center space-y-2 max-w-md mx-auto px-4", className)}>
      {error && (
        <div className="flex items-center justify-center space-x-2 text-destructive mb-2">
          <AlertCircle className="w-4 h-4" />
        </div>
      )}

      <p
        className={cn(
          "text-lg font-medium transition-colors duration-300",
          error
            ? "text-destructive"
            : !isSupported
              ? "text-muted-foreground"
              : isProcessing
                ? "text-primary"
                : isListening
                  ? "text-foreground"
                  : hasTranscript
                    ? "text-primary"
                    : "text-muted-foreground",
        )}
      >
        {status.primary}
      </p>

      <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{status.secondary}</p>
    </div>
  )
}
