'use client'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface TranscriptDisplayProps {
    transcript: string
    isProcessing: boolean
    isVisible: boolean
    className?: string
}

export function TranscriptDisplay({ transcript, isProcessing, isVisible, className }: TranscriptDisplayProps) {
    if (!isVisible) return null

    return (
        <Card
            className={cn(
                'w-full max-w-lg mx-4 p-6 min-h-[120px] flex items-center justify-center transition-all duration-300',
                'backdrop-blur-sm bg-card/80 border-border/50',
                className
            )}
        >
            {isProcessing ? (
                <div className="flex flex-col items-center space-y-3">
                    <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
                        <div
                            className="w-2 h-2 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: '0.2s' }}
                        />
                        <div
                            className="w-2 h-2 bg-primary rounded-full animate-bounce"
                            style={{ animationDelay: '0.4s' }}
                        />
                    </div>
                    <p className="text-sm text-muted-foreground">Processing your request...</p>
                </div>
            ) : (
                <div className="text-center space-y-2">
                    <p className="text-foreground leading-relaxed text-balance">
                        {transcript || 'Your speech will appear here...'}
                    </p>
                </div>
            )}
        </Card>
    )
}
