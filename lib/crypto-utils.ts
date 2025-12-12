import { Encode as B64Encode, Decode as B64Decode } from 'arraybuffer-encoding/base64/url'
import { p256 } from '@noble/curves/nist.js'

interface StoredSecret {
    id: string
    name: string
    encryptedData: string
    salt: string
    nonce: string
    timestamp: number
}

interface CryptoUtilsOptions {
    userId?: string
    credentialId?: string
    useCloudStorage?: boolean
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
    private readonly userId?: string
    private readonly useCloudStorage: boolean

    // This is not a secret; it's used for key-binding
    private readonly baseMessage: BufferSource

    constructor(prfOutput: BufferSource, baseMessage: string, options: CryptoUtilsOptions = {}) {
        this.prfOutput = prfOutput
        this.baseMessage = this.encoder.encode(baseMessage)
        this.userId = options.userId
        this.useCloudStorage = !!options.useCloudStorage
    }

    async Save(secretName: string, secretData: string): Promise<void> {
        try {
            // Generate a random salt for the key derivation
            const salt = crypto.getRandomValues(new Uint8Array(12))

            // Derive encryption key from PRF output
            const key = await this.deriveEncryptionKey(salt)

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

            if (this.useCloudStorage && this.userId) {
                // Store in Vercel Blob via API
                await this.saveToCloud(secretName, storedSecret)
            } else {
                // Save to localStorage
                localStorage.setItem(`${secretName}-enc`, JSON.stringify(storedSecret))
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to encrypt secret'
            throw new Error(errorMessage)
        }
    }

    async Get(secretName: string): Promise<string> {
        let secret: StoredSecret

        try {
            if (this.useCloudStorage && this.userId) {
                // Try to get from cloud storage first
                secret = await this.getFromCloud(secretName)
            } else {
                // Retrieve to localStorage
                const storedJSON = localStorage.getItem(`${secretName}-enc`)
                if (!storedJSON) {
                    throw new SecretNotFoundError()
                }
                secret = JSON.parse(storedJSON) as StoredSecret
            }

            // Convert base64 strings back to Uint8Arrays
            const salt = B64Decode(secret.salt)
            const nonce = B64Decode(secret.nonce)
            const ciphertext = B64Decode(secret.encryptedData)

            // Derive the same key used for encryption
            const key = await this.deriveEncryptionKey(salt)

            // Decrypt the data
            const decryptedBuffer = await crypto.subtle.decrypt(
                { name: 'AES-GCM', iv: nonce, additionalData: this.encoder.encode(secretName) },
                key,
                ciphertext
            )

            return this.decoder.decode(decryptedBuffer)
        } catch (err) {
            if (err instanceof SecretNotFoundError) {
                throw err
            }
            const errorMessage = err instanceof Error ? err.message : 'Failed to decrypt secret'
            throw new Error(errorMessage)
        }
    }

    private async saveToCloud(secretName: string, storedSecret: StoredSecret): Promise<void> {
        if (!this.userId) {
            throw new Error('Missing authentication parameters for cloud storage')
        }

        const authHeader = await this.createAuthHeader('POST', secretName)

        const response = await fetch(`/api/secrets/${encodeURIComponent(secretName)}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: authHeader,
            },
            body: JSON.stringify({
                data: storedSecret,
            }),
        })

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(`Failed to save to cloud storage: ${error.error || response.statusText}`)
        }
    }

    private async getFromCloud(secretName: string): Promise<StoredSecret> {
        if (!this.userId) {
            throw new Error('Missing authentication parameters for cloud storage')
        }

        const authHeader = await this.createAuthHeader('GET', secretName)

        const response = await fetch(`/api/secrets/${encodeURIComponent(secretName)}`, {
            method: 'GET',
            headers: {
                Authorization: authHeader,
            },
        })

        if (response.status == 404) {
            throw new SecretNotFoundError()
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(`Failed to retrieve from cloud storage: ${error.error || response.statusText}`)
        }

        const result = await response.json()
        return result.data
    }

    async Delete(secretName: string): Promise<void> {
        if (this.useCloudStorage && this.userId) {
            // Delete from cloud storage
            await this.deleteFromCloud(secretName)
        } else {
            // Delete from localStorage (this is a no-op if the item doesn't exist)
            localStorage.removeItem(`${secretName}-enc`)
        }
    }

    private async deleteFromCloud(secretName: string): Promise<void> {
        if (!this.userId) {
            throw new Error('Missing authentication parameters for cloud storage')
        }

        const authHeader = await this.createAuthHeader('DELETE', secretName)

        const response = await fetch(`/api/secrets/${encodeURIComponent(secretName)}`, {
            method: 'DELETE',
            headers: {
                Authorization: authHeader,
            },
        })

        if (!response.ok && response.status !== 404) {
            const error = await response.json().catch(() => ({ error: 'Unknown error' }))
            throw new Error(`Failed to delete from cloud storage: ${error.error || response.statusText}`)
        }
    }

    private async deriveEncryptionKey(salt: BufferSource): Promise<CryptoKey> {
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

    private async deriveAuthKey(): Promise<{ priv: CryptoKey; kid: string; pubJWK: string }> {
        // The authentication key is an EC (P-256) key that is derived from the PRF output
        // 1. First, we import the PRF output as HMAC key with SHA-384
        // 2. Next, we sign a base message (`auth-key-v1:${this.userId}`) with that key
        // 3. The result is a 384-bit digest: the first 256 bits are the private P-256 key; the remaining are 128-bit key ID
        // 4. We import the private key into a CryptoKey object that can be used to sign messages

        // Import the PRF output as key material for HMAC
        const prfKey = await crypto.subtle.importKey('raw', this.prfOutput, { name: 'HMAC', hash: 'SHA-384' }, false, [
            'sign',
        ])
        const baseMessage = this.encoder.encode(`auth-key-v1:${this.userId}`)
        const hmac = await crypto.subtle.sign('HMAC', prfKey, baseMessage)

        // Get the private key and the key ID
        const pkBuf = hmac.slice(0, 32)
        const keyIdBuf = hmac.slice(32)

        // Import the private key
        const priv = await this.importECPrivateKey(pkBuf, 'ECDSA', ['sign'])

        // Get the public key as JWK
        const pubJWK = await this.getPublicJWK(priv)

        return {
            priv,
            kid: B64Encode(keyIdBuf),
            pubJWK,
        }
    }

    /**
     * Import a raw EC private key into a CryptoKey.
     * @param pkBuf 32-byte big-endian private scalar
     * @param alg WebCrypto algorithm name
     * @param usages e.g. ["sign"] for ECDSA, ["deriveBits","deriveKey"] for ECDH
     */
    private async importECPrivateKey(
        pkBuf: ArrayBuffer,
        alg: 'ECDSA' | 'ECDH' = 'ECDSA',
        usages: KeyUsage[] = ['sign']
    ): Promise<CryptoKey> {
        if (pkBuf.byteLength != 32) {
            throw new Error('P-256 private key must be exactly 32 bytes.')
        }

        // Derive public key coordinates from private key using P-256 curve
        const privateKeyBytes = new Uint8Array(pkBuf)
        const publicKeyPoint = p256.getPublicKey(privateKeyBytes, false) // Uncompressed format

        // Extract x and y coordinates (skip first byte which is 0x04 for uncompressed)
        const x = publicKeyPoint.slice(1, 33)
        const y = publicKeyPoint.slice(33, 65)

        // Create JWK with both private and public components
        const jwk: JsonWebKey = {
            kty: 'EC',
            crv: 'P-256',
            d: B64Encode(pkBuf),
            x: B64Encode(x.buffer),
            y: B64Encode(y.buffer),
        }

        // Import the private key
        // Key must be extractable because we need to export it as JWK to get the public key
        return crypto.subtle.importKey('jwk', jwk, { name: alg, namedCurve: 'P-256' }, true, usages)
    }

    private async getPublicJWK(privKey: CryptoKey) {
        const jwk = await crypto.subtle.exportKey('jwk', privKey)

        // Delete the private part and usages, set key_ops to verify
        jwk.d = undefined
        jwk.use = undefined
        jwk.key_ops = ['verify']

        // Return as JSON
        return JSON.stringify(jwk)
    }

    private async createAuthHeader(method: string, secretName: string): Promise<string> {
        if (!this.userId) {
            throw new Error('Missing authentication parameters')
        }

        const timestamp = Date.now()

        // Derive the key
        const authKey = await this.deriveAuthKey()

        // Create the message to sign for authentication
        const authMessage = JSON.stringify({
            method,
            secretName,
            timestamp,
            userId: this.userId,
            keyId: authKey.kid,
        } as StorageAuthSignedMessage)

        // Sign with the derived auth key using ECDSA
        const signatureBuffer = await crypto.subtle.sign(
            { name: 'ECDSA', hash: 'SHA-256' },
            authKey.priv,
            this.encoder.encode(authMessage)
        )
        const authSignature = B64Encode(signatureBuffer)

        const authHeader: StorageAuthHeader = {
            userId: this.userId,
            keyId: authKey.kid,
            authSignature,
            timestamp,
            pubKey: authKey.pubJWK,
        }

        // Encode as base64 JSON
        const tokenData = JSON.stringify(authHeader)
        return B64Encode(this.encoder.encode(tokenData).buffer)
    }
}
