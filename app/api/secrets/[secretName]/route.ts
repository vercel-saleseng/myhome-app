import { NextRequest, NextResponse } from 'next/server'
import { put, del, head, BlobNotFoundError } from '@vercel/blob'
import { Encode as B64Encode, Decode as B64Decode } from 'arraybuffer-encoding/base64/url'

// Allowed clock skew for signatures, in ms
const allowedClockSkew = 5 * 60 * 1000

interface CloudStoredSecret {
    name: string
    data: any
    pubKeyDigest: string
    timestamp: number
}

interface StoreRequestData {
    data: any
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()

async function parseAuthHeader(method: string, secretName: string, authHeaderValue: string | null) {
    authHeaderValue = (authHeaderValue || '').trim()
    if (!authHeaderValue) {
        return null
    }

    // Expected format: "<base64url-encoded-json>"
    let sah: StorageAuthHeader
    try {
        sah = JSON.parse(decoder.decode(B64Decode(authHeaderValue))) as StorageAuthHeader
    } catch (error) {
        console.debug('Authorization header is not valid', { error })
        return null
    }

    // Ensure all required fields are present
    if (!sah.authSignature || !sah.keyId || !sah.pubKey || !sah.timestamp || !sah.userId) {
        console.debug('Authorization header is missing a required field', { storageAuthHeader: sah })
        return null
    }

    // Ensure the timestamp is within the allowed clock skew from now
    const now = Date.now()
    if (sah.timestamp < now - allowedClockSkew / 2 || sah.timestamp > now + allowedClockSkew / 2) {
        console.debug('Authorization header is not within allowed timeframe', { storageAuthHeader: sah, now })
        return null
    }

    let pubKeyJWK: JsonWebKey
    try {
        // Decode the public key from JWK
        pubKeyJWK = JSON.parse(sah.pubKey) as JsonWebKey
        const alg: EcKeyImportParams = { name: 'ECDSA', namedCurve: 'P-256' }
        const pubKey = await crypto.subtle.importKey('jwk', pubKeyJWK, alg, true, ['verify'])

        // Validate the signature
        const authMessage = JSON.stringify({
            method,
            secretName,
            timestamp: sah.timestamp,
            userId: sah.userId,
            keyId: sah.keyId,
        } as StorageAuthSignedMessage)
        const valid = await crypto.subtle.verify(
            { name: 'ECDSA', hash: 'SHA-256' },
            pubKey,
            B64Decode(sah.authSignature),
            encoder.encode(authMessage)
        )
        if (!valid) {
            console.debug("Authorization header's signature is not valid", { storageAuthHeader: sah })
            return null
        }
    } catch (error) {
        console.debug('Authorization header validation error', { storageAuthHeader: sah, error })
        return null
    }

    // Return the hash of the public key and the user ID
    const pkd = await pubKeyDigest(sah.keyId, pubKeyJWK)
    return { pubKeyDigest: pkd, userId: sah.userId }
}

async function pubKeyDigest(keyId: string, pubKeyJWK: JsonWebKey): Promise<string> {
    // The hash is computed as SHA256(keyId || '.' || key.x || '.' || key.y)
    // Dot is 0x2e
    const keyIdBuf = encoder.encode(keyId)
    const xBuf = encoder.encode(pubKeyJWK.x)
    const yBuf = encoder.encode(pubKeyJWK.y)
    const base = new Uint8Array([...keyIdBuf, 0x2e, ...xBuf, 0x2e, ...yBuf])

    // Return the base64-encoded hash
    const digest = await crypto.subtle.digest('SHA-256', base)
    return B64Encode(digest)
}

type RestParams = Promise<{ secretName: string }>

// POST /api/secrets/[secretName] - Store an encrypted secret
export async function POST(request: NextRequest, { params }: { params: RestParams }) {
    if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.BLOB_BASE_URL) {
        console.error(
            'Vercel Blob is not configured: environment variables BLOB_BASE_URL and BLOB_READ_WRITE_TOKEN must be set'
        )
        return NextResponse.json({ error: 'Vercel Blob is not configured' }, { status: 503 })
    }

    const secretName = (await params).secretName
    if (!secretName) {
        return NextResponse.json({ error: 'Secret name is required' }, { status: 400 })
    }

    const authHeader = await parseAuthHeader(request.method, secretName, request.headers.get('authorization'))
    if (!authHeader) {
        return NextResponse.json({ error: 'Invalid authorization header' }, { status: 401 })
    }

