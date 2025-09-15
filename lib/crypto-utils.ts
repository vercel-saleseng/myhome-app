import { Encode as B64Encode, Decode as B64Decode } from 'arraybuffer-encoding/base64/url'

interface StoredSecret {
    id: string
    name: string
    encryptedData: string
    salt: string
    nonce: string
    timestamp: number
}

export class SecretNotFoundError extends Error {
    constructor() {
        super('Secret not found')
    }
}

export default class CryptoUtils {
    private readonly encoder = new TextEncoder()
    private readonly decoder = new TextDecoder()
    private readonly prfOutput: BufferSource

    // This is not a secret; it's used for key-binding
    private readonly baseMessage: BufferSource

    constructor(prfOutput: BufferSource, baseMessage: string) {
        this.prfOutput = prfOutput
        this.baseMessage = this.encoder.encode(baseMessage)
    }

    async Save(secretName: string, secretData: string): Promise<void> {
        try {
            // Generate a random salt for the key derivation
            const salt = crypto.getRandomValues(new Uint8Array(12))

            // Derive encryption key from PRF output
            const key = await this.deriveKey(salt)

            // Get a nonce for the GCM cipher
            // Note: because each key is derived from a random seed, we're safe using a random nonce and there's no risk of nonce reuse
            const nonce = crypto.getRandomValues(new Uint8Array(12))

            // Encrypt the secret data
            const encryptedData = await crypto.subtle.encrypt(
                { name: 'AES-GCM', iv: nonce, additionalData: this.encoder.encode(secretName) },
                key,
                this.encoder.encode(secretData)
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

            // Save to localStorage
            localStorage.setItem(`${secretName}-enc`, JSON.stringify(storedSecret))
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to encrypt secret'
            throw new Error(errorMessage)
        }
    }

    async Get(secretName: string): Promise<string> {
        const storedJSON = localStorage.getItem(`${secretName}-enc`)
        if (!storedJSON) {
            throw new SecretNotFoundError()
        }

        try {
            const secret = JSON.parse(storedJSON) as StoredSecret

            // Convert base64 strings back to Uint8Arrays
            const salt = B64Decode(secret.salt)
            const nonce = B64Decode(secret.nonce)
            const ciphertext = B64Decode(secret.encryptedData)

            // Derive the same key used for encryption
            const key = await this.deriveKey(salt)

            // Decrypt the data
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: nonce, additionalData: this.encoder.encode(secretName) },
                key,
                ciphertext
            )

            return this.decoder.decode(decryptedBuffer)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to decrypt secret'
            throw new Error(errorMessage)
        }
    }

    async Delete(secretName: string): Promise<void> {
        // This is a no-op if the item doesn't exist
        localStorage.removeItem(`${secretName}-enc`)
    }

    private async deriveKey(salt: BufferSource): Promise<CryptoKey> {
        // Import the PRF output as key material for HKDF
        const keyMaterial = await crypto.subtle.importKey('raw', this.prfOutput, { name: 'HKDF' }, false, ['deriveKey'])

        // Derive an AES-GCM key from the PRF output
        return await crypto.subtle.deriveKey(
            {
                name: 'HKDF',
                salt: salt,
                hash: 'SHA-256',
                info: this.baseMessage,
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        )
    }
}
