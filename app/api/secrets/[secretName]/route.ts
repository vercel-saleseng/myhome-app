import { NextRequest, NextResponse } from 'next/server'
import { put, del } from '@vercel/blob'
import { Encode as B64Encode, Decode as B64Decode } from 'arraybuffer-encoding/base64/url'

interface StoredSecret {
    name: string
    encryptedData: string
    nonce: string
    timestamp: Date
}

interface StoreRequestData {
    data: string
    nonce: string
}

/*async function parseAuthHeader(authHeaderValue: string | null): Promise<AuthHeader | null> {
    if (!authHeaderValue) return null

    try {
        // Expected format: "Bearer <base64url-encoded-json>"
        const [scheme, token] = authHeaderValue.split(' ')
        if (scheme !== 'Bearer' || !token) return null

        const decoded = atob(token.replace(/-/g, '+').replace(/_/g, '/'))
        return JSON.parse(decoded) as AuthHeader
    } catch {
        return null
    }
}*/

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

    try {
        /*const authHeaderValue = request.headers.get('authorization')
        const authHeader = await parseAuthHeader(authHeaderValue)

        if (!authHeader) {
            return NextResponse.json({ error: 'Invalid authorization header' }, { status: 401 })
        }*/

        // Read the body from the request
        const body = (await request.json()) as StoreRequestData
        if (!body.data) {
            return NextResponse.json({ error: 'Missing data' }, { status: 400 })
        }

        // Data to store
        const secretData: StoredSecret = {
            name: secretName,
            encryptedData: body.data,
            nonce: body.nonce,
            timestamp: new Date(),
        }

        // Store in Vercel Blob
        const userId = 'test'
        const blob = await put(`secrets/${userId}/${secretName}.json`, JSON.stringify(secretData), {
            access: 'public',
            contentType: 'application/json',
            allowOverwrite: true,
            addRandomSuffix: false,
        })

        return NextResponse.json({
            success: true,
            blobUrl: blob.url,
            timestamp: secretData.timestamp,
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

    const baseUrl = process.env.BLOB_BASE_URL.endsWith('/')
        ? process.env.BLOB_BASE_URL
        : process.env.BLOB_BASE_URL + '/'

    try {
        // Retrieve from Vercel Blob
        const userId = 'test'
        const blobPath = `secrets/${userId}/${secretName}.json`

        try {
            const response = await fetch(baseUrl + blobPath)

            if (!response.ok) {
                if (response.status === 404) {
                    return NextResponse.json({ error: 'Secret not found' }, { status: 404 })
                }
                throw new Error(`Failed to fetch blob: ${response.status}`)
            }

            const secretData: StoredSecret = await response.json()

            return NextResponse.json({
                success: true,
                secretData,
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

    const baseUrl = process.env.BLOB_BASE_URL.endsWith('/')
        ? process.env.BLOB_BASE_URL
        : process.env.BLOB_BASE_URL + '/'

    try {
        // Delete from Vercel Blob
        const userId = 'test'

        try {
            await del(`secrets/${userId}/${secretName}.json`)
            return NextResponse.json({
                success: true,
                message: 'Secret deleted successfully',
            })
        } catch (blobError) {
            if (blobError instanceof Error && blobError.message.includes('404')) {
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
