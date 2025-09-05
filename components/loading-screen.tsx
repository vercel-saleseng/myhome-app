"use client"

import { Card } from "@/components/ui/card"
import { Bot, Loader2 } from "lucide-react"

interface LoadingScreenProps {
  message?: string
}

export function LoadingScreen({ message = "Loading..." }: LoadingScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8 space-y-6">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 relative">
            <Bot className="w-8 h-8 text-primary-foreground" />
            <Loader2 className="w-6 h-6 text-primary-foreground absolute animate-spin" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-foreground">Voice Assistant</h2>
            <p className="text-muted-foreground">{message}</p>
          </div>
        </div>
      </Card>
    </div>
  )
}