    try {
        // Read the body from the request
        const body = (await request.json()) as StoreRequestData
        if (!body.data) {
            return NextResponse.json({ error: 'Missing data' }, { status: 400 })
        }

        // Data to store
        const secretData: CloudStoredSecret = {
            name: secretName,
            pubKeyDigest: authHeader.pubKeyDigest,
            data: body.data,
            timestamp: Date.now(),
        }

        // We use Trust On First Use, so check if there's already a blob at the path
        const blobPath = `secrets/${authHeader.userId}/${secretName}.json`

        try {
            const blobHead = await head(blobPath)
            console.log('HERE', blobHead)
        } catch (blobError) {
            // If the error is a 404, it means that there's no blob yet, so we can ignore that
            // Re-throw all other exceptions
            if (!(blobError instanceof BlobNotFoundError)) {
                throw blobError
            }
        }

        // Store in Vercel Blob
        const blob = await put(blobPath, JSON.stringify(secretData), {
            access: 'public',
            contentType: 'application/json',
            allowOverwrite: true,
            addRandomSuffix: false,
        })

        console.info('Stored secret', { secretName, userId: authHeader.userId, blobUrl: blob.url })

        return NextResponse.json({
            success: true,
        })
    } catch (error) {
        console.error('Error storing secret:', error)
        return NextResponse.json({ error: 'Failed to store secret' }, { status: 500 })
    }
}

// GET /api/secrets/[secretName] - Retrieve an encrypted secret
export async function GET(request: NextRequest, { params }: { params: RestParams }) {
    if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.BLOB_BASE_URL) {
        console.error(
            'Vercel Blob is not configured: environment variables BLOB_BASE_URL and BLOB_READ_WRITE_TOKEN must be set'
        )
        return NextResponse.json({ error: 'Vercel Blob is not configured' }, { status: 503 })
    }

    const secretName = (await params).secretName
    if (!secretName) {
        return NextResponse.json({ error: 'Secret name is required' }, { status: 400 })
    }

    const authHeader = await parseAuthHeader(request.method, secretName, request.headers.get('authorization'))
    if (!authHeader) {
        return NextResponse.json({ error: 'Invalid authorization header' }, { status: 401 })
    }

    const baseUrl = process.env.BLOB_BASE_URL.endsWith('/')
        ? process.env.BLOB_BASE_URL
        : process.env.BLOB_BASE_URL + '/'

    try {
        // Retrieve from Vercel Blob
        const blobPath = `secrets/${authHeader.userId}/${secretName}.json`

        try {
            const response = await fetch(baseUrl + blobPath)

            if (!response.ok) {
                if (response.status === 404) {
                    return NextResponse.json({ error: 'Secret not found' }, { status: 404 })
                }
                throw new Error(`Failed to fetch blob: ${response.status}`)
            }

            const secretData: CloudStoredSecret = await response.json()

            return NextResponse.json({
                success: true,
                data: secretData.data,
            })
        } catch (blobError) {
            if (blobError instanceof Error && blobError.message.includes('404')) {
                return NextResponse.json({ error: 'Secret not found' }, { status: 404 })
            }
            throw blobError
        }
    } catch (error) {
        console.error('Error retrieving secret:', error)
        return NextResponse.json({ error: 'Failed to retrieve secret' }, { status: 500 })
    }
}

// DELETE /api/secrets/[secretName] - Delete an encrypted secret
export async function DELETE(request: NextRequest, { params }: { params: RestParams }) {
    if (!process.env.BLOB_READ_WRITE_TOKEN || !process.env.BLOB_BASE_URL) {
        console.error(
            'Vercel Blob is not configured: environment variables BLOB_BASE_URL and BLOB_READ_WRITE_TOKEN must be set'
        )
        return NextResponse.json({ error: 'Vercel Blob is not configured' }, { status: 503 })
    }

    const secretName = (await params).secretName
    if (!secretName) {
        return NextResponse.json({ error: 'Secret name is required' }, { status: 400 })
    }

    const authHeader = await parseAuthHeader(request.method, secretName, request.headers.get('authorization'))
    if (!authHeader) {
        return NextResponse.json({ error: 'Invalid authorization header' }, { status: 401 })
    }

    try {
        // Delete from Vercel Blob
        try {
            await del(`secrets/${authHeader.userId}/${secretName}.json`)
            return NextResponse.json({
                success: true,
                message: 'Secret deleted successfully',
            })
        } catch (blobError) {
            if (blobError instanceof BlobNotFoundError) {
                return NextResponse.json({
                    success: true,
                    message: 'Secret was already deleted or did not exist',
                })
            }
            throw blobError
        }
    } catch (error) {
        console.error('Error deleting secret:', error)
        return NextResponse.json({ error: 'Failed to delete secret' }, { status: 500 })
    }
}
