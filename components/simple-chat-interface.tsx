'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, Bot, User } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useHomeAssistantWebSocket } from '@/hooks/use-home-assistant-websocket'
import { useHomeAssistantConfig } from '@/hooks/use-home-assistant-config'
import { useSpeechRecognition } from '@/hooks/use-speech-recognition'
import { VoiceButton } from '@/components/voice-button'
import { HomeAssistantStatus } from '@/components/home-assistant-status'
import { HomeAssistantConfig } from '@/components/home-assistant-config'
import type { UserModelMessage, ModelMessage, AssistantModelMessage, ToolModelMessage, TypedToolCall, TypedToolResult } from 'ai'
import HomeAssistantToolset from '@/lib/home-assistant-toolset'

interface ChatInterfaceProps {
    prfOutput: BufferSource | null
    onConfirmation?: (confirmed: boolean, data?: any) => void
}

export function SimpleChatInterface({ prfOutput, onConfirmation }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<ModelMessage[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content:
                `Hi! I'm your Home Assistant voice assistant. You can ask me to check on your devices or control them. Try saying something like "Is the garage door open?" or "Open the front door".`,
            timestamp: new Date(),
        },
    ])
    const [input, setInput] = useState('')
    const [isLoading, setIsLoading] = useState(false)
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

    // Handle voice transcript
    useEffect(() => {
        if (!isListening && transcript.trim()) {
            setInput(transcript)
            handleSendMessage(transcript)
            resetTranscript()
        }
    }, [isListening, transcript])

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom()
    }, [messages])

    const executeTools = async (toolCalls: Array<TypedToolCall<typeof HomeAssistantToolset>>) => {
        const results: Array<TypedToolResult<typeof HomeAssistantToolset>> = []

        for (const toolCall of toolCalls) {
            console.log('Executing tool:', toolCall.toolName, toolCall.input)

            try {
                let output
                switch (toolCall.toolName) {
                    case 'get_entities':
                        output = await haTools.getEntities()
                        break
                    case 'get_entity_state':
                        output = await haTools.getEntityState(toolCall.input.entityId)
                        break
                    case 'find_entities_by_context':
                        output = await haTools.findEntitiesByContext(toolCall.input.context)
                        break
                    case 'request_confirmation':
                        setPendingConfirmation(toolCall.input)
                        output = {
                            success: true,
                            message: `Confirmation requested: ${toolCall.input.action}`,
                            requiresUserInput: true,
                        }
                        break
                    case 'call_service':
                        output = await haTools.callService(
                            toolCall.input.domain,
                            toolCall.input.service,
                            toolCall.input.entityId
                        )
                        break
                    default:
                        output = { success: false, error: `Unknown tool: ${toolCall.toolName}` }
                }

                results.push({
                    type: 'tool-result',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    input: toolCall.input,
                    output
                })
            } catch (error) {
                console.error('Tool execution error:', error)
                results.push({
                    type: 'tool-result',
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    input: toolCall.input,
                    output: {
                        success: false,
                        error: error instanceof Error ? error.message : 'Unknown error',
                    },
                })
            }
        }

        return results
    }

    const callChatAPI = async (userMessage: string, conversationHistory: ModelMessage[]) => {
        const apiMessages = conversationHistory.map((msg) => ({
            role: msg.role,
            content: msg.content,
        }))

        // Add the new user message if provided
        if (userMessage.trim()) {
            apiMessages.push({ role: 'user', content: userMessage })
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messages: apiMessages }),
        })

        if (!response.ok) {
            throw new Error(`Chat API error: ${response.status}`)
        }

        const result = await response.json()
        if (result.error) {
            throw new Error(result.error)
        }

        return {
            content: result.content || '',
            toolCalls: result.toolCalls || [],
        }
    }

    const handleSendMessage = async (messageText?: string) => {
        const messageToSend = messageText || input.trim()
        if (!messageToSend) return

        if (pendingConfirmation) {
            const isConfirmed = ['yes', 'ok', 'confirm', 'sure', 'do it', 'go ahead'].some((word) =>
                messageToSend.toLowerCase().includes(word)
            )

            const userMessage: UserModelMessage = {
                role: 'user',
                content: messageToSend,
            }

            setMessages((prev) => [...prev, userMessage])
            setIsLoading(true)

            try {
                if (isConfirmed) {
                    // Execute the confirmed action
                    const result = await haTools.callService(
                        pendingConfirmation.domain,
                        pendingConfirmation.service,
                        pendingConfirmation.entityId
                    )

                    const responseMessage: AssistantModelMessage = {
                        role: 'assistant',
                        content: result.success
                            ? `Successfully ${pendingConfirmation.action} ${pendingConfirmation.entity}.`
                            : `Failed to ${pendingConfirmation.action}: ${result.error}`,
                    }

                    setMessages((prev) => [...prev, responseMessage])
                } else {
                    // Cancel the action
                    const responseMessage: AssistantModelMessage = {
                        role: 'assistant',
                        content: 'Action cancelled.',
                    }
                    setMessages((prev) => [...prev, responseMessage])
                }
            } catch (error) {
                const errorMessage: ModelMessage = {
                    role: 'assistant',
                    content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                }
                setMessages((prev) => [...prev, errorMessage])
            }

            setPendingConfirmation(null)
            setIsLoading(false)
            setInput('')
            return
        }

        // Normal message flow
        const userMessage: UserModelMessage = {
            role: 'user',
            content: messageToSend,
        }

        setMessages((prev) => [...prev, userMessage])
        setIsLoading(true)
        setInput('')

        try {
            const { content, toolCalls } = await callChatAPI(messageToSend, messages)

            // Execute any tools requested by the AI
            let toolResults: any[] = []
            if (toolCalls && toolCalls.length > 0) {
                toolResults = await executeTools(toolCalls)
            }

            // Create assistant message
            const assistantMessage: ToolModelMessage = {
                role: 'tool',
                content: content || 'Processing your request...',
                toolCalls: toolResults,
            }

            setMessages((prev) => [...prev, assistantMessage])

            // If there were tool results and no pending confirmation, make a follow-up call
            if (toolResults.length > 0 && !pendingConfirmation) {
                const updatedHistory = [...messages, userMessage, assistantMessage]

                // Add tool results context
                const toolResultsMessage = `Tool results: ${JSON.stringify(toolResults.map((r) => ({ tool: r.name, result: r.result })))}`

                const { content: followUpContent } = await callChatAPI(toolResultsMessage, updatedHistory)

                if (followUpContent.trim()) {
                    const followUpMessage: AssistantModelMessage = {
                        role: 'assistant',
                        content: followUpContent,
                    }
                    setMessages((prev) => [...prev, followUpMessage])
                }
            }
        } catch (error) {
            console.error('Chat error:', error)
            const errorMessage: AssistantModelMessage = {
                role: 'assistant',
                content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }
            setMessages((prev) => [...prev, errorMessage])
        } finally {
            setIsLoading(false)
        }
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
        return content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>')
    }

    return (
        <div className="flex flex-col h-full max-w-4xl mx-auto">
            <div className="flex items-center justify-center py-8">
                <VoiceButton isListening={isListening} isProcessing={isLoading} onToggle={toggleListening} />
            </div>

            <Card className="flex-1 flex flex-col min-h-0">
                <ScrollArea className="flex-1 p-4" ref={scrollRef}>
                    <div className="space-y-4">
                        {messages.map((message) => (
                            <div
                                key={message.id}
                                className={`flex items-start space-x-3 ${
                                    message.role === 'user' ? 'justify-end' : 'justify-start'
                                }`}
                            >
                                {message.role === 'assistant' && (
                                    <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                                        <Bot className="w-4 h-4 text-primary-foreground" />
                                    </div>
                                )}
                                <div
                                    className={`max-w-[80%] rounded-lg px-3 py-2 ${
                                        message.role === 'user'
                                            ? 'bg-primary text-primary-foreground ml-auto'
                                            : 'bg-muted'
                                    }`}
                                >
                                    <div
                                        className="text-sm"
                                        dangerouslySetInnerHTML={{ __html: formatMessageContent(message.content) }}
                                    />
                                    {message.toolCalls && message.toolCalls.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {message.toolCalls.map((tool, index) => (
                                                <Badge key={index} variant="secondary" className="text-xs">
                                                    {tool.name}
                                                </Badge>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {message.role === 'user' && (
                                    <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                                        <User className="w-4 h-4 text-secondary-foreground" />
                                    </div>
                                )}
                            </div>
                        ))}

                        {isLoading && (
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
                                onClick={() => handleSendMessage('Yes, do it')}
                                className="bg-green-600 hover:bg-green-700"
                            >
                                Confirm
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleSendMessage('No, cancel')}>
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}

                <div className="p-4 border-t">
                    <div className="flex space-x-2">
                        <div className="flex-1 relative">
                            <Input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={
                                    isListening ? 'Listening...' : 'Ask me about your Home Assistant devices...'
                                }
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault()
                                        handleSendMessage()
                                    }
                                }}
                                disabled={isLoading || isListening}
                                className={isListening ? 'bg-red-50 dark:bg-red-950/20' : ''}
                            />
                            {transcript && (
                                <div className="absolute inset-0 bg-transparent pointer-events-none flex items-center px-3">
                                    <span className="text-muted-foreground">{transcript}</span>
                                </div>
                            )}
                        </div>

                        <Button
                            type="submit"
                            size="icon"
                            onClick={() => handleSendMessage()}
                            disabled={!input.trim() || isLoading || isListening}
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>

                    {!haTools.isConfigured && (
                        <p className="text-xs text-muted-foreground mt-2">
                            Configure Home Assistant in settings to control devices
                        </p>
                    )}

                    {error && <p className="text-xs text-red-500 mt-2">Voice recognition error: {error}</p>}
                </div>
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
