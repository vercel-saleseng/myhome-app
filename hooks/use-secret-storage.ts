"use client"

import { useState, useEffect } from "react"

interface StoredSecret {
  id: string
  name: string
  encryptedData: string
  iv: string
  timestamp: number
}

interface DecryptedSecret {
  id: string
  name: string
  data: string
  timestamp: number
}

export const useSecretStorage = (prfOutput: ArrayBuffer | null) => {
  const [secrets, setSecrets] = useState<StoredSecret[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Load stored secrets from localStorage
    const storedSecrets = localStorage.getItem("encrypted-secrets")
    if (storedSecrets) {
      try {
        setSecrets(JSON.parse(storedSecrets))
      } catch (err) {
        console.error("[v0] Failed to parse stored secrets:", err)
        setError("Failed to load stored secrets")
      }
    }
  }, [])

  const deriveKey = async (prfOutput: ArrayBuffer, salt: Uint8Array): Promise<CryptoKey> => {
    // Import the PRF output as key material
    const keyMaterial = await crypto.subtle.importKey("raw", prfOutput, { name: "PBKDF2" }, false, ["deriveKey"])

    // Derive an AES-GCM key from the PRF output
    return await crypto.subtle.deriveKey(
      {
        name: "PBKDF2",
        salt: salt,
        iterations: 100000,
        hash: "SHA-256",
      },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    )
  }

  const encryptSecret = async (secretName: string, secretData: string): Promise<void> => {
    if (!prfOutput) {
      throw new Error("No PRF output available. Please authenticate with your passkey first.")
    }

    setIsLoading(true)
    setError(null)

    try {
      // Generate a random salt and IV
      const salt = crypto.getRandomValues(new Uint8Array(16))
      const iv = crypto.getRandomValues(new Uint8Array(12))

      // Derive encryption key from PRF output
      const key = await deriveKey(prfOutput, salt)

      // Encrypt the secret data
      const encoder = new TextEncoder()
      const encryptedData = await crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, encoder.encode(secretData))

      // Create the stored secret object
      const storedSecret: StoredSecret = {
        id: crypto.randomUUID(),
        name: secretName,
        encryptedData: Array.from(new Uint8Array(encryptedData))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
        iv: Array.from(iv)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
        timestamp: Date.now(),
      }

      // Store salt with the secret (it's safe to store salt in plaintext)
      const secretWithSalt = {
        ...storedSecret,
        salt: Array.from(salt)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
      }

      // Update secrets list
      const updatedSecrets = [...secrets, secretWithSalt]
      setSecrets(updatedSecrets)

      // Save to localStorage
      localStorage.setItem("encrypted-secrets", JSON.stringify(updatedSecrets))

      console.log("[v0] Secret encrypted and stored successfully:", secretName)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to encrypt secret"
      setError(errorMessage)
      console.error("[v0] Secret encryption failed:", err)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const decryptSecret = async (secretId: string): Promise<DecryptedSecret> => {
    if (!prfOutput) {
      throw new Error("No PRF output available. Please authenticate with your passkey first.")
    }

    setError(null)

    try {
      const secret = secrets.find((s) => s.id === secretId)
      if (!secret) {
        throw new Error("Secret not found")
      }

      const secretWithSalt = secret as StoredSecret & { salt: string }
      if (!secretWithSalt.salt) {
        throw new Error("Secret salt not found")
      }

      // Convert hex strings back to Uint8Arrays
      const salt = new Uint8Array(secretWithSalt.salt.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) || [])
      const iv = new Uint8Array(secret.iv.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) || [])
      const encryptedData = new Uint8Array(
        secret.encryptedData.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) || [],
      )

      // Derive the same key used for encryption
      const key = await deriveKey(prfOutput, salt)

      // Decrypt the data
      const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv: iv }, key, encryptedData)

      const decoder = new TextDecoder()
      const decryptedData = decoder.decode(decryptedBuffer)

      console.log("[v0] Secret decrypted successfully:", secret.name)

      return {
        id: secret.id,
        name: secret.name,
        data: decryptedData,
        timestamp: secret.timestamp,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to decrypt secret"
      setError(errorMessage)
      console.error("[v0] Secret decryption failed:", err)
      throw new Error(errorMessage)
    }
  }

  const deleteSecret = async (secretId: string): Promise<void> => {
    try {
      const updatedSecrets = secrets.filter((s) => s.id !== secretId)
      setSecrets(updatedSecrets)
      localStorage.setItem("encrypted-secrets", JSON.stringify(updatedSecrets))
      console.log("[v0] Secret deleted successfully")
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete secret"
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const clearAllSecrets = (): void => {
    setSecrets([])
    localStorage.removeItem("encrypted-secrets")
    console.log("[v0] All secrets cleared")
  }

  return {
    secrets,
    isLoading,
    error,
    encryptSecret,
    decryptSecret,
    deleteSecret,
    clearAllSecrets,
    canEncrypt: !!prfOutput,
  }
}
