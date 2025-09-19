'use client'

import { useState, useEffect, type Dispatch, type SetStateAction } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Bot, Key, AlertCircle, Home, ExternalLink } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AppHeader } from '@/components/app-header'
import { PasskeyRegistration } from '@/components/passkey-registration'
import { HomeAssistantConfig } from '@/components/home-assistant-config'
import { LoadingScreen } from '@/components/loading-screen'
import { ModernChatInterface } from '@/components/modern-chat-interface'
import { AuthenticationSession, usePasskey } from '@/hooks/use-passkey'
import { useHomeAssistantConfig } from '@/hooks/use-home-assistant-config'

const LoginPage = ({
    onRegisterPasskey,
    onAuthenticatePasskey,
    isSupported,
    isLoading,
    error,
    setError,
    isBlocked,
}: {
    onRegisterPasskey: (username: string, displayName: string) => Promise<void>
    onAuthenticatePasskey: () => Promise<void>
    isSupported: boolean
    isLoading: boolean
    error: string | null
    setError: Dispatch<SetStateAction<string | null>>
    isBlocked: boolean
}) => {
    const [showRegistration, setShowRegistration] = useState(false)

    if (!isSupported) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-4">
                <Card className="w-full max-w-md p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                            <Bot className="w-8 h-8 text-muted-foreground" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">MyHome Assistant</h1>
                    </div>

                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {isBlocked ? (
                                <>
                                    WebAuthn is blocked by security policy. This app needs to run in a new tab or window
                                    to work properly.
                                </>
                            ) : (
                                <>WebAuthn Passkeys with the PRF extension are not supported in this browser.</>
                            )}
                        </AlertDescription>
                    </Alert>

                    {isBlocked ? (
                        <div className="space-y-4">
                            <Button onClick={() => window.open(window.location.href, '_blank')} className="w-full">
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Open in New Tab
                            </Button>
                            <div className="text-center space-y-2">
                                <p className="text-sm font-medium text-foreground">Why is this needed?</p>
                                <p className="text-xs text-muted-foreground text-pretty">
                                    For security reasons, Passkey authentication cannot work when this app is embedded
                                    in another page. Opening in a new tab allows full access to your device's security
                                    features.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center space-y-2">
                            <p className="text-sm font-medium text-foreground">Recommended browsers:</p>
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="p-2 rounded bg-muted/50">Chrome</div>
                                <div className="p-2 rounded bg-muted/50">Edge</div>
                                <div className="p-2 rounded bg-muted/50">Safari</div>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        )
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            {showRegistration ? (
                <div className="w-full max-w-md space-y-4">
                    <PasskeyRegistration onRegister={onRegisterPasskey} isLoading={isLoading} error={error} />
                    <div className="text-center">
                        <Button
                            variant="link"
                            onClick={() => {
                                setShowRegistration(false)
                                setError(null)
                            }}
                            className="text-sm"
                        >
                            Already have a Passkey? Sign in instead
                        </Button>
                    </div>
                </div>
            ) : (
                <Card className="w-full max-w-md p-8 space-y-6">
                    <div className="text-center space-y-2">
                        <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                            <Bot className="w-8 h-8 text-primary-foreground" />
                        </div>
                        <h1 className="text-2xl font-bold text-foreground text-balance">MyHome Assistant</h1>
                        <p className="text-muted-foreground text-pretty">Sign in with your Passkey</p>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-3">
                        <Button
                            onClick={onAuthenticatePasskey}
                            className="w-full h-12 text-base"
                            disabled={isLoading}
                            autoFocus={true}
                        >
                            <Key className="w-5 h-5 mr-3" />
                            {isLoading ? 'Authenticating...' : 'Sign in with Passkey'}
                        </Button>

                        <Button
                            onClick={() => {
                                setShowRegistration(true)
                                setError(null)
                            }}
                            variant="outline"
                            className="w-full"
                            disabled={isLoading}
                        >
                            Create New Passkey
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    )
}

const MainInterface = ({
    onSignOut,
    haConfigHook,
}: {
    onSignOut: () => void
    haConfigHook: ReturnType<typeof useHomeAssistantConfig>
}) => {
    const [showConfig, setShowConfig] = useState(false)
    const [user, setUser] = useState<{ name?: string }>({})

    return (
        <div className="min-h-screen bg-background">
            <AppHeader user={user} onSignOut={onSignOut}>
                <Dialog open={showConfig} onOpenChange={setShowConfig}>
                    <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="hidden sm:flex">
                            <Home className="w-4 h-4 mr-2" />
                            Home Assistant
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Home Assistant Configuration</DialogTitle>
                        </DialogHeader>
                        <HomeAssistantConfig haConfigHook={haConfigHook} />
                    </DialogContent>
                </Dialog>

                <Button variant="ghost" size="sm" className="sm:hidden" onClick={() => setShowConfig(true)}>
                    <Home className="w-4 h-4" />
                </Button>
            </AppHeader>

            <main className="flex-1 flex flex-col min-h-[calc(100vh-4rem)] p-4">
                <ModernChatInterface haConfigHook={haConfigHook} setUser={setUser} />
            </main>
        </div>
    )
}

export default function HomePage() {
    const [isInitializing, setIsInitializing] = useState(true)

    const {
        authSession,
        isSupported,
        isLoading,
        error,
        setError,
        isAuthenticated,
        isBlocked,
        registerPasskey,
        authenticatePasskey,
        signOut,
    } = usePasskey()

    const useCloudStorage = ['1', 'true', 'yes', 'y'].includes(
        (process.env.NEXT_PUBLIC_CLOUD_STORAGE || '').toLowerCase()
    )

    const haConfigHook = useHomeAssistantConfig(authSession?.prfOutput, authSession?.userId, useCloudStorage)

    useEffect(() => {
        setIsInitializing(false)
    }, [isSupported])

    const handleRegisterPasskey = async (username: string, displayName: string) => {
        try {
            await registerPasskey(username, displayName)
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
    }

    if (isInitializing) {
        return <LoadingScreen message="Initializing MyHome Assistant..." />
    }

    if (!isAuthenticated) {
        return (
            <LoginPage
                onRegisterPasskey={handleRegisterPasskey}
                onAuthenticatePasskey={handleAuthenticatePasskey}
                isSupported={isSupported}
                isLoading={isLoading}
                setError={setError}
                error={error}
                isBlocked={isBlocked}
            />
        )
    }

    return <MainInterface onSignOut={handleSignOut} haConfigHook={haConfigHook} />
}
