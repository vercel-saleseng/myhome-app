'use client'

import { useState, useCallback, useRef, useEffect, type Dispatch, type SetStateAction } from 'react'
import {
    createConnection,
    subscribeEntities,
    callService,
    getStates,
    getConfig,
    createLongLivedTokenAuth,
    getUser,
    type Connection,
    type HassEntity,
    type HassConfig,
} from 'home-assistant-js-websocket'

export interface HAEntity {
    entity_id: string
    state: string
    attributes: {
        friendly_name?: string
        device_class?: string
        supported_features?: number
        area_id?: string
        [key: string]: any
    }
    context: {
        id: string
        parent_id?: string | null
        user_id?: string | null
    }
    last_changed: string
    last_updated: string
}

export interface CategorizedEntity extends HAEntity {
    category: 'door' | 'garage_door' | 'lock' | 'cover' | 'light' | 'sensor' | 'other'
    room?: string
    friendlyDescription: string
    canControl: boolean
    supportedActions: string[]
}

export interface HAToolResult {
    success: boolean
    data?: any
    error?: string
}

export const useHomeAssistantWebSocket = (
    config: { url: string | null },
    getApiKey: () => string | null,
    setUser: Dispatch<SetStateAction<{ name?: string | null }>>
) => {
    const [connection, setConnection] = useState<Connection | null>(null)
    const [entities, setEntities] = useState<Record<string, HassEntity>>({})
    const [haConfig, setHaConfig] = useState<HassConfig | null>(null)
    const connectionRef = useRef<Connection | null>(null)
    const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
        isConnected: false,
        isLoading: false,
        error: null,
        lastChecked: null,
    })

    const connect = useCallback(async (): Promise<boolean> => {
        setEntities({})

        const apiKey = getApiKey()
        if (!config.url || !apiKey) {
            setConnectionStatus({
                isConnected: false,
                isLoading: false,
                error: 'Configuration incomplete',
                lastChecked: null,
            })
            return false
        }

        try {
            console.log('Connecting to Home Assistant WebSocket at', config.url)

            setConnectionStatus((prev) => ({ ...prev, isLoading: true, error: null }))

            // Create authentication object
            const auth = createLongLivedTokenAuth(config.url, apiKey)

            const conn = await createConnection({ auth })

            connectionRef.current = conn
            setConnection(conn)

            // Handle connection events
            conn.addEventListener('disconnected', () => {
                console.warn('Home Assistant connection lost')
                setConnection(null)
                connectionRef.current = null
            })

            conn.addEventListener('reconnect-error', () => {
                console.error('Home Assistant reconnection failed')
                disconnect()
            })

            // Get initial states and config
            const states = await getStates(conn)
            const hassConfig = await getConfig(conn)
            const hassUser = await getUser(conn)
            if (hassUser?.name) {
                setUser({ name: hassUser.name })
            }

            const entitiesMap: Record<string, HassEntity> = {}
            states.forEach((entity) => {
                entitiesMap[entity.entity_id] = entity
            })

            setEntities(entitiesMap)
            setHaConfig(hassConfig)

            // Subscribe to entity updates
            subscribeEntities(conn, (entities) => {
                setEntities(entities)
            })

            setConnectionStatus({
                isConnected: true,
                isLoading: false,
                error: null,
                lastChecked: new Date(),
                haInfo: hassConfig,
            })

            return true
        } catch (err) {
            let errorMessage = 'Connection failed'

            if (err instanceof Error) {
                if (err.name === 'TimeoutError') {
                    errorMessage = 'Connection timeout - check URL'
                } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
                    errorMessage = 'Network error - check URL and connectivity'
                } else {
                    errorMessage = err.message
                }
            }

            console.error('Failed to connect to Home Assistant:', err)
            setConnection(null)
            setConnectionStatus({
                isConnected: false,
                isLoading: false,
                error: errorMessage,
                lastChecked: new Date(),
            })
            connectionRef.current = null
            return false
        }
    }, [config, getApiKey])

    const disconnect = useCallback(() => {
        console.info('Disconnecting from Home Assistant')
        if (connectionRef.current) {
            connectionRef.current.close()
            connectionRef.current = null
            setConnection(null)
        }
    }, [])

    const categorizeEntity = (entity: HassEntity): CategorizedEntity => {
        const entityId = entity.entity_id.toLowerCase()
        const deviceClass = entity.attributes.device_class?.toLowerCase()
        const friendlyName = entity.attributes.friendly_name?.toLowerCase() || ''
        const domain = entityId.split('.')[0]

        // Determine category
        let category: CategorizedEntity['category'] = 'other'
        let canControl = false
        let supportedActions: string[] = []

        if (domain === 'cover') {
            if (deviceClass === 'garage' || friendlyName.includes('garage')) {
                category = 'garage_door'
                canControl = true
                supportedActions = ['open', 'close', 'stop']
            } else {
                category = 'cover'
                canControl = true
                supportedActions = ['open', 'close']
            }
        } else if (domain === 'lock') {
            category = 'lock'
            canControl = true
            supportedActions = ['lock', 'unlock']
        } else if (domain === 'light') {
            category = 'light'
            canControl = true
            const supportedFeatures = entity.attributes.supported_features || 0
            supportedActions = ['turn_on', 'turn_off', 'toggle', 'check_status']

            // Check for brightness support (bit 1)
            if (supportedFeatures & 1) {
                supportedActions.push('dim', 'brighten')
            }

            // Check for color support (bit 4)
            if (supportedFeatures & 16) {
                supportedActions.push('set_color')
            }
        } else if (domain === 'binary_sensor' && (deviceClass === 'door' || deviceClass === 'garage_door')) {
            category = deviceClass === 'garage_door' ? 'garage_door' : 'door'
            canControl = false
            supportedActions = ['check_status']
        } else if (entityId.includes('door') || friendlyName.includes('door')) {
            category = 'door'
            canControl = domain === 'switch' || domain === 'cover'
            supportedActions = canControl ? ['open', 'close'] : ['check_status']
        }

        // Generate friendly description
        const friendlyDescription = generateFriendlyDescription(entity, category)

        return {
            ...entity,
            category,
            // We could resolve area names if needed
            room: entity.attributes.area_id,
            friendlyDescription,
            canControl,
            supportedActions,
        }
    }

    const generateFriendlyDescription = (entity: HassEntity, category: string): string => {
        const friendlyName = entity.attributes.friendly_name || entity.entity_id.replace(/_/g, ' ')
        const state = entity.state

        switch (category) {
            case 'garage_door':
                return `${friendlyName} is ${state === 'open' ? 'open' : state === 'closed' ? 'closed' : state}`
            case 'door':
                if (entity.entity_id.startsWith('binary_sensor.')) {
                    return `${friendlyName} is ${state === 'on' ? 'open' : 'closed'}`
                }
                return `${friendlyName} is ${state}`
            case 'lock':
                return `${friendlyName} is ${state === 'locked' ? 'locked' : 'unlocked'}`
            case 'cover':
                return `${friendlyName} is ${state}`
            case 'light':
                const isOn = state === 'on'
                let description = `${friendlyName} is ${isOn ? 'on' : 'off'}`

                if (isOn && entity.attributes.brightness) {
                    const brightness = Math.round((entity.attributes.brightness / 255) * 100)
                    description += ` (${brightness}% brightness)`
                }

                if (isOn && entity.attributes.rgb_color) {
                    const [r, g, b] = entity.attributes.rgb_color
                    description += ` (color: rgb(${r}, ${g}, ${b}))`
                }

                return description
            default:
                return `${friendlyName} is ${state}`
        }
    }

    const getEntities = useCallback(async (): Promise<HAToolResult> => {
        console.log('getEntities', entities)
        try {
            // Filter and categorize relevant entities
            const relevantEntities = Object.values(entities)
                .filter((entity: HassEntity) => {
                    const entityId = entity.entity_id.toLowerCase()
                    const deviceClass = entity.attributes.device_class?.toLowerCase()
                    const friendlyName = entity.attributes.friendly_name?.toLowerCase() || ''

                    return (
                        entityId.startsWith('cover.') ||
                        entityId.startsWith('lock.') ||
                        entityId.startsWith('light.') ||
                        entityId.startsWith('binary_sensor.') ||
                        entityId.startsWith('switch.') ||
                        entityId.includes('door') ||
                        friendlyName.includes('door') ||
                        friendlyName.includes('garage') ||
                        friendlyName.includes('light') ||
                        deviceClass === 'door' ||
                        deviceClass === 'garage_door'
                    )
                })
                .map((entity: HassEntity) => categorizeEntity(entity))
                .filter((entity: CategorizedEntity) => entity.category !== 'other')

            console.log('Found and categorized entities:', relevantEntities.length)
            return { success: true, data: relevantEntities }
        } catch (error) {
            console.error('Failed to get entities:', error)
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
    }, [entities])

    const getEntityState = useCallback(
        async (entityId: string): Promise<HAToolResult> => {
            try {
                const entity = entities[entityId]
                if (!entity) {
                    return { success: false, error: `Entity ${entityId} not found` }
                }

                console.log('Getting state for entity:', entityId)
                return { success: true, data: entity }
            } catch (error) {
                console.error('Failed to get entity state:', error)
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
            }
        },
        [entities]
    )

    const callHAService = useCallback(
        async (domain: string, service: string, entityId: string): Promise<HAToolResult> => {
            try {
                console.log('Calling service:', { domain, service, entityId })

                if (!connection) {
                    return { success: false, error: 'No connection available' }
                }

                await callService(connection, domain, service, {
                    entity_id: entityId,
                })

                return { success: true, data: { domain, service, entityId } }
            } catch (error) {
                console.error('Failed to call service:', error)
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
            }
        },
        [connection]
    )

    const findEntitiesByContext = useCallback(
        async (context: string): Promise<HAToolResult> => {
            try {
                const entitiesResult = await getEntities()
                if (!entitiesResult.success) {
                    return entitiesResult
                }

                const allEntities = entitiesResult.data as CategorizedEntity[]
                const contextLower = context.toLowerCase().trim()

                const matchingEntities = allEntities.filter((entity: CategorizedEntity) => {
                    const entityId = entity.entity_id.toLowerCase()
                    const friendlyName = entity.attributes.friendly_name?.toLowerCase() || ''
                    const room = entity.room?.toLowerCase() || ''

                    // Direct matches
                    if (
                        entityId.includes(contextLower) ||
                        friendlyName.includes(contextLower) ||
                        room.includes(contextLower)
                    ) {
                        return true
                    }

                    // Common synonyms
                    const synonyms: Record<string, string[]> = {
                        garage: ['car', 'vehicle', 'parking'],
                        front: ['entrance', 'main', 'primary'],
                        back: ['rear', 'backyard', 'patio'],
                        door: ['entrance', 'entry', 'gate'],
                        lock: ['security', 'secure'],
                        light: ['lamp', 'lighting', 'bulb', 'illuminate'],
                    }

                    for (const [key, values] of Object.entries(synonyms)) {
                        if (contextLower.includes(key) || values.some((v) => contextLower.includes(v))) {
                            if (entityId.includes(key) || friendlyName.includes(key) || room.includes(key)) {
                                return true
                            }
                        }
                    }

                    return false
                })

                console.log('Found entities for context:', context, matchingEntities.length)
                return { success: true, data: matchingEntities }
            } catch (error) {
                console.error('Failed to find entities by context:', error)
                return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
            }
        },
        [getEntities]
    )

    const testConnection = useCallback(async (): Promise<HAToolResult> => {
        try {
            const connected = await connect()
            if (connected) {
                return {
                    success: true,
                }
            }
            return { success: false, error: 'Failed to connect' }
        } catch (error) {
            console.error('Connection test failed:', error)
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
    }, [connect, config])

    // Auto-connect when config changes
    useEffect(() => {
        if (config.url && !connection) {
            console.log('Attempting auto-connect...')
            connect()
        }
    }, [config.url])

    // Disconnect on unmount
    useEffect(() => {
        return () => {
            disconnect()
        }
    }, [])

    return {
        // WebSocket specific
        isConnected: !!connection,
        connect,
        disconnect,
        entities,
        haConfig,

        // Info
        connectionStatus,

        // Tool functions (same interface as REST version)
        getEntities,
        getEntityState,
        callService: callHAService,
        findEntitiesByContext,
        testConnection,
    }
}
