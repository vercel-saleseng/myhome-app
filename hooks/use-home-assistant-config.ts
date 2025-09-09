'use client'

import { useState, useEffect } from 'react'
import { useSecretStorage } from './use-secret-storage'

interface HomeAssistantConfig {
    url: string
    hasApiKey: boolean
}

export const useHomeAssistantConfig = (prfOutput: ArrayBuffer | null) => {
    const [config, setConfig] = useState<HomeAssistantConfig>({ url: '', hasApiKey: false })
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const { encryptSecret, decryptSecret, deleteSecret, canEncrypt } = useSecretStorage(prfOutput)

    const HA_URL_KEY = 'home-assistant-url'
    const HA_API_KEY_SECRET_NAME = 'Home Assistant API Key'

    useEffect(() => {
        // Load URL from localStorage (plain text)
        const storedUrl = localStorage.getItem(HA_URL_KEY) || ''

        // Check if API key exists (encrypted)
        const storedSecrets = localStorage.getItem('encrypted-secrets')
        let hasApiKey = false
        if (storedSecrets) {
            try {
                const secrets = JSON.parse(storedSecrets)
                hasApiKey = secrets.some((secret: any) => secret.name === HA_API_KEY_SECRET_NAME)
            } catch (err) {
                console.error('[v0] Failed to check for API key:', err)
            }
        }

        setConfig({ url: storedUrl, hasApiKey })
    }, [])

    const saveConfig = async (url: string, apiKey: string): Promise<void> => {
        if (!canEncrypt) {
            throw new Error('Cannot encrypt API key. Please authenticate with your passkey first.')
        }

        setIsLoading(true)
        setError(null)

        try {
            // Save URL to localStorage (plain text)
            localStorage.setItem(HA_URL_KEY, url)

            // Delete existing API key if it exists
            if (config.hasApiKey) {
                const storedSecrets = localStorage.getItem('encrypted-secrets')
                if (storedSecrets) {
                    const secrets = JSON.parse(storedSecrets)
                    const existingSecret = secrets.find((secret: any) => secret.name === HA_API_KEY_SECRET_NAME)
                    if (existingSecret) {
                        await deleteSecret(existingSecret.id)
                    }
                }
            }

            // Encrypt and store API key
            if (apiKey.trim()) {
                await encryptSecret(HA_API_KEY_SECRET_NAME, apiKey.trim())
            }

            setConfig({ url, hasApiKey: !!apiKey.trim() })
            console.log('Home Assistant configuration saved successfully')
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to save configuration'
            setError(errorMessage)
            console.error('[v0] Failed to save Home Assistant config:', err)
            throw new Error(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    const getApiKey = async (): Promise<string | null> => {
        if (!canEncrypt || !config.hasApiKey) {
            return null
        }

        try {
            const storedSecrets = localStorage.getItem('encrypted-secrets')
            if (!storedSecrets) return null

            const secrets = JSON.parse(storedSecrets)
            const apiKeySecret = secrets.find((secret: any) => secret.name === HA_API_KEY_SECRET_NAME)

            if (!apiKeySecret) return null

            const decrypted = await decryptSecret(apiKeySecret.id)
            return decrypted.data
        } catch (err) {
            console.error('[v0] Failed to decrypt API key:', err)
            return null
        }
    }

    const clearConfig = (): void => {
        localStorage.removeItem(HA_URL_KEY)
        setConfig({ url: '', hasApiKey: false })

        // Also delete the encrypted API key
        if (config.hasApiKey) {
            const storedSecrets = localStorage.getItem('encrypted-secrets')
            if (storedSecrets) {
                try {
                    const secrets = JSON.parse(storedSecrets)
                    const apiKeySecret = secrets.find((secret: any) => secret.name === HA_API_KEY_SECRET_NAME)
                    if (apiKeySecret) {
                        deleteSecret(apiKeySecret.id)
                    }
                } catch (err) {
                    console.error('[v0] Failed to delete API key:', err)
                }
            }
        }
    }

    return {
        config,
        isLoading,
        error,
        saveConfig,
        getApiKey,
        clearConfig,
        canSave: canEncrypt,
    }
}
