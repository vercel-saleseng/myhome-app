# MyHome Assistant - Vercel AI Cloud agent demo

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://vercel.com/alesegala-vtest314/v0-voice-assistant-app)

This repository contains a demo application showcasing Vercel's AI Cloud, deploying an AI agent. It works with a [Home Assistant](https://www.home-assistant.io/) server to check the status of and control with lights and doors, among other things. It is built with a focus on security and privacy.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js%2Ftree%2Fcanary%2Fexamples%2Fhello-world&env=AI_GATEWAY_API_KEY,NEXT_PUBLIC_CLOUD_STORAGE,BLOB_BASE_URL,BLOB_READ_WRITE_TOKEN&envDescription=See%20project's%20README&envLink=https%3A%2F%2Fgithub.com%2Fvercel-saleseng%2Fmyhome-app&project-name=myhome-app&repository-name=myhome-app)

### Features

- Interact with Home Assistant using natural language and your voice (using the Web Speech APIs)
- Authenticate with a Passkey
- Your credentials are encrypted with your Passkey (using PRF) and stored in either your browser's Local Storage, or in Vercel Blob
- Direct connection from your browser to Home Assistant, so it works even if your Home Assistant server isn't open on the public Internet

### Stack

- Next.js & [AI SDK](https://ai-sdk.dev/)
- Hosted on Vercel, using [Vercel Functions](https://vercel.com/docs/functions), [AI Gateway](https://vercel.com/docs/ai-gateway), optional [Vercel Blob](https://vercel.com/docs/vercel-blob)

## Usage requirements

In order to be able to use this app, as an **end user** you need a Passkey with support for the PRF extension.

Not all Passkeys, security keys, browsers, and operating systems support PRF; you can find [some compatibility tables here](https://www.corbado.com/blog/passkeys-prf-webauthn). A non-exhaustive list of supported scenarios include:

- macOS/iOS: Safari with Apple/iCloud Passkeys, on iOS 18.4+ and macOS 15+ (with Safari 18+)
- Chrome/Edge on macOS 15+ with iCloud Passkeys or Security Keys
- Chrome/Edge on Windows 11 with Security Keys
- Chrome/Edge or Samsung Internet on Android, with Google Password Manager or Security Keys
- 1Password on macOS (15+) and Android, but not on iOS

To be able to use voice recognition, you need support for the Web Speech APIs. Supported platforms include:

- Safari on macOS and iOS
- Chrome (note: uses a cloud service for voice recognition)
- Edge on Windows - but not on macOS (note: uses a cloud service for voice recognition)

## Deploying

To deploy this app, you'll need:

- A [Vercel](https://vercel.com/) account
- Create a [Vercel AI Gateway](https://vercel.com/docs/ai-gateway). From the Vercel dashboard, create an API key for the AI Gateway from "AI Gateway > API Keys"
- (Optional) To allow storing encrypted credentials on the cloud so they can roam between devices, create a [Vercel Blob Store](https://vercel.com/docs/vercel-blob) and get a read-write token from the Vercel dashboard under "Storage > Blob"
- A Home Assistant server to connect to, with CORS enabled from the origin where the app is deployed to (usually, a domain ending in `vercel.app`). See the [official documentation for enabling CORS support](https://www.home-assistant.io/integrations/http/#cors_allowed_origins).

Deploy with one click:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fvercel%2Fnext.js%2Ftree%2Fcanary%2Fexamples%2Fhello-world&env=AI_GATEWAY_API_KEY,NEXT_PUBLIC_CLOUD_STORAGE,BLOB_BASE_URL,BLOB_READ_WRITE_TOKEN&envDescription=See%20project's%20README&envLink=https%3A%2F%2Fgithub.com%2Fvercel-saleseng%2Fmyhome-app&project-name=myhome-app&repository-name=myhome-app)

## Security & Privacy

This demo app has a focus on security and privacy.

1. The application running on the Vercel cloud never connects to your Home Assistant server directly. Instead, all requests to Home Assistant are made directly from your browser, and the relevant output is sent to the backend app on the cloud for processing with the LLM.
    - This means that you do not need to expose your Home Assistant server on the public Internet. For example, you can configure an IP within your LAN.
    - You will need to ensure that your Home Assistant server is routable from your browser
2. Credentials for connecting to Home Assistant are encrypted using a key derived from your Passkey, using the PRF extension. Data is encrypted with AES-256 in GCM mode.
    - Because the encryption key is tied to each Passkey, losing the Passkey means the data can never be retrieved.
3. By default, credentials for accessing Home Assistant are stored in the browser's local storage, and are tied to each browser/device. You can enable storing credentials in Vercel Blob so they roam across devices; credentials stored in the cloud are end-to-end encrypted, and the backend app doesn't have the keys to decrypt them.
4. The server doesn't store any Personally Identifiable Information in cleartext, not even the URL of your Home Assistant server. Each credentials stored is identified by a random "user ID" which is tied to each Passkey, but not identifying a specific individual or linkable to any other personal information.
