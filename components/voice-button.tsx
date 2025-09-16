'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceButtonProps {
    isListening: boolean
    isProcessing: boolean
    onToggle: () => void
    className?: string
}

export function VoiceButton({ isListening, isProcessing, onToggle, className }: VoiceButtonProps) {
    const [pulseKey, setPulseKey] = useState(0)

    useEffect(() => {
        if (isListening) {
            setPulseKey((prev) => prev + 1)
        }
    }, [isListening])

    return (
        <div className={cn('relative flex items-center justify-center', className)}>
            {/* Animated rings when listening */}
            {isListening && (
                <>
                    <div key={`ring1-${pulseKey}`} className="absolute inset-0 rounded-full bg-primary/20 pulse-ring" />
                    <div
                        key={`ring2-${pulseKey}`}
                        className="absolute inset-0 rounded-full bg-primary/10 pulse-ring"
                        style={{ animationDelay: '0.5s' }}
                    />
                    <div
                        key={`ring3-${pulseKey}`}
                        className="absolute inset-0 rounded-full bg-primary/5 pulse-ring"
                        style={{ animationDelay: '1s' }}
                    />
                </>
            )}

            {/* Main button */}
            <button
                onClick={onToggle}
                disabled={isProcessing}
                className={cn(
                    'w-36 h-36',
                    'rounded-full text-2xl',
                    'transition-all duration-300 shadow-lg',
                    'inline-flex items-center justify-center',
                    'font-medium disabled:pointer-events-none',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2',
                    isListening
                        ? 'bg-destructive hover:bg-destructive/90 text-white listening-glow scale-110 focus:ring-destructive'
                        : 'bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105 focus:ring-primary',
                    isProcessing && 'opacity-50 cursor-not-allowed'
                )}
            >
                {isListening ? <MicOff className="w-16 h-16" /> : <Mic className="w-16 h-16" />}
            </button>

            {/* Processing indicator */}
            {isProcessing && (
                <div className="absolute inset-0 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
            )}
        </div>
    )
}
