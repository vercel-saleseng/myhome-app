# MyHome Assistant app

_Automatically synced with your [v0.app](https://v0.app) deployments_

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/alesegala-vtest314/v0-voice-assistant-app)
[![Built with v0](https://img.shields.io/badge/Built%20with-v0.app-black?style=for-the-badge)](https://v0.app/chat/projects/0YkPvVuj8QL)

## Overview

This repository will stay in sync with your deployed chats on [v0.app](https://v0.app).
Any changes you make to your deployed app will be automatically pushed to this repository from [v0.app](https://v0.app).

## Deployment

Your project is live at:

**[https://vercel.com/alesegala-vtest314/v0-voice-assistant-app](https://vercel.com/alesegala-vtest314/v0-voice-assistant-app)**

## Cloud Storage (Optional)

This app supports optional cloud storage for encrypted secrets using Vercel Blob. When configured, your Home Assistant configuration will sync across devices while remaining securely encrypted with your Passkey.

### Setup

1. Create a Vercel Blob store in your Vercel dashboard
2. Copy the `BLOB_READ_WRITE_TOKEN` from your Vercel dashboard
3. Add it to your environment variables:

```bash
BLOB_READ_WRITE_TOKEN=your_token_here
```

### Storage Behavior

- **Without Vercel Blob**: Secrets are stored encrypted in browser localStorage (device-specific)
- **With Vercel Blob**: Secrets are stored encrypted in Vercel Blob (syncs across devices)
- **Security**: All secrets are encrypted using your Passkey's PRF output before storage
- **Authentication**: API requests are authenticated using passkey-derived signatures
- **Privacy**: Even with cloud storage, your secrets remain encrypted and only you can decrypt them

### Authentication System

The cloud storage uses a robust authentication system:

1. **Credential Registration**: Your passkey's public key is registered on first use
2. **Request Signing**: Each API request is signed with your passkey
3. **Dual Verification**: Both auth signatures and ownership proofs are verified
4. **Tamper Protection**: Signatures include timestamps to prevent replay attacks
5. **User Isolation**: Each user's secrets are cryptographically isolated by their unique passkey

The app automatically detects if Vercel Blob is configured and switches storage methods accordingly.

## Build your app

Continue building your app on:

**[https://v0.app/chat/projects/0YkPvVuj8QL](https://v0.app/chat/projects/0YkPvVuj8QL)**

## How It Works

1. Create and modify your project using [v0.app](https://v0.app)
2. Deploy your chats from the v0 interface
3. Changes are automatically pushed to this repository
4. Vercel deploys the latest version from this repository
