'use client'

import type React from 'react'

import { Button } from '@/components/ui/button'
import { Bot, User } from 'lucide-react'

interface AppHeaderProps {
    user: { name: string; email: string }
    onSignOut: () => void
    children?: React.ReactNode
}

export function AppHeader({ user, onSignOut, children }: AppHeaderProps) {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex h-16 items-center justify-between px-4 md:px-6">
                <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                        <Bot className="w-4 h-4 text-primary-foreground" />
                    </div>
                    <div className="hidden sm:block">
                        <h1 className="font-semibold text-foreground">MyHome Assistant</h1>
                        <p className="text-sm text-muted-foreground">Welcome, {user.name}</p>
                    </div>
                    <div className="sm:hidden">
                        <h1 className="font-semibold text-foreground text-sm">MyHome Assistant</h1>
                    </div>
                </div>

                <div className="flex items-center space-x-2">
                    {children}

                    <Button variant="ghost" size="sm" onClick={onSignOut}>
                        <User className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">Sign Out</span>
                    </Button>
                </div>
            </div>
        </header>
    )
}
