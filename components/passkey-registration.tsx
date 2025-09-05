"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Shield, Loader2, AlertCircle } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface PasskeyRegistrationProps {
  onRegister: (username: string, displayName: string) => Promise<void>
  isLoading: boolean
  error: string | null
}

export function PasskeyRegistration({ onRegister, isLoading, error }: PasskeyRegistrationProps) {
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!username.trim() || !displayName.trim()) return

    try {
      await onRegister(username.trim(), displayName.trim())
    } catch (err) {
      // Error is handled by the parent component
    }
  }

  return (
    <Card className="w-full max-w-md p-6 space-y-4">
      <div className="text-center space-y-2">
        <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center mx-auto">
          <Shield className="w-6 h-6 text-primary-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">Create Your Passkey</h2>
        <p className="text-sm text-muted-foreground text-pretty">
          Set up secure, passwordless authentication for your voice assistant
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="displayName">Display Name</Label>
          <Input
            id="displayName"
            type="text"
            placeholder="Enter your display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            disabled={isLoading}
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || !username.trim() || !displayName.trim()}>
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating Passkey...
            </>
          ) : (
            <>
              <Shield className="w-4 h-4 mr-2" />
              Create Passkey
            </>
          )}
        </Button>
      </form>

      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Your passkey will be stored securely on this device</p>
        <p>• Use your device's biometrics or PIN to authenticate</p>
        <p>• Supports encrypted secret storage with PRF extension</p>
      </div>
    </Card>
  )
}
