"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport, lastAssistantMessageIsCompleteWithToolCalls } from "ai"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Bot, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { useHomeAssistantWebSocket } from "@/hooks/use-home-assistant-websocket"
import { useHomeAssistantConfig } from "@/hooks/use-home-assistant-config"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { VoiceButton } from "@/components/voice-button"
import { HomeAssistantStatus } from "@/components/home-assistant-status"
import { HomeAssistantConfig } from "@/components/home-assistant-config"

interface ChatInterfaceProps {
  prfOutput: BufferSource | null
}

export function ModernChatInterface({ prfOutput }: ChatInterfaceProps) {
  const [input, setInput] = useState("")
  const [pendingConfirmation, setPendingConfirmation] = useState<any>(null)
  const [showConfig, setShowConfig] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const haTools = useHomeAssistantWebSocket(prfOutput)
  const { config } = useHomeAssistantConfig(prfOutput)

  const { transcript, isListening, isSupported, error, startListening, stopListening, resetTranscript } =
    useSpeechRecognition()

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  const { messages, addToolResult, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    initialMessages: [
      {
        id: "welcome",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `Hi! I'm your Home Assistant voice assistant. You can ask me to check on your devices or control them. Try saying something like "Is the garage door open?" or "Open the front door".`,
          },
        ],
      },
    ],
    async onToolCall({ toolCall }) {
      // Check if it's a dynamic tool first for proper type narrowing
      if (toolCall.dynamic) {
        return
      }

      console.log("Executing tool:", toolCall.toolName, toolCall.input)

      let result
      switch (toolCall.toolName) {
        case "get_entities":
          result = await haTools.getEntities()
          break
        case "get_entity_state":
          result = await haTools.getEntityState(toolCall.input.entityId)
          break
        case "find_entities_by_context":
          result = await haTools.findEntitiesByContext(toolCall.input.context)
          break
        case "request_confirmation":
          setPendingConfirmation(toolCall.input)
          result = {
            success: true,
            message: `Confirmation requested: ${toolCall.input.action}`,
            requiresUserInput: true,
          }
          break
        case "call_service":
          result = await haTools.callService(toolCall.input.domain, toolCall.input.service, toolCall.input.entityId)
          break
        default:
          result = { success: false, error: `Unknown tool: ${toolCall.toolName}` }
      }

      addToolResult({
        tool: toolCall.toolName,
        toolCallId: toolCall.toolCallId,
        output: result,
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    sendMessage({ text: input })
    setInput("")
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInput(e.target.value)
  }

  // Handle voice transcript
  useEffect(() => {
    if (!isListening && transcript.trim()) {
      setInput(transcript)
      sendMessage({ text: transcript })
      resetTranscript()
    }
  }, [isListening, transcript, resetTranscript, sendMessage])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Handle confirmation responses
  const handleConfirmationResponse = async (confirmed: boolean) => {
    if (!pendingConfirmation) return

    if (confirmed) {
      try {
        const result = await haTools.callService(
          pendingConfirmation.domain,
          pendingConfirmation.service,
          pendingConfirmation.entityId,
        )

        addToolResult({
          tool: "request_confirmation",
          toolCallId: "confirmation-" + Date.now(),
          output: result.success
            ? `Successfully ${pendingConfirmation.action} ${pendingConfirmation.entity}.`
            : `Failed to ${pendingConfirmation.action}: ${result.error}`,
        })
      } catch (error) {
        addToolResult({
          tool: "request_confirmation",
          toolCallId: "confirmation-" + Date.now(),
          output: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
        })
      }
    } else {
      addToolResult({
        tool: "request_confirmation",
        toolCallId: "confirmation-" + Date.now(),
        output: "Action cancelled.",
      })
    }

    setPendingConfirmation(null)
  }

  const toggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      resetTranscript()
      startListening()
    }
  }

  const formatMessageContent = (content: string) => {
    return content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>").replace(/\*(.*?)\*/g, "<em>$1</em>")
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (pendingConfirmation) {
      const isConfirmed = ["yes", "ok", "confirm", "sure", "do it", "go ahead"].some((word) =>
        input.toLowerCase().includes(word),
      )
      handleConfirmationResponse(isConfirmed)
      setInput("")
    } else {
      handleSubmit(e)
    }
  }

  const renderMessageParts = (message: any) => {
    return (
      message.parts?.map((part: any, index: number) => {
        switch (part.type) {
          case "text":
            return (
              <div
                key={index}
                className="text-sm"
                dangerouslySetInnerHTML={{
                  __html: formatMessageContent(part.text || ""),
                }}
              />
            )
          case "tool-call":
            return (
              <Badge key={index} variant="secondary" className="text-xs mt-2">
                {part.toolName}
              </Badge>
            )
          default:
            return null
        }
      }) || (
        // Fallback for messages without parts (backwards compatibility)
        <div
          className="text-sm"
          dangerouslySetInnerHTML={{
            __html: formatMessageContent(message.content || ""),
          }}
        />
      )
    )
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Voice Button Section */}
      <div className="flex items-center justify-center py-8">
        <VoiceButton isListening={isListening} isProcessing={status === "in_progress"} onToggle={toggleListening} />
      </div>

      <Card className="flex-1 flex flex-col min-h-0">
        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex items-start space-x-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {message.role === "assistant" && (
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-primary-foreground" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    message.role === "user" ? "bg-primary text-primary-foreground ml-auto" : "bg-muted"
                  }`}
                >
                  {renderMessageParts(message)}
                </div>
                {message.role === "user" && (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}

            {status === "in_progress" && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary-foreground animate-pulse" />
                </div>
                <div className="bg-muted rounded-lg px-3 py-2">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.1s]" />
                    <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:0.2s]" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        {pendingConfirmation && (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border-t border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200 mb-2">
              <strong>Confirmation needed:</strong> {pendingConfirmation.message}
            </p>
            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={() => handleConfirmationResponse(true)}
                className="bg-green-600 hover:bg-green-700"
              >
                Confirm
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleConfirmationResponse(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="p-4 border-t">
          <div className="flex space-x-2">
            <div className="flex-1 relative">
              <Input
                name="message"
                value={input}
                onChange={handleInputChange}
                placeholder={isListening ? "Listening..." : "Ask me about your Home Assistant devices..."}
                disabled={status === "in_progress" || isListening}
                className={isListening ? "bg-red-50 dark:bg-red-950/20" : ""}
              />
              {transcript && (
                <div className="absolute inset-0 bg-transparent pointer-events-none flex items-center px-3">
                  <span className="text-muted-foreground">{transcript}</span>
                </div>
              )}
            </div>

            <Button type="submit" size="icon" disabled={!input.trim() || status === "in_progress" || isListening}>
              <Send className="w-4 h-4" />
            </Button>
          </div>

          {!haTools.isConfigured && (
            <p className="text-xs text-muted-foreground mt-2">
              Configure Home Assistant in settings to control devices
            </p>
          )}

          {error && <p className="text-xs text-red-500 mt-2">Voice recognition error: {error}</p>}
        </form>
      </Card>

      {/* Home Assistant Status */}
      <div className="mt-4">
        <HomeAssistantStatus
          connectionStatus={haTools.connectionStatus}
          hasConfig={!!(config.url && config.hasApiKey)}
          onOpenConfig={() => setShowConfig(true)}
          onTestConnection={haTools.testConnection}
          className="w-full max-w-64 mx-auto"
        />
      </div>

      {/* Configuration Dialog */}
      <Dialog open={showConfig} onOpenChange={setShowConfig}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Home Assistant Configuration</DialogTitle>
          </DialogHeader>
          <HomeAssistantConfig prfOutput={prfOutput} />
        </DialogContent>
      </Dialog>
    </div>
  )
}
