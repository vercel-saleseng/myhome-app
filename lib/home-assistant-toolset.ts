
import { tool, ToolSet } from "ai"
import { z } from 'zod'

// Define the toolset
// Tools without an "execute" property are executed on the client-side
const HomeAssistantToolset = {
    get_entities: tool({
        description: 'Get all controllable entities from Home Assistant (doors, covers, locks, etc.)',
        inputSchema: z.object({}),
    }),

    get_entity_state: tool({
        description: 'Get the current state of a specific Home Assistant entity',
        inputSchema: z.object({
            entityId: z.string().describe('The entity ID to check (e.g., cover.garage_door)'),
        }),
    }),

    find_entities_by_context: tool({
        description: 'Find entities by room, location, or device name context',
        inputSchema: z.object({
            context: z.string().describe('The search context (e.g., "garage", "front door", "living room")'),
        }),
    }),

    request_confirmation: tool({
        description: 'Request user confirmation before performing a potentially dangerous action',
        inputSchema: z.object({
            action: z.string().describe('Human-readable action description (e.g., "open the garage door")'),
            entity: z.string().describe('Entity friendly name (e.g., "garage door")'),
            entityId: z.string().describe('The entity ID to control'),
            domain: z.string().describe('Home Assistant domain (e.g., "cover", "lock")'),
            service: z.string().describe('Home Assistant service (e.g., "open_cover", "lock")'),
            message: z.string().describe('Confirmation message to show the user'),
        }),
    }),

    call_service: tool({
        description: 'Call a Home Assistant service to control an entity (only use after confirmed by user)',
        inputSchema: z.object({
            domain: z.string().describe('The domain (e.g., cover, lock, switch)'),
            service: z
                .string()
                .describe('The service (e.g., open_cover, close_cover, lock, unlock, turn_on, turn_off)'),
            entityId: z.string().describe('The entity ID to control'),
        }),
    }),
} as ToolSet

export default HomeAssistantToolset
