'use client'

import { Card } from '@/components/ui/card'
import { CheckCircle, AlertCircle, Info, Bot, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActionResult } from '@/hooks/use-action-processor'

interface ActionResultProps {
    result: ActionResult | null
    isVisible: boolean
    className?: string
    isWaitingForConfirmation?: boolean
}

export function ActionResultDisplay({ result, isVisible, className, isWaitingForConfirmation }: ActionResultProps) {
    if (!isVisible || !result) return null

    const getIcon = () => {
        if (result.type === 'confirmation_needed' || isWaitingForConfirmation) {
            return <Clock className="w-5 h-5 text-orange-500" />
        }

        switch (result.type) {
            case 'success':
                return <CheckCircle className="w-5 h-5 text-green-500" />
            case 'error':
                return <AlertCircle className="w-5 h-5 text-destructive" />
            case 'info':
                return <Info className="w-5 h-5 text-blue-500" />
            default:
                return <Bot className="w-5 h-5 text-primary" />
        }
    }

    const getBorderColor = () => {
        if (result.type === 'confirmation_needed' || isWaitingForConfirmation) {
            return 'border-orange-500/20'
        }

        switch (result.type) {
            case 'success':
                return 'border-green-500/20'
            case 'error':
                return 'border-destructive/20'
            case 'info':
                return 'border-blue-500/20'
            default:
                return 'border-border'
        }
    }

    return (
        <Card
            className={cn(
                'w-full max-w-lg mx-4 p-6 transition-all duration-300 animate-in slide-in-from-bottom-4',
                'backdrop-blur-sm bg-card/90',
                getBorderColor(),
                className
            )}
        >
            <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
                <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-2">
                        <Bot className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-primary">
                            {result.type === 'confirmation_needed' || isWaitingForConfirmation
                                ? 'Waiting for Confirmation'
                                : 'AI Assistant'}
                        </span>
                    </div>
                    <p className="text-foreground leading-relaxed text-balance">{result.message}</p>
                    {(result.type === 'confirmation_needed' || isWaitingForConfirmation) && (
                        <p className="text-xs text-muted-foreground italic">Say "yes" to confirm or "no" to cancel</p>
                    )}
                    {result.action && (
                        <p className="text-xs text-muted-foreground">Action: {result.action.replace('_', ' ')}</p>
                    )}
                </div>
            </div>
        </Card>
    )
}
