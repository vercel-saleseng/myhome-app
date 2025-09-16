'use client'

import { useState, useEffect } from 'react'
import CryptoUtils, { SecretNotFoundError } from '@/lib/crypto-utils'

interface HomeAssistantConfig {
    url: string | null
}

export const useHomeAssistantConfig = (prfOutput: BufferSource | null) => {
    const [config, setConfig] = useState<HomeAssistantConfig>({ url: null })
    const [cryptoUtils, setCryptoUtils] = useState<CryptoUtils | null>()
    const [apiKey, setApiKey] = useState<string | null>()
    const [isBusy, setIsBusy] = useState<boolean>(false)
    const [error, setError] = useState<string | null>(null)
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
        isConnected: false,
        isLoading: false,
        error: null,
        lastChecked: null,
    })

    const secretUrl = 'ha-url'
    const secretAPIKey = 'ha-apikey'

    // This is not a secret, and it's just use for key binding purposes
    const cryptoBaseMessage = 'myhome-assistant-secret-encryption-key-v1'

    useEffect(() => {
        setIsBusy(true)

        // IIFE
        ;(async () => {
            // If we don't have the output from the PRF, it means we don't have a (valid) Passkey authentication
            if (!prfOutput) {
                setError('PRF data is not available. Please authenticate with your Passkey first.')
                setCryptoUtils(null)
                setConfig({ url: null })
                setApiKey(null)
                return
            }

            // Init the CryptoUtils
            const cu = new CryptoUtils(prfOutput, cryptoBaseMessage)
            setCryptoUtils(cu)

            // Try to get the URL
            let urlDec: string
            try {
                urlDec = await cu.Get(secretUrl)
            } catch (err) {
                if (err instanceof SecretNotFoundError) {
                    // The secret was just not found (instance is not fully configured): nothing to do here
                    setConfig({ url: null })
                    setApiKey(null)
                    return
                }

                console.error('Error retrieving URL secret:', err)
                setError(`Error retrieving URL secret: ${err}`)
                return
            }

            // Now try to get the API key
            let apiKeyDec: string
            try {
                apiKeyDec = await cu.Get(secretAPIKey)
            } catch (err) {
                if (err instanceof SecretNotFoundError) {
                    // The secret was just not found (instance is not fully configured): nothing to do here
                    setConfig({ url: null })
                    setApiKey(null)
                    return
                }

                console.error('Error retrieving API Key secret:', err)
                setError(`Error retrieving API Key secret: ${err}`)
                return
            }

            // We have all secrets!
            setConfig({ url: urlDec })
            setApiKey(apiKeyDec)
        })()
            // Set isBusy to false, no matter what the result of the promise
            .then(() => setIsBusy(false))
    }, [prfOutput])

    const saveConfig = async (urlVal: string, apiKeyVal: string): Promise<void> => {
        if (!cryptoUtils) {
            throw new Error('Please authenticate with your Passkey first')
        }
        if (!urlVal) {
            throw new Error('URL is empty')
        }
        if (!apiKeyVal) {
            throw new Error('API key is empty')
        }

        setError(null)
        setIsBusy(true)

        try {
            cryptoUtils.Save(secretUrl, urlVal)
            cryptoUtils.Save(secretAPIKey, apiKeyVal)

            setConfig({ url: urlVal })
            setApiKey(apiKeyVal)

            console.info('Home Assistant configuration saved successfully')
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to save configuration'
            setError(errorMessage)
            console.error('Failed to save Home Assistant config:', err)

            // Remove values that may have been saved
            clearConfig()

            throw new Error(errorMessage)
        } finally {
            setIsBusy(false)
        }
    }

    const getApiKey = (): string | null => {
        return apiKey || null
    }

    const clearConfig = (): void => {
        setConfig({ url: null })
        setApiKey(null)

        cryptoUtils?.Delete(secretUrl)
        cryptoUtils?.Delete(secretAPIKey)
    }

    const testConnection = async (): Promise<ConnectionStatus> => {
        if (!config.url || !apiKey) {
            const status: ConnectionStatus = {
                isConnected: false,
                isLoading: false,
                error: 'Configuration incomplete',
                lastChecked: null,
            }
            setConnectionStatus(status)
            return status
        }

        setConnectionStatus((prev) => ({ ...prev, isLoading: true, error: null }))

        try {
            // Test connection to Home Assistant API
            const response = await fetch(`${config.url}/api/`, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                // Add timeout to prevent hanging
                signal: AbortSignal.timeout(15000),
            })

            if (!response.ok) {
                if (response.status == 401) {
                    throw new Error('Invalid API key')
                } else if (response.status == 404) {
                    throw new Error('Home Assistant API not found')
                } else {
                    throw new Error(`Connection failed (${response.status})`)
                }
            }

            const data = await response.json()

            const status: ConnectionStatus = {
                isConnected: true,
                isLoading: false,
                error: null,
                lastChecked: new Date(),
                haInfo: {
                    version: data.version,
                    location_name: data.location_name || 'Home Assistant',
                },
            }

            setConnectionStatus(status)
            return status
        } catch (err) {
            let errorMessage = 'Connection failed'

            if (err instanceof Error) {
                if (err.name === 'TimeoutError') {
                    errorMessage = 'Connection timeout - check URL'
                } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
                    errorMessage = 'Network error - check URL and connectivity'
                } else {
                    errorMessage = err.message
                }
            }

            const status: ConnectionStatus = {
                isConnected: false,
                isLoading: false,
                error: errorMessage,
                lastChecked: new Date(),
            }

            setConnectionStatus(status)
            return status
        }
    }

    useEffect(() => {
        // Debounce the connection test
        const timer = setTimeout(() => {
            testConnection()
        }, 1000)
        return () => clearTimeout(timer)
    }, [config.url])

    return {
        config,
        error,
        connectionStatus,
        saveConfig,
        getApiKey,
        clearConfig,
        testConnection,
        isBusy,
        canSave: !!cryptoUtils,
    }
}
