"use client"

import { useState, useEffect } from "react"
import { useSecretStorage } from "./use-secret-storage"

interface HomeAssistantConfig {
  url: string
  hasApiKey: boolean
}

interface ConnectionStatus {
  isConnected: boolean
  isLoading: boolean
  error: string | null
  lastChecked: number | null
  haInfo?: {
    version?: string
    name?: string
  }
}

export const useHomeAssistantConfig = (prfOutput: BufferSource | null) => {
  const [config, setConfig] = useState<HomeAssistantConfig>({ url: "", hasApiKey: false })
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    isLoading: false,
    error: null,
    lastChecked: null,
  })

  const { encryptSecret, decryptSecret, deleteSecret, canEncrypt } = useSecretStorage(prfOutput)

  const HA_URL_KEY = "home-assistant-url"
  const HA_API_KEY_SECRET_NAME = "Home Assistant API Key"

  useEffect(() => {
    // Load URL from localStorage (plain text)
    const storedUrl = localStorage.getItem(HA_URL_KEY) || ""

    // Check if API key exists (encrypted)
    const storedSecrets = localStorage.getItem("encrypted-secrets")
    let hasApiKey = false
    if (storedSecrets) {
      try {
        const secrets = JSON.parse(storedSecrets)
        hasApiKey = secrets.some((secret: any) => secret.name === HA_API_KEY_SECRET_NAME)
      } catch (err) {
        console.error("Failed to check for API key:", err)
      }
    }

    setConfig({ url: storedUrl, hasApiKey })
  }, [])

  const saveConfig = async (url: string, apiKey: string): Promise<void> => {
    if (!canEncrypt) {
      throw new Error("Cannot encrypt API key. Please authenticate with your passkey first.")
    }

    setIsLoading(true)
    setError(null)

    try {
      // Save URL to localStorage (plain text)
      localStorage.setItem(HA_URL_KEY, url)

      // Delete existing API key if it exists
      if (config.hasApiKey) {
        const storedSecrets = localStorage.getItem("encrypted-secrets")
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
      console.log("Home Assistant configuration saved successfully")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to save configuration"
      setError(errorMessage)
      console.error("Failed to save Home Assistant config:", err)
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
      const storedSecrets = localStorage.getItem("encrypted-secrets")
      if (!storedSecrets) return null

      const secrets = JSON.parse(storedSecrets)
      const apiKeySecret = secrets.find((secret: any) => secret.name === HA_API_KEY_SECRET_NAME)

      if (!apiKeySecret) return null

      const decrypted = await decryptSecret(apiKeySecret.id)
      return decrypted.data
    } catch (err) {
      console.error("Failed to decrypt API key:", err)
      return null
    }
  }

  const clearConfig = (): void => {
    localStorage.removeItem(HA_URL_KEY)
    setConfig({ url: "", hasApiKey: false })

    // Also delete the encrypted API key
    if (config.hasApiKey) {
      const storedSecrets = localStorage.getItem("encrypted-secrets")
      if (storedSecrets) {
        try {
          const secrets = JSON.parse(storedSecrets)
          const apiKeySecret = secrets.find((secret: any) => secret.name === HA_API_KEY_SECRET_NAME)
          if (apiKeySecret) {
            deleteSecret(apiKeySecret.id)
          }
        } catch (err) {
          console.error("Failed to delete API key:", err)
        }
      }
    }
  }

  const testConnection = async (): Promise<ConnectionStatus> => {
    if (!config.url || !config.hasApiKey) {
      const status: ConnectionStatus = {
        isConnected: false,
        isLoading: false,
        error: "Configuration incomplete",
        lastChecked: Date.now(),
      }
      setConnectionStatus(status)
      return status
    }

    setConnectionStatus((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const apiKey = await getApiKey()
      if (!apiKey) {
        throw new Error("Failed to decrypt API key")
      }

      // Test connection to Home Assistant API
      const response = await fetch(`${config.url}/api/`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        // Add timeout to prevent hanging
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Invalid API key")
        } else if (response.status === 404) {
          throw new Error("Home Assistant API not found")
        } else {
          throw new Error(`Connection failed (${response.status})`)
        }
      }

      const data = await response.json()

      const status: ConnectionStatus = {
        isConnected: true,
        isLoading: false,
        error: null,
        lastChecked: Date.now(),
        haInfo: {
          version: data.version,
          name: data.location_name || "Home Assistant",
        },
      }

      setConnectionStatus(status)
      return status
    } catch (err) {
      let errorMessage = "Connection failed"

      if (err instanceof Error) {
        if (err.name === "TimeoutError") {
          errorMessage = "Connection timeout - check URL"
        } else if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
          errorMessage = "Network error - check URL and connectivity"
        } else {
          errorMessage = err.message
        }
      }

      const status: ConnectionStatus = {
        isConnected: false,
        isLoading: false,
        error: errorMessage,
        lastChecked: Date.now(),
      }

      setConnectionStatus(status)
      return status
    }
  }

  useEffect(() => {
    if (config.url && config.hasApiKey && canEncrypt) {
      // Debounce the connection test
      const timer = setTimeout(() => {
        testConnection()
      }, 1000)
      return () => clearTimeout(timer)
    } else {
      setConnectionStatus({
        isConnected: false,
        isLoading: false,
        error: config.url ? "API key not configured" : "URL not configured",
        lastChecked: null,
      })
    }
  }, [config.url, config.hasApiKey, canEncrypt])

  return {
    config,
    isLoading,
    error,
    connectionStatus,
    saveConfig,
    getApiKey,
    clearConfig,
    testConnection,
    canSave: canEncrypt,
  }
}
