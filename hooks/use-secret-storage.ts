'use client'

import { Encode as B64Encode, Decode as B64Decode } from 'arraybuffer-encoding/base64/url'
import { useState, useEffect } from 'react'

interface StoredSecret {
    id: string
    name: string
    encryptedData: string
    salt: string
    nonce: string
    timestamp: number
}

interface DecryptedSecret {
    id: string
    name: string
    data: string
    timestamp: number
}

export const useSecretStorage = (prfOutput: BufferSource | null) => {
    const [secrets, setSecrets] = useState<StoredSecret[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    useEffect(() => {
        // Load stored secrets from localStorage
        const storedSecrets = localStorage.getItem('encrypted-secrets')
        if (storedSecrets) {
            try {
                setSecrets(JSON.parse(storedSecrets))
            } catch (err) {
                console.error('Failed to parse stored secrets:', err)
                setError('Failed to load stored secrets')
            }
        }
    }, [])

    // This is not a secret, but it's used for key-binding
    const hmacMessage = encoder.encode('myhome-assistant-secret-encryption-key-v1')

    const deriveKey = async (prfOutput: BufferSource, salt: BufferSource): Promise<CryptoKey> => {
        // Import the PRF output as key material for HKDF
        const keyMaterial = await crypto.subtle.importKey('raw', prfOutput, { name: 'HKDF' }, false, ['deriveKey'])

        // Derive an AES-GCM key from the PRF output
        return await crypto.subtle.deriveKey(
            {
                name: 'HKDF',
                salt: salt,
                hash: 'SHA-256',
                info: hmacMessage,
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        )
    }

    const encryptSecret = async (secretName: string, secretData: string): Promise<void> => {
        if (!prfOutput) {
            throw new Error('No PRF output available. Please authenticate with your passkey first.')
        }

        setIsLoading(true)
        setError(null)

        try {
            // Generate a random salt for the key derivation
            const salt = crypto.getRandomValues(new Uint8Array(12))

            // Derive encryption key from PRF output
            const key = await deriveKey(prfOutput, salt)

            // Get a nonce for the GCM cipher
            // Note: because each key is derived from a random seed, we're safe using a random nonce and there's no risk of nonce reuse
            const nonce = crypto.getRandomValues(new Uint8Array(12))

            // Encrypt the secret data
            const encryptedData = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: nonce, additionalData: encoder.encode(secretName) },
                key,
                encoder.encode(secretData)
            )

            // Create the stored secret object
            const storedSecret: StoredSecret = {
                id: crypto.randomUUID(),
                name: secretName,
                encryptedData: B64Encode(encryptedData),
                salt: B64Encode(salt.buffer),
                nonce: B64Encode(nonce.buffer),
                timestamp: Date.now(),
            }

            // Update secrets list
            const updatedSecrets = [...secrets, storedSecret]
            setSecrets(updatedSecrets)

            // Save to localStorage
            localStorage.setItem('encrypted-secrets', JSON.stringify(updatedSecrets))
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to encrypt secret'
            setError(errorMessage)
            console.error('Secret encryption failed:', err)
            throw new Error(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    const decryptSecret = async (secretId: string): Promise<DecryptedSecret> => {
        if (!prfOutput) {
            throw new Error('No PRF output available. Please authenticate with your passkey first.')
        }

        setError(null)

        try {
            const secret = secrets.find((s) => s.id === secretId)
            if (!secret) {
                throw new Error('Secret not found')
            }

            // Convert base64 strings back to Uint8Arrays
            const salt = B64Decode(secret.salt)
            const nonce = B64Decode(secret.nonce)
            const ciphertext = B64Decode(secret.encryptedData)

            // Derive the same key used for encryption
            const key = await deriveKey(prfOutput, salt)

            // Decrypt the data
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: nonce, additionalData: encoder.encode(secret.name) },
                key,
                ciphertext
            )

            const decryptedData = decoder.decode(decryptedBuffer)

            return {
                id: secret.id,
                name: secret.name,
                data: decryptedData,
                timestamp: secret.timestamp,
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to decrypt secret'
            setError(errorMessage)
            console.error('Secret decryption failed:', err)
            throw new Error(errorMessage)
        }
    }

    const deleteSecret = async (secretId: string): Promise<void> => {
        try {
            const updatedSecrets = secrets.filter((s) => s.id !== secretId)
            setSecrets(updatedSecrets)
            localStorage.setItem('encrypted-secrets', JSON.stringify(updatedSecrets))
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to delete secret'
            setError(errorMessage)
            throw new Error(errorMessage)
        }
    }

    const clearAllSecrets = (): void => {
        setSecrets([])
        localStorage.removeItem('encrypted-secrets')
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
