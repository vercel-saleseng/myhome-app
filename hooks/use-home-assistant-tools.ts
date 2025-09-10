'use client'

import { useState, useCallback, useRef } from 'react'
import { useHomeAssistantConfig } from './use-home-assistant-config'

export interface HAEntity {
    entity_id: string
    state: string
    attributes: {
        friendly_name?: string
        device_class?: string
        supported_features?: number
        area_id?: string
        device_id?: string
        [key: string]: any
    }
}

export interface HAArea {
    area_id: string
    name: string
    aliases?: string[]
}

export interface HADevice {
    id: string
    name: string
    area_id?: string
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
    areas: HAArea[]
    devices: HADevice[]
    lastUpdated: number
    ttl: number // Time to live in milliseconds
}

export const useHomeAssistantTools = (prfOutput: BufferSource | null) => {
    const { config, getApiKey } = useHomeAssistantConfig(prfOutput)
    const [entityCache, setEntityCache] = useState<EntityCache | null>(null)
    const cacheRef = useRef<EntityCache | null>(null)

    const makeHARequest = async (endpoint: string, method: 'GET' | 'POST' = 'GET', body?: any): Promise<any> => {
        if (!config.url || !config.hasApiKey) {
            throw new Error('Home Assistant not configured')
        }

        const apiKey = await getApiKey()
        if (!apiKey) {
            throw new Error('Failed to get API key')
        }

        const response = await fetch(`${config.url}/api/${endpoint}`, {
            method,
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: body ? JSON.stringify(body) : undefined,
            signal: AbortSignal.timeout(10000),
        })

        if (!response.ok) {
            throw new Error(`Home Assistant API error: ${response.status} ${response.statusText}`)
        }

        return response.json()
    }

    const getAreas = async (): Promise<HAArea[]> => {
        try {
            const areas = await makeHARequest('config/area_registry')
            return areas.map((area: any) => ({
                area_id: area.area_id,
                name: area.name,
                aliases: area.aliases || [],
            }))
        } catch (error) {
            console.warn('[v0] Failed to get areas:', error)
            return []
        }
    }

    const getDevices = async (): Promise<HADevice[]> => {
        try {
            const devices = await makeHARequest('config/device_registry')
            return devices.map((device: any) => ({
                id: device.id,
                name: device.name_by_user || device.name,
                area_id: device.area_id,
            }))
        } catch (error) {
            console.warn('[v0] Failed to get devices:', error)
            return []
        }
    }

    const categorizeEntity = (entity: HAEntity, areas: HAArea[], devices: HADevice[]): CategorizedEntity => {
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

        // Find room/area
        let room: string | undefined
        if (entity.attributes.area_id) {
            const area = areas.find((a) => a.area_id === entity.attributes.area_id)
            room = area?.name
        } else if (entity.attributes.device_id) {
            const device = devices.find((d) => d.id === entity.attributes.device_id)
            if (device?.area_id) {
                const area = areas.find((a) => a.area_id === device.area_id)
                room = area?.name
            }
        }

        // Generate friendly description
        const friendlyDescription = generateFriendlyDescription(entity, category, room)

        return {
            ...entity,
            category,
            room,
            friendlyDescription,
            canControl,
            supportedActions,
        }
    }

    const generateFriendlyDescription = (entity: HAEntity, category: string, room?: string): string => {
        const friendlyName = entity.attributes.friendly_name || entity.entity_id.replace(/_/g, ' ')
        const state = entity.state
        const roomPrefix = room ? `${room} ` : ''

        switch (category) {
            case 'garage_door':
                return `${roomPrefix}garage door is ${state === 'open' ? 'open' : state === 'closed' ? 'closed' : state}`
            case 'door':
                if (entity.entity_id.startsWith('binary_sensor.')) {
                    return `${roomPrefix}door is ${state === 'on' ? 'open' : 'closed'}`
                }
                return `${roomPrefix}door is ${state}`
            case 'lock':
                return `${roomPrefix}lock is ${state === 'locked' ? 'locked' : 'unlocked'}`
            case 'cover':
                return `${roomPrefix}${friendlyName} is ${state}`
            default:
                return `${roomPrefix}${friendlyName} is ${state}`
        }
    }

    const matchContext = (entity: CategorizedEntity, context: string, areas: HAArea[]): boolean => {
        const contextLower = context.toLowerCase().trim()
        const entityId = entity.entity_id.toLowerCase()
        const friendlyName = entity.attributes.friendly_name?.toLowerCase() || ''
        const room = entity.room?.toLowerCase() || ''

        // Direct matches
        if (entityId.includes(contextLower) || friendlyName.includes(contextLower) || room.includes(contextLower)) {
            return true
        }

        // Room/area aliases
        if (entity.room) {
            const area = areas.find((a) => a.name.toLowerCase() === entity.room?.toLowerCase())
            if (area?.aliases?.some((alias) => alias.toLowerCase().includes(contextLower))) {
                return true
            }
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
    }

    const getEntities = async (forceRefresh = false): Promise<HAToolResult> => {
        try {
            // Check cache first
            const now = Date.now()
            if (!forceRefresh && cacheRef.current && now - cacheRef.current.lastUpdated < cacheRef.current.ttl) {
                console.log('[v0] Using cached entities')
                return { success: true, data: cacheRef.current.entities }
            }

            console.log('[v0] Fetching fresh Home Assistant entities...')

            // Fetch all data in parallel
            const [states, areas, devices] = await Promise.all([makeHARequest('states'), getAreas(), getDevices()])

            // Filter and categorize entities
            const relevantEntities = states
                .filter((entity: HAEntity) => {
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
                .map((entity: HAEntity) => categorizeEntity(entity, areas, devices))
                .filter((entity: CategorizedEntity) => entity.category !== 'other')

            // Update cache
            const newCache: EntityCache = {
                entities: relevantEntities,
                areas,
                devices,
                lastUpdated: now,
                ttl: 5 * 60 * 1000, // 5 minutes
            }

            cacheRef.current = newCache
            setEntityCache(newCache)

            console.log('[v0] Found and categorized entities:', relevantEntities.length)
            return { success: true, data: relevantEntities }
        } catch (error) {
            console.error('[v0] Failed to get entities:', error)
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
    }

    // Get specific entity state
    const getEntityState = async (entityId: string): Promise<HAToolResult> => {
        try {
            console.log('[v0] Getting state for entity:', entityId)
            const state = await makeHARequest(`states/${entityId}`)
            return { success: true, data: state }
        } catch (error) {
            console.error('[v0] Failed to get entity state:', error)
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
    }

    // Call a service (like opening/closing doors)
    const callService = async (domain: string, service: string, entityId: string): Promise<HAToolResult> => {
        try {
            console.log('[v0] Calling service:', { domain, service, entityId })
            await makeHARequest(`services/${domain}/${service}`, 'POST', {
                entity_id: entityId,
            })
            return { success: true, data: { domain, service, entityId } }
        } catch (error) {
            console.error('[v0] Failed to call service:', error)
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
    }

    const findEntitiesByContext = async (context: string): Promise<HAToolResult> => {
        try {
            const entitiesResult = await getEntities()
            if (!entitiesResult.success) {
                return entitiesResult
            }

            const entities = entitiesResult.data as CategorizedEntity[]
            const areas = cacheRef.current?.areas || []

            const matchingEntities = entities.filter((entity: CategorizedEntity) =>
                matchContext(entity, context, areas)
            )

            console.log('[v0] Found entities for context:', context, matchingEntities.length)
            return { success: true, data: matchingEntities }
        } catch (error) {
            console.error('[v0] Failed to find entities by context:', error)
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
    }

    const getEntitySummary = useCallback(async (): Promise<HAToolResult> => {
        try {
            const entitiesResult = await getEntities()
            if (!entitiesResult.success) {
                return entitiesResult
            }

            const entities = entitiesResult.data as CategorizedEntity[]

            const summary = {
                total: entities.length,
                byCategory: entities.reduce(
                    (acc, entity) => {
                        acc[entity.category] = (acc[entity.category] || 0) + 1
                        return acc
                    },
                    {} as Record<string, number>
                ),
                byRoom: entities.reduce(
                    (acc, entity) => {
                        const room = entity.room || 'Unknown'
                        acc[room] = (acc[room] || 0) + 1
                        return acc
                    },
                    {} as Record<string, number>
                ),
                controllable: entities.filter((e) => e.canControl).length,
                entities: entities.map((e) => ({
                    id: e.entity_id,
                    name: e.attributes.friendly_name || e.entity_id,
                    category: e.category,
                    room: e.room,
                    state: e.state,
                    canControl: e.canControl,
                    actions: e.supportedActions,
                })),
            }

            return { success: true, data: summary }
        } catch (error) {
            console.error('[v0] Failed to get entity summary:', error)
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
        }
    }, [])

    return {
        getEntities,
        getEntityState,
        callService,
        findEntitiesByContext,
        getEntitySummary,
        isConfigured: config.url && config.hasApiKey,
        refreshCache: () => getEntities(true),
        clearCache: () => {
            cacheRef.current = null
            setEntityCache(null)
        },
    }
}
