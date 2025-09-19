/**
 * Home Assistant connection status
 */
interface ConnectionStatus {
    isConnected: boolean
    isLoading: boolean
    error: string | null
    lastChecked: Date | null
    haInfo?: {
        version?: string
        location_name?: string
    }
}

/**
 * Data sent in the Authorization header to storage API requests
 */
interface StorageAuthHeader {
    userId: string
    keyId: string
    authSignature: string
    /** Timestamp in ms */
    timestamp: number
    /** String containing a JWK-encoded public key */
    pubKey: string
}

/**
 * Content of the signed message in the auth header for storage API requests
 */
interface StorageAuthSignedMessage {
    method: string
    secretName: string
    timestamp: number
    userId: string
    keyId: string
}

// Speech Recognition Web API types
interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean
    interimResults: boolean
    lang: string
    maxAlternatives: number
    serviceURI: string
    grammars: SpeechGrammarList

    start(): void
    stop(): void
    abort(): void

    onaudiostart: ((this: SpeechRecognition, ev: Event) => any) | null
    onaudioend: ((this: SpeechRecognition, ev: Event) => any) | null
    onend: ((this: SpeechRecognition, ev: Event) => any) | null
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => any) | null
    onnomatch: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null
    onsoundstart: ((this: SpeechRecognition, ev: Event) => any) | null
    onsoundend: ((this: SpeechRecognition, ev: Event) => any) | null
    onspeechstart: ((this: SpeechRecognition, ev: Event) => any) | null
    onspeechend: ((this: SpeechRecognition, ev: Event) => any) | null
    onstart: ((this: SpeechRecognition, ev: Event) => any) | null
}

interface SpeechRecognitionEvent extends Event {
    readonly resultIndex: number
    readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionErrorEvent extends Event {
    readonly error:
        | 'no-speech'
        | 'aborted'
        | 'audio-capture'
        | 'network'
        | 'not-allowed'
        | 'service-not-allowed'
        | 'bad-grammar'
        | 'language-not-supported'
    readonly message: string
}

interface SpeechRecognitionResultList {
    readonly length: number
    item(index: number): SpeechRecognitionResult
    [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
    readonly isFinal: boolean
    readonly length: number
    item(index: number): SpeechRecognitionAlternative
    [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
    readonly confidence: number
    readonly transcript: string
}

interface SpeechGrammarList {
    readonly length: number
    item(index: number): SpeechGrammar
    addFromURI(src: string, weight?: number): void
    addFromString(string: string, weight?: number): void
}

interface SpeechGrammar {
    src: string
    weight: number
}
