'use client'

import { useState, useEffect } from 'react'

interface PasskeyCredential {
    id: string
    rawId: ArrayBuffer
    type: 'public-key'
}

interface PasskeyUser {
    id: string
    name: string
    displayName: string
}

interface AuthenticationSession {
    userId: string
    timestamp: number
    prfOutput?: ArrayBuffer
}

export const usePasskey = () => {
    const [isSupported, setIsSupported] = useState(false)
    const [hasPasskey, setHasPasskey] = useState(false)
    const [user, setUser] = useState<PasskeyUser | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isAuthenticated, setIsAuthenticated] = useState(false)
    const [authSession, setAuthSession] = useState<AuthenticationSession | null>(null)
    const [isBlocked, setIsBlocked] = useState(false)

    const testWebAuthnAvailability = async (): Promise<boolean> => {
        try {
            await navigator.credentials.create({
                publicKey: {
                    challenge: new Uint8Array(1),
                    rp: { name: 'test', id: 'localhost' },
                    user: { id: new Uint8Array(1), name: 'test', displayName: 'test' },
                    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
                    timeout: 1,
                },
            })
            return true
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : ''
            if (
                errorMessage.includes('publickey-credentials-get') ||
                errorMessage.includes('Permissions Policy') ||
                errorMessage.includes('not enabled in this document')
            ) {
                setIsBlocked(true)
                return false
            }
            return true
        }
    }

    useEffect(() => {
        const checkSupport = async () => {
            const check =
                typeof window !== 'undefined' &&
                'navigator' in window &&
                'credentials' in navigator &&
                typeof navigator.credentials.create === 'function'

            setIsSupported(check)
            if (!check) {
                return
            }

            const storedUser = localStorage.getItem('passkey-user')
            const storedCredentialId = localStorage.getItem('passkey-credential-id')
            const storedSession = localStorage.getItem('auth-session')

            if (storedUser && storedCredentialId) {
                setUser(JSON.parse(storedUser))
                setHasPasskey(true)

                if (storedSession) {
                    const session: AuthenticationSession = JSON.parse(storedSession)
                    const isSessionValid = Date.now() - session.timestamp < 24 * 60 * 60 * 1000

                    if (isSessionValid) {
                        setAuthSession(session)
                        setIsAuthenticated(true)
                    } else {
                        localStorage.removeItem('auth-session')
                    }
                }
            }
        }

        checkSupport()
    }, [])

    const generateChallenge = (): Uint8Array => {
        return crypto.getRandomValues(new Uint8Array(32))
    }

    const generateUserId = (): Uint8Array => {
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
            const userId = generateUserId()
            const challenge = generateChallenge()

            const credential = (await navigator.credentials.create({
                publicKey: {
                    challenge,
                    rp: {
                        name: 'Voice Assistant',
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
                        authenticatorAttachment: 'platform',
                        userVerification: 'required',
                        residentKey: 'required',
                    },
                    timeout: 60000,
                    extensions: {
                        prf: {},
                    },
                },
            })) as PublicKeyCredential

            if (!credential) {
                throw new Error('Failed to create passkey')
            }

            const passkeyUser: PasskeyUser = {
                id: Array.from(userId)
                    .map((b) => b.toString(16).padStart(2, '0'))
                    .join(''),
                name: username,
                displayName: displayName,
            }

            localStorage.setItem('passkey-user', JSON.stringify(passkeyUser))
            localStorage.setItem('passkey-credential-id', credential.id)

            setUser(passkeyUser)
            setHasPasskey(true)

            const session: AuthenticationSession = {
                userId: passkeyUser.id,
                timestamp: Date.now(),
            }

            localStorage.setItem('auth-session', JSON.stringify(session))
            setAuthSession(session)
            setIsAuthenticated(true)

            console.log('Passkey registered successfully:', credential.id)
            return credential
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'Failed to register passkey'
            setError(errorMessage)
            console.error('[v0] Passkey registration failed:', err)
            throw new Error(errorMessage)
        } finally {
            setIsLoading(false)
        }
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

        if (!hasPasskey) {
            throw new Error('No passkey found. Please register first.')
        }

        setIsLoading(true)
        setError(null)

        try {
            const challenge = generateChallenge()
            const credentialId = localStorage.getItem('passkey-credential-id')

            if (!credentialId) {
                throw new Error('No credential ID found')
            }

            const credentialIdBytes = new Uint8Array(
                atob(credentialId.replace(/-/g, '+').replace(/_/g, '/'))
                    .split('')
                    .map((char) => char.charCodeAt(0))
            )

            const assertion = (await navigator.credentials.get({
                publicKey: {
                    challenge,
                    timeout: 60000,
                    userVerification: 'required',
                    allowCredentials: [
                        {
                            id: credentialIdBytes,
                            type: 'public-key',
                        },
                    ],
                    extensions: {
                        prf: {
                            eval: {
                                first: new TextEncoder().encode('voice-assistant-secret'),
                            },
                        },
                    },
                },
            })) as PublicKeyCredential

            if (!assertion) {
                throw new Error('Authentication failed')
            }

            const response = assertion.response as AuthenticatorAssertionResponse
            const extensions = (assertion as any).getClientExtensionResults?.() || {}
            const prfOutput = extensions.prf?.results?.first

            const session: AuthenticationSession = {
                userId: user!.id,
                timestamp: Date.now(),
                prfOutput: prfOutput,
            }

            localStorage.setItem(
                'auth-session',
                JSON.stringify({
                    userId: session.userId,
                    timestamp: session.timestamp,
                })
            )

            setAuthSession(session)
            setIsAuthenticated(true)

            console.log('[v0] Passkey authentication successful')
            console.log('[v0] PRF extension available:', !!prfOutput)

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

            console.error('[v0] Passkey authentication failed:', err)
            throw new Error(errorMessage)
        } finally {
            setIsLoading(false)
        }
    }

    const signOut = () => {
        localStorage.removeItem('auth-session')
        setAuthSession(null)
        setIsAuthenticated(false)
        setError(null)
    }

    const clearPasskey = () => {
        localStorage.removeItem('passkey-user')
        localStorage.removeItem('passkey-credential-id')
        localStorage.removeItem('auth-session')
        localStorage.removeItem('encrypted-secret')
        setUser(null)
        setHasPasskey(false)
        setAuthSession(null)
        setIsAuthenticated(false)
        setError(null)
    }

    const getPRFOutput = (): ArrayBuffer | null => {
        return authSession?.prfOutput || null
    }

    return {
        isSupported,
        hasPasskey,
        user,
        isLoading,
        error,
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
