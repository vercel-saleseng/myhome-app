"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Bot, Key, AlertCircle, Settings, Shield } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { VoiceButton } from "@/components/voice-button"
import { TranscriptDisplay } from "@/components/transcript-display"
import { VoiceStatus } from "@/components/voice-status"
import { AppHeader } from "@/components/app-header"
import { ActionResultDisplay } from "@/components/action-result"
import { PasskeyRegistration } from "@/components/passkey-registration"
import { SecretManager } from "@/components/secret-manager"
import { OnboardingFlow } from "@/components/onboarding-flow"
import { LoadingScreen } from "@/components/loading-screen"
import { MobileSecretManager } from "@/components/mobile-secret-manager"
import { useSpeechRecognition } from "@/hooks/use-speech-recognition"
import { useActionProcessor, type ActionResult } from "@/hooks/use-action-processor"
import { usePasskey } from "@/hooks/use-passkey"

const LoginPage = ({
  onRegisterPasskey,
  onAuthenticatePasskey,
  hasPasskey,
  isSupported,
  isLoading,
  error,
  showOnboarding,
  onSkipOnboarding,
}: {
  onRegisterPasskey: (username: string, displayName: string) => Promise<void>
  onAuthenticatePasskey: () => Promise<void>
  hasPasskey: boolean
  isSupported: boolean
  isLoading: boolean
  error: string | null
  showOnboarding: boolean
  onSkipOnboarding: () => void
}) => {
  const [showRegistration, setShowRegistration] = useState(!hasPasskey)

  if (showOnboarding) {
    return <OnboardingFlow onComplete={onSkipOnboarding} />
  }

  if (!isSupported) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-muted-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Voice Assistant</h1>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              WebAuthn passkeys are not supported in this browser. Please use Chrome, Edge, or Safari.
            </AlertDescription>
          </Alert>

          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-foreground">Recommended browsers:</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded bg-muted/50">Chrome</div>
              <div className="p-2 rounded bg-muted/50">Edge</div>
              <div className="p-2 rounded bg-muted/50">Safari</div>
            </div>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {showRegistration ? (
        <div className="w-full max-w-md space-y-4">
          <PasskeyRegistration onRegister={onRegisterPasskey} isLoading={isLoading} error={error} />
          {hasPasskey && (
            <div className="text-center">
              <Button variant="link" onClick={() => setShowRegistration(false)} className="text-sm">
                Already have a passkey? Sign in instead
              </Button>
            </div>
          )}
        </div>
      ) : (
        <Card className="w-full max-w-md p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-2xl font-bold text-foreground text-balance">Voice Assistant</h1>
            <p className="text-muted-foreground text-pretty">Sign in with your passkey</p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Button onClick={onAuthenticatePasskey} className="w-full h-12 text-base" disabled={isLoading}>
              <Key className="w-5 h-5 mr-3" />
              {isLoading ? "Authenticating..." : "Sign in with Passkey"}
            </Button>

            <Button onClick={() => setShowRegistration(true)} variant="outline" className="w-full" disabled={isLoading}>
              Create New Passkey
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center text-pretty">
            By using this app, you agree to our Terms of Service and Privacy Policy
          </p>
        </Card>
      )}
    </div>
  )
}

