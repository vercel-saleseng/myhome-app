'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import {
    createConnection,
    subscribeEntities,
    callService,
    getStates,
    getConfig,
    createLongLivedTokenAuth,
    type Connection,
    type HassEntity,
    type HassConfig,
    type Auth,
} from 'home-assistant-js-websocket'
import { useHomeAssistantConfig } from './use-home-assistant-config'

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
    category: 'door' | 'garage_door' | 'lock' | 'cover' | 'sensor' | 'other'
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

interface EntityCache {
    entities: CategorizedEntity[]
    lastUpdated: number
    ttl: number
}

export const useHomeAssistantWebSocket = (prfOutput: BufferSource | null) => {
    const { config, getApiKey } = useHomeAssistantConfig(prfOutput)
    const [connection, setConnection] = useState<Connection | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [entities, setEntities] = useState<Record<string, HassEntity>>({})
    const [haConfig, setHaConfig] = useState<HassConfig | null>(null)
    const connectionRef = useRef<Connection | null>(null)
    const [entityCache, setEntityCache] = useState<EntityCache | null>(null)

    const connect = useCallback(async (): Promise<boolean> => {
        if (!config.url || !config.hasApiKey) {
            console.error('Home Assistant not configured')
            return false
        }

        try {
            const apiKey = await getApiKey()
            if (!apiKey) {
                console.error('Failed to get API key')
                return false
            }

            console.log('Connecting to Home Assistant WebSocket:', config.url)

            // Create authentication object
            const auth = createLongLivedTokenAuth(config.url, apiKey)

            const conn = await createConnection({ auth })

            connectionRef.current = conn
            setConnection(conn)
            setIsConnected(true)

            // Get initial states and config
            const states = await getStates(conn)
            const hassConfig = await getConfig(conn)

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

            // Handle connection events
            conn.addEventListener('disconnected', () => {
                console.log('Home Assistant connection lost')
                setIsConnected(false)
                setConnection(null)
                connectionRef.current = null
            })

            conn.addEventListener('ready', () => {
                console.log('Home Assistant connection ready')
            })

            conn.addEventListener('reconnect-error', () => {
                console.log('Home Assistant reconnection failed')
                setIsConnected(false)
            })

            return true
        } catch (error) {
            console.error('Failed to connect to Home Assistant:', error)
            setIsConnected(false)
            setConnection(null)
            connectionRef.current = null
            return false
        }
    }, [config.url, config.hasApiKey, getApiKey])

    const disconnect = useCallback(() => {
        if (connectionRef.current) {
            connectionRef.current.close()
            connectionRef.current = null
            setConnection(null)
            setIsConnected(false)
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
            room: entity.attributes.area_id, // We could resolve area names if needed
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
            default:
                return `${friendlyName} is ${state}`
        }
    }

    const getEntities = useCallback(async (): Promise<HAToolResult> => {
        try {
            if (!isConnected || !connection) {
                const connected = await connect()
                if (!connected) {
                    return { success: false, error: 'Failed to connect to Home Assistant' }
                }
            }

            // Filter and categorize relevant entities
            const relevantEntities = Object.values(entities)
                .filter((entity: HassEntity) => {
                    const entityId = entity.entity_id.toLowerCase()
                    const deviceClass = entity.attributes.device_class?.toLowerCase()
                    const friendlyName = entity.attributes.friendly_name?.toLowerCase() || ''

                    return (
                        entityId.startsWith('cover.') ||
                        entityId.startsWith('lock.') ||
                        entityId.startsWith('binary_sensor.') ||
                        entityId.startsWith('switch.') ||
                        entityId.includes('door') ||
                        friendlyName.includes('door') ||
                        friendlyName.includes('garage') ||
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
    }, [isConnected, connection, entities, connect])

    const getEntityState = useCallback(
        async (entityId: string): Promise<HAToolResult> => {
            try {
                if (!isConnected || !connection) {
                    const connected = await connect()
                    if (!connected) {
                        return { success: false, error: 'Failed to connect to Home Assistant' }
                    }
                }

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
        [isConnected, connection, entities, connect]
    )

    const callHAService = useCallback(
        async (domain: string, service: string, entityId: string): Promise<HAToolResult> => {
            try {
                if (!isConnected || !connection) {
                    const connected = await connect()
                    if (!connected) {
                        return { success: false, error: 'Failed to connect to Home Assistant' }
                    }
                }

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
        [isConnected, connection, connect]
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
            if (connected && haConfig) {
                return {
                    success: true,
                    data: {
                        version: haConfig.version,
                        name: haConfig.location_name || 'Home Assistant',
                    },
                }
            }
            return { success: false, error: 'Failed to connect' }
        } catch (error) {
            console.error('Connection test failed:', error)
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
    }, [connect, haConfig])

    // Create connection status for the UI component
    const connectionStatus = {
        isConnected,
        isLoading: false, // WebSocket connections are real-time
        error: null, // Could track connection errors here
        lastChecked: new Date(),
        haInfo: haConfig
            ? {
                  version: haConfig.version,
                  name: haConfig.location_name || 'Home Assistant',
              }
            : undefined,
    }

    // Auto-connect when config changes
    useEffect(() => {
        if (config.url && config.hasApiKey && !isConnected) {
            connect()
        }
    }, [config.url, config.hasApiKey, isConnected, connect])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            disconnect()
        }
    }, [disconnect])

    return {
        // WebSocket specific
        connection,
        isConnected,
        connect,
        disconnect,
        entities,
        haConfig,

        // Tool functions (same interface as REST version)
        getEntities,
        getEntityState,
        callService: callHAService,
        findEntitiesByContext,
        testConnection,

        // Status
        isConfigured: config.url && config.hasApiKey,
        connectionStatus,
    }
}
