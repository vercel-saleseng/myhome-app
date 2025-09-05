'use client'

import { useState, useCallback } from 'react'

export interface ActionResult {
    type: 'success' | 'error' | 'info'
    message: string
    action?: string
}

interface ActionProcessor {
    processAction: (transcript: string) => Promise<ActionResult>
    isProcessing: boolean
}

export function useActionProcessor(): ActionProcessor {
    const [isProcessing, setIsProcessing] = useState(false)

    const processAction = useCallback(async (transcript: string): Promise<ActionResult> => {
        setIsProcessing(true)

        try {
            // Simulate processing delay
            await new Promise((resolve) => setTimeout(resolve, 1500))

            const command = transcript.toLowerCase().trim()

            // Weather queries
            if (command.includes('weather')) {
                return {
                    type: 'success',
                    message:
                        "I'd love to help with weather information! In a full implementation, I would connect to a weather API to get current conditions for your location.",
                    action: 'weather_query',
                }
            }

            // Time queries
            if (command.includes('time') || command.includes('what time')) {
                const currentTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                return {
                    type: 'success',
                    message: `The current time is ${currentTime}.`,
                    action: 'time_query',
                }
            }

            // Reminder commands
            if (command.includes('remind') || command.includes('reminder')) {
                return {
                    type: 'success',
                    message:
                        "I've noted your reminder request! In a complete system, I would integrate with your calendar or reminder app to set this up.",
                    action: 'set_reminder',
                }
            }

            // Joke requests
            if (command.includes('joke') || command.includes('funny')) {
                const jokes = [
                    "Why don't scientists trust atoms? Because they make up everything!",
                    'I told my wife she was drawing her eyebrows too high. She looked surprised.',
                    "Why don't programmers like nature? It has too many bugs!",
                    'What do you call a fake noodle? An impasta!',
                    'Why did the AI go to therapy? It had too many deep learning issues!',
                ]
                const randomJoke = jokes[Math.floor(Math.random() * jokes.length)]
                return {
                    type: 'success',
                    message: randomJoke,
                    action: 'tell_joke',
                }
            }

            // Email/writing help
            if (command.includes('email') || command.includes('write') || command.includes('help me write')) {
                return {
                    type: 'success',
                    message:
                        'I can help you with writing! In a full implementation, I would open a writing assistant interface where we could collaborate on your email or document.',
                    action: 'writing_help',
                }
            }

            // News queries
            if (command.includes('news') || command.includes('latest')) {
                return {
                    type: 'success',
                    message:
                        'For the latest news, I would typically connect to news APIs to provide current headlines. This feature would be available in the complete version!',
                    action: 'news_query',
                }
            }

            // Greetings
            if (command.includes('hello') || command.includes('hi') || command.includes('hey')) {
                return {
                    type: 'success',
                    message:
                        "Hello! I'm your AI voice assistant. I'm here to help with questions, reminders, and various tasks. What can I do for you today?",
                    action: 'greeting',
                }
            }

            // General questions
            if (command.includes('how are you') || command.includes('how do you')) {
                return {
                    type: 'success',
                    message:
                        "I'm doing great, thank you for asking! I'm an AI assistant designed to help you with various tasks through voice interaction. How can I assist you today?",
                    action: 'general_question',
                }
            }

            // Default response for unrecognized commands
            return {
                type: 'info',
                message: `I heard you say: "${transcript}". I'm still learning to understand all types of requests. Try asking about the weather, time, setting reminders, or requesting a joke!`,
                action: 'unknown_command',
            }
        } catch (error) {
            console.log('[v0] Action processing error:', error)
            return {
                type: 'error',
                message: 'Sorry, I encountered an error while processing your request. Please try again.',
                action: 'error',
            }
        } finally {
            setIsProcessing(false)
        }
    }, [])

    return {
        processAction,
        isProcessing,
    }
}