const VoiceInterface = ({
  user,
  onSignOut,
  prfOutput,
}: {
  user: { name: string; email: string }
  onSignOut: () => void
  prfOutput: ArrayBuffer | null
}) => {
  const [actionResult, setActionResult] = useState<ActionResult | null>(null)
  const [showSecrets, setShowSecrets] = useState(false)

  const { transcript, isListening, isSupported, error, startListening, stopListening, resetTranscript } =
    useSpeechRecognition()

  const { processAction, isProcessing } = useActionProcessor()

  const toggleListening = async () => {
    if (isListening) {
      stopListening()
      // Process the transcript if we have one
      if (transcript.trim()) {
        console.log("[v0] Processing transcript:", transcript)
        const result = await processAction(transcript)
        setActionResult(result)
        resetTranscript()
      }
    } else {
      resetTranscript()
      setActionResult(null)
      startListening()
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader user={user} onSignOut={onSignOut}>
        <Dialog open={showSecrets} onOpenChange={setShowSecrets}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="hidden sm:flex">
              <Settings className="w-4 h-4 mr-2" />
              Secrets
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Encrypted Secret Storage</DialogTitle>
            </DialogHeader>
            <SecretManager prfOutput={prfOutput} />
          </DialogContent>
        </Dialog>

        <MobileSecretManager prfOutput={prfOutput} />
      </AppHeader>

      <main className="flex flex-col items-center justify-center min-h-[calc(100vh-4rem)] p-4 space-y-8">
        {/* Voice Button */}
        <VoiceButton
          isListening={isListening}
          isProcessing={isProcessing}
          onToggle={toggleListening}
          className="mb-4"
        />

        {/* Status Text */}
        <VoiceStatus
          isListening={isListening}
          isProcessing={isProcessing}
          hasTranscript={!!transcript.trim()}
          error={error}
          isSupported={isSupported}
        />

        {/* Transcript Display */}
        <TranscriptDisplay
          transcript={transcript}
          isProcessing={isProcessing}
          isVisible={!!(transcript || isProcessing)}
        />

        <ActionResultDisplay result={actionResult} isVisible={!!actionResult && !isProcessing && !transcript} />

        {!isListening && !isProcessing && !transcript && !actionResult && isSupported && !error && (
          <div className="mt-8 text-center space-y-4 max-w-sm mx-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50 hover:bg-muted/70 transition-colors">
                <p className="font-medium text-foreground mb-1">Ask questions</p>
                <p className="text-muted-foreground">"What's the weather like?"</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50 hover:bg-muted/70 transition-colors">
                <p className="font-medium text-foreground mb-1">Set reminders</p>
                <p className="text-muted-foreground">"Remind me to call mom"</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50 hover:bg-muted/70 transition-colors">
                <p className="font-medium text-foreground mb-1">Get help</p>
                <p className="text-muted-foreground">"Help me write an email"</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 border border-border/50 hover:bg-muted/70 transition-colors">
                <p className="font-medium text-foreground mb-1">General chat</p>
                <p className="text-muted-foreground">"Tell me a fun fact"</p>
              </div>
            </div>

            {prfOutput && (
              <div className="mt-4 p-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-700 dark:text-green-300 flex items-center justify-center">
                  <Shield className="w-3 h-3 mr-1" />
                  Encrypted storage enabled
                </p>
              </div>
            )}
          </div>
        )}

        {!isSupported && (
          <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border/50 max-w-md mx-auto">
            <h3 className="font-medium text-foreground mb-2">Browser Compatibility</h3>
            <p className="text-sm text-muted-foreground mb-3">Speech recognition works best in:</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Chrome (recommended)</li>
              <li>• Microsoft Edge</li>
              <li>• Safari (iOS/macOS)</li>
            </ul>
          </div>
        )}
      </main>
    </div>
  )
}

export default function HomePage() {
  const [actionResult, setActionResult] = useState<ActionResult | null>(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isInitializing, setIsInitializing] = useState(true)

  const {
    isSupported,
    hasPasskey,
    user,
    isLoading,
    error,
    isAuthenticated,
    registerPasskey,
    authenticatePasskey,
    signOut,
    clearPasskey,
    getPRFOutput,
  } = usePasskey()

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem("has-seen-onboarding")
    if (!hasSeenOnboarding && !hasPasskey) {
      setShowOnboarding(true)
    }
    setIsInitializing(false)
  }, [hasPasskey])

  const handleSkipOnboarding = () => {
    localStorage.setItem("has-seen-onboarding", "true")
    setShowOnboarding(false)
  }

  const handleRegisterPasskey = async (username: string, displayName: string) => {
    try {
      await registerPasskey(username, displayName)
      localStorage.setItem("has-seen-onboarding", "true")
    } catch (err) {
      // Error is handled by the hook
    }
  }

  const handleAuthenticatePasskey = async () => {
    try {
      await authenticatePasskey()
    } catch (err) {
      // Error is handled by the hook
    }
  }

  const handleSignOut = () => {
    signOut()
    setActionResult(null)
  }

  if (isInitializing) {
    return <LoadingScreen message="Initializing Voice Assistant..." />
  }

  if (!isAuthenticated) {
    return (
      <LoginPage
        onRegisterPasskey={handleRegisterPasskey}
        onAuthenticatePasskey={handleAuthenticatePasskey}
        hasPasskey={hasPasskey}
        isSupported={isSupported}
        isLoading={isLoading}
        error={error}
        showOnboarding={showOnboarding}
        onSkipOnboarding={handleSkipOnboarding}
      />
    )
  }

  return (
    <VoiceInterface user={user || { name: "User", email: "" }} onSignOut={handleSignOut} prfOutput={getPRFOutput()} />
  )
}
