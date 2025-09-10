'use client'

import { useState, useCallback } from 'react'
import { useHomeAssistantTools } from './use-home-assistant-tools'

export interface ActionResult {
    type: 'success' | 'error' | 'info' | 'confirmation_needed'
    message: string
    action?: string
}

export interface ConfirmationData {
    action: string
    entity: string
    newState: string
    domain: string
    service: string
    entityId: string
}

interface ActionProcessor {
    processAction: (transcript: string) => Promise<ActionResult>
    isProcessing: boolean
    pendingConfirmation: ConfirmationData | null
    clearConfirmation: () => void
    retryCount: number
}

export function useActionProcessor(prfOutput: BufferSource | null): ActionProcessor {
    const [isProcessing, setIsProcessing] = useState(false)
    const [pendingConfirmation, setPendingConfirmation] = useState<ConfirmationData | null>(null)
    const [retryCount, setRetryCount] = useState(0)
    const haTools = useHomeAssistantTools(prfOutput)

    const executeTools = async (toolCalls: Array<{ name: string; parameters: Record<string, any> }>) => {
        const results: Record<string, any> = {}

        for (const toolCall of toolCalls) {
            console.log('Executing tool:', toolCall.name, toolCall.parameters)

            try {
                let result
                switch (toolCall.name) {
                    case 'get_entities':
                        result = await haTools.getEntities()
                        break
                    case 'get_entity_state':
                        result = await haTools.getEntityState(toolCall.parameters.entityId)
                        break
                    case 'find_entities_by_context':
                        result = await haTools.findEntitiesByContext(toolCall.parameters.context)
                        break
                    case 'call_service':
                        result = await haTools.callService(
                            toolCall.parameters.domain,
                            toolCall.parameters.service,
                            toolCall.parameters.entityId
                        )
                        break
                    default:
                        result = { success: false, error: `Unknown tool: ${toolCall.name}` }
                }

                results[toolCall.name] = result
                console.log('Tool result:', toolCall.name, result)
            } catch (error) {
                console.error('Tool execution error:', error)
                results[toolCall.name] = {
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error',
                }
            }
        }

        return results
    }

    const clearConfirmation = useCallback(() => {
        setPendingConfirmation(null)
        setRetryCount(0)
    }, [])

    const handleConfirmationResponse = useCallback(
        async (transcript: string, confirmation: ConfirmationData): Promise<ActionResult> => {
            const response = transcript.toLowerCase().trim()

            // Enhanced positive confirmation patterns
            const positivePatterns = [
                'yes',
                'yeah',
                'yep',
                'sure',
                'ok',
                'okay',
                'confirm',
                'do it',
                'go ahead',
                'proceed',
                'continue',
                'affirmative',
                'correct',
                'right',
                'absolutely',
            ]

            // Enhanced negative confirmation patterns
            const negativePatterns = [
                'no',
                'nope',
                'cancel',
                'stop',
                'abort',
                'never mind',
                'nevermind',
                'negative',
                "don't",
                'halt',
                'wait',
                'hold on',
            ]

            const isPositive = positivePatterns.some((pattern) => response.includes(pattern))
            const isNegative = negativePatterns.some((pattern) => response.includes(pattern))

            if (isPositive && !isNegative) {
                console.log('User confirmed action:', confirmation)

                try {
                    const result = await haTools.callService(
                        confirmation.domain,
                        confirmation.service,
                        confirmation.entityId
                    )

                    if (result.success) {
                        setPendingConfirmation(null)
                        setRetryCount(0)
                        return {
                            type: 'success',
                            message: `Successfully ${confirmation.action} ${confirmation.entity}.`,
                            action: 'action_executed',
                        }
                    } else {
                        return {
                            type: 'error',
                            message: `Failed to ${confirmation.action} ${confirmation.entity}: ${result.error}`,
                            action: 'action_failed',
                        }
                    }
                } catch (error) {
                    console.error('Confirmation execution error:', error)
                    return {
                        type: 'error',
                        message: `Failed to execute action: ${error instanceof Error ? error.message : 'Unknown error'}`,
                        action: 'action_failed',
                    }
                }
            }

            if (isNegative && !isPositive) {
                console.log('User cancelled action:', confirmation)
                setPendingConfirmation(null)
                setRetryCount(0)
                return {
                    type: 'info',
                    message: 'Action cancelled.',
                    action: 'action_cancelled',
                }
            }

            // If unclear response, ask again with more specific guidance
            setRetryCount((prev) => prev + 1)

            if (retryCount >= 2) {
                // After 3 attempts, cancel the confirmation
                setPendingConfirmation(null)
                setRetryCount(0)
                return {
                    type: 'info',
                    message: 'Confirmation timeout. Action cancelled for safety.',
                    action: 'confirmation_timeout',
                }
            }

            return {
                type: 'confirmation_needed',
                message: `I didn't understand your response. Please clearly say "yes" to ${confirmation.action} the ${confirmation.entity}, or "no" to cancel. (Attempt ${retryCount + 1} of 3)`,
                action: 'confirmation_retry',
            }
        },
        [haTools, retryCount]
    )

    const makeAgentRequest = async (body: any, retryAttempt = 0): Promise<any> => {
        const maxRetries = 2

        try {
            const response = await fetch('/api/agent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                // Add timeout to prevent hanging requests
                signal: AbortSignal.timeout(30000),
            })

            if (!response.ok) {
                throw new Error(`API request failed: ${response.status} ${response.statusText}`)
            }

            return await response.json()
        } catch (error) {
            console.error(`Agent API error (attempt ${retryAttempt + 1}):`, error)

            if (retryAttempt < maxRetries && error instanceof Error) {
                // Retry on network errors or timeouts
                if (error.name === 'TimeoutError' || error.message.includes('fetch')) {
                    console.log(`Retrying API request (${retryAttempt + 1}/${maxRetries})...`)
                    await new Promise((resolve) => setTimeout(resolve, 1000 * (retryAttempt + 1))) // Exponential backoff
                    return makeAgentRequest(body, retryAttempt + 1)
                }
            }

            throw error
        }
    }

    const processAction = useCallback(
        async (transcript: string): Promise<ActionResult> => {
            setIsProcessing(true)

            try {
                // Handle confirmation responses first
                if (pendingConfirmation) {
                    return await handleConfirmationResponse(transcript, pendingConfirmation)
                }

                // Generate a simple user ID based on session (better than hardcoded)
                const userId = `user-${Date.now().toString(36)}`

                console.log('Processing new action:', { transcript, userId })

                let result = await makeAgentRequest({
                    transcript,
                    userId,
                })

                console.log('Initial agent response:', result)

                // Handle tool execution
                if (result.type === 'tool_call_needed' && result.toolCalls) {
                    if (!haTools.isConfigured) {
                        return {
                            type: 'error',
                            message:
                                'Home Assistant is not configured. Please set up your Home Assistant connection in the settings first.',
                            action: 'configuration_needed',
                        }
                    }

                    console.log('Executing tools for user request...')
                    const toolResults = await executeTools(result.toolCalls)

                    // Send tool results back to agent
                    result = await makeAgentRequest({
                        transcript,
                        userId,
                        toolResults,
                    })

                    console.log('Final agent response:', result)
                }

                // Handle confirmation requests
                if (result.type === 'confirmation_needed' && result.confirmationData) {
                    setPendingConfirmation(result.confirmationData)
                    setRetryCount(0)
                    return {
                        type: 'confirmation_needed',
                        message: result.message,
                        action: result.action,
                    }
                }

                // Reset retry count on successful processing
                setRetryCount(0)

                return {
                    type: result.type,
                    message: result.message,
                    action: result.action,
                }
            } catch (error) {
                console.error('Action processing error:', error)

                // Provide more specific error messages based on error type
                let errorMessage = 'Sorry, I encountered an error while processing your request.'

                if (error instanceof Error) {
                    if (error.name === 'TimeoutError') {
                        errorMessage = 'Request timed out. Please check your connection and try again.'
                    } else if (error.message.includes('fetch')) {
                        errorMessage = 'Network error. Please check your internet connection.'
                    } else if (error.message.includes('500')) {
                        errorMessage = 'Server error. Please try again in a moment.'
                    }
                }

                return {
                    type: 'error',
                    message: errorMessage,
                    action: 'error',
                }
            } finally {
                setIsProcessing(false)
            }
        },
        [haTools, pendingConfirmation, handleConfirmationResponse, retryCount]
    )

    return {
        processAction,
        isProcessing,
        pendingConfirmation,
        clearConfirmation,
        retryCount,
    }
}
