'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface SpeechRecognitionHook {
    transcript: string
    isListening: boolean
    isSupported: boolean
    error: string | null
    startListening: () => void
    stopListening: () => void
    resetTranscript: () => void
}

export function useSpeechRecognition(): SpeechRecognitionHook {
    const [transcript, setTranscript] = useState('')
    const [isListening, setIsListening] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const recognitionRef = useRef<SpeechRecognition | null>(null)

    // Check if speech recognition is supported
    const isSupported =
        typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

    const resetTranscript = useCallback(() => {
        setTranscript('')
        setError(null)
    }, [])

    const startListening = useCallback(() => {
        if (!isSupported) {
            setError('Speech recognition is not supported in this browser')
            return
        }

        try {
            // Create speech recognition instance
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
            const recognition = new SpeechRecognition()

            // Configure recognition settings
            //recognition.continuous = false
            recognition.interimResults = true
            recognition.lang = 'en-US'
            recognition.maxAlternatives = 1

            // Event handlers
            recognition.onstart = () => {
                setIsListening(true)
                setError(null)
                console.log('Speech recognition started')
            }

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                let finalTranscript = ''
                let interimTranscript = ''

                // Process all results
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i]
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript
                    } else {
                        interimTranscript += result[0].transcript
                    }
                }

                // Update transcript with final + interim results
                setTranscript(finalTranscript + interimTranscript)
                console.log('Speech result:', finalTranscript + interimTranscript)
            }

            recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
                console.log('Speech recognition error:', event.error)
                setError(`Speech recognition error: ${event.error}`)
                setIsListening(false)
            }

            recognition.onend = () => {
                console.log('Speech recognition ended')
                setIsListening(false)
            }

            // Start recognition
            recognition.start()
            recognitionRef.current = recognition
        } catch (err) {
            console.log('Error starting speech recognition:', err)
            setError('Failed to start speech recognition')
            setIsListening(false)
        }
    }, [isSupported])

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop()
            recognitionRef.current = null
        }
        setIsListening(false)
    }, [])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop()
            }
        }
    }, [])

    return {
        transcript,
        isListening,
        isSupported,
        error,
        startListening,
        stopListening,
        resetTranscript,
    }
}
