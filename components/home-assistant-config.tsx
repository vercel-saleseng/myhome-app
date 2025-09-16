'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Home, Key, Shield, AlertCircle, Check, Settings } from 'lucide-react'
import { useHomeAssistantConfig } from '@/hooks/use-home-assistant-config'

export function HomeAssistantConfig({
    haConfigHook,
    className,
}: {
    haConfigHook: ReturnType<typeof useHomeAssistantConfig>
    className?: string
}) {
    const [url, setUrl] = useState('')
    const [apiKey, setApiKey] = useState('')
    const [showApiKey, setShowApiKey] = useState(false)

    const { config, error, saveConfig, clearConfig, canSave, isBusy } = haConfigHook

    // Initialize form with current config
    useEffect(() => {
        setUrl(config.url || '')
    }, [config.url])

    const handleSave = async () => {
        if (!url.trim() || !apiKey.trim()) {
            return
        }

        try {
            await saveConfig(url.trim(), apiKey.trim())
            setApiKey('') // Clear the API key input after saving
            setShowApiKey(false)
        } catch (err) {
            // Error is handled by the hook
        }
    }

    const handleClear = () => {
        if (
            confirm(
                'Are you sure you want to clear your Home Assistant configuration? This will remove both the URL and API key.'
            )
        ) {
            clearConfig()
            setUrl('')
            setApiKey('')
            setShowApiKey(false)
        }
    }

    if (!canSave) {
        return (
            <Card className={`p-6 ${className}`}>
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto">
                        <Shield className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-foreground mb-2">Passkey Unavailable</h3>
                        <p className="text-sm text-muted-foreground text-pretty">
                            Please authenticate with your Passkey to configure Home Assistant.
                        </p>
                    </div>
                </div>
            </Card>
        )
    }

    return (
        <Card className={`p-6 ${className}`}>
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                        <Home className="w-5 h-5 text-primary" />
                        <h3 className="font-semibold text-foreground">Home Assistant Configuration</h3>
                        {config.url && (
                            <Badge variant="secondary" className="text-xs">
                                <Shield className="w-3 h-3 mr-1" />
                                Configured
                            </Badge>
                        )}
                    </div>
                    {config.url && (
                        <Button size="sm" variant="outline" onClick={handleClear}>
                            Clear Config
                        </Button>
                    )}
                </div>

                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="ha-url" className="flex items-center space-x-2">
                            <Settings className="w-4 h-4" />
                            <span>Home Assistant URL</span>
                        </Label>
                        <Input
                            id="ha-url"
                            type="url"
                            placeholder="https://homeassistant.local:8123"
                            value={url}
                            onChange={(e) => setUrl(e.target.value)}
                            className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                            The URL to your Home Assistant instance (stored in plain text)
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="ha-api-key" className="flex items-center space-x-2">
                            <Key className="w-4 h-4" />
                            <span>API Key</span>
                            <Badge variant="outline" className="text-xs">
                                <Shield className="w-3 h-3 mr-1" />
                                Encrypted
                            </Badge>
                        </Label>
                        <Input
                            id="ha-api-key"
                            type={showApiKey ? 'text' : 'password'}
                            placeholder={
                                config.url ? '••••••••••••••••••••••••••••••••' : 'Enter your Home Assistant API key'
                            }
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">
                            Long-lived access token from Home Assistant (encrypted with your Passkey)
                        </p>
                    </div>

                    <Button onClick={handleSave} className="w-full" disabled={isBusy || !url.trim()}>
                        {isBusy ? 'Saving...' : config.url ? 'Update Configuration' : 'Save Configuration'}
                    </Button>
                </div>

                {config.url && (
                    <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                        <h4 className="font-medium text-sm text-foreground">Current Configuration</h4>
                        <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">URL:</span>
                                <span className="font-mono text-foreground">{config.url || 'Not set'}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">API Key:</span>
                                <span className="flex items-center space-x-1">
                                    <Check className="w-3 h-3 text-green-600" />
                                    <span className="text-green-600">Configured</span>
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t border-border/50">
                    <p>• API key is encrypted using your Passkey extension</p>
                    <p>• Only you can decrypt the API key with your authenticated Passkey</p>
                </div>
            </div>
        </Card>
    )
}
