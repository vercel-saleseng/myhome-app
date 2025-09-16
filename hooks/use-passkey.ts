'use client'

import { useState, useEffect } from 'react'
import { Encode as B64Encode } from 'arraybuffer-encoding/base64/url'

interface PasskeyUser {
    id: string
    name: string
    displayName: string
}

interface AuthenticationSession {
    userId: string
    timestamp: number
    prfOutput?: BufferSource
}

export const usePasskey = () => {
    const [isSupported, setIsSupported] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [authSession, setAuthSession] = useState<AuthenticationSession | null>(null)
    const [isBlocked, setIsBlocked] = useState(false)

    useEffect(() => {
        const checkSupport = async () => {
            const check =
                // Base check for WebAuthn support
                typeof window !== 'undefined' &&
                'navigator' in window &&
                'credentials' in navigator &&
                typeof navigator.credentials.create === 'function' &&
                // Check for PRF support
                (await checkPRFSupport())

            setIsSupported(check)
            if (!check) {
                return
            }
        }

        checkSupport()
    }, [])

    const generateChallenge = () => {
        return crypto.getRandomValues(new Uint8Array(32))
    }

    const generateUserId = () => {
        return crypto.getRandomValues(new Uint8Array(64))
    }

    const registerPasskey = async (username: string, displayName: string) => {
        if (!isSupported) {
            if (isBlocked) {
                throw new Error(
                    'WebAuthn is blocked by security policy. Please open this app in a new tab or window instead of an iframe.'
                )
            }
            throw new Error('WebAuthn is not supported in this browser')
        }

        setIsLoading(true)
        setError(null)

        try {
            // Generate a user ID and challenge
            const userId = generateUserId()
            const challenge = generateChallenge()

            const credential = (await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: {
                        name: 'MyHome Assistant',
                        id: window.location.hostname,
                    },
                    user: {
                        id: userId,
                        name: username,
                        displayName: displayName,
                    },
                    pubKeyCredParams: [
                        { alg: -7, type: 'public-key' },
                        { alg: -257, type: 'public-key' },
                    ],
                    authenticatorSelection: {
                        userVerification: 'required',
                        residentKey: 'required',
                    },
                    timeout: 30_000,
                    extensions: {
                        prf: {},
                    },
                },
            })) as PublicKeyCredential

            if (!credential) {
                throw new Error('Failed to create passkey')
            }

            console.log('Passkey registered successfully:', credential.id)
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to register passkey'
            setError(errorMessage)
            console.error('Passkey registration failed:', err)
            throw new Error(errorMessage)
        } finally {
            setIsLoading(false)
        }

        // Because the registration doesn't give us the PRF output, we need to perform an authentication right away
        return authenticatePasskey()
    }

    const authenticatePasskey = async () => {
        if (!isSupported) {
            if (isBlocked) {
                throw new Error(
                    'WebAuthn is blocked by security policy. Please open this app in a new tab or window instead of an iframe.'
                )
            }
            throw new Error('WebAuthn is not supported in this browser')
        }

        setIsLoading(true)
        setError(null)

        try {
            const challenge = generateChallenge()

            const assertion = (await navigator.credentials.get({
                publicKey: {
                    challenge,
                    timeout: 30_000,
                    userVerification: 'required',
                    extensions: {
                        prf: {
                            eval: {
                                first: getPRFSalt(),
                            },
                        },
                    },
                },
            })) as PublicKeyCredential

            if (!assertion) {
                throw new Error('Authentication failed')
            }

            const response = assertion.response as AuthenticatorAssertionResponse
            if (!response?.userHandle) {
                throw new Error("Authenticator response doesn't contain user handle")
            }

            const extensions = assertion.getClientExtensionResults?.() || {}
            const prfOutput = extensions.prf?.results?.first

            if (!prfOutput) {
                throw new Error('Authenticator does not support the required PRF extension')
            }

            const session: AuthenticationSession = {
                userId: B64Encode(response.userHandle),
                timestamp: Date.now(),
                prfOutput: prfOutput,
            }

            setAuthSession(session)
            setIsAuthenticated(true)

            console.log('Passkey authentication successful')

            return { assertion, prfOutput }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Authentication failed'

            if (errorMessage.includes('NotAllowedError') || errorMessage.includes('User cancelled')) {
                setError('Authentication was cancelled. Please try again.')
            } else if (errorMessage.includes('InvalidStateError')) {
                setError('Passkey not found on this device. Please register a new passkey.')
            } else if (errorMessage.includes('NotSupportedError')) {
                setError('This passkey is not supported on this device.')
            } else {
                setError(errorMessage)
            }

            console.error('Passkey authentication failed:', err)
            throw new Error(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    const signOut = () => {
        setAuthSession(null)
        setIsAuthenticated(false)
        setError(null)
    }

    const clearPasskey = () => {
        sessionStorage.removeItem('encrypted-secret')
        setAuthSession(null)
        setIsAuthenticated(false)
        setError(null)
    }

    const getPRFOutput = (): BufferSource | null => {
        return authSession?.prfOutput || null
    }

    return {
        isSupported,
        isLoading,
        error,
        setError,
        isAuthenticated,
        authSession,
        isBlocked,
        registerPasskey,
        authenticatePasskey,
        signOut,
        clearPasskey,
        getPRFOutput,
    }
}

// Note that this just checks that the platform supports the PRF extension
// Whether the key used supports it or not, we'll know only after using it
function checkPRFSupport(): boolean | Promise<boolean> {
    if (!window.PublicKeyCredential || typeof PublicKeyCredential.getClientCapabilities != 'function') {
        return false
    }

    return PublicKeyCredential.getClientCapabilities().then((caps) => !!caps['extension:prf'])
}

function getPRFSalt() {
    return new TextEncoder().encode('voice-assistant:' + globalThis.location.host)
}
