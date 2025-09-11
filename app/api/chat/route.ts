import { generateText, tool } from 'ai'
import { gateway } from '@ai-sdk/gateway'
import { openai } from '@ai-sdk/openai'
import { type NextRequest } from 'next/server'
import { z } from 'zod'

const SYSTEM_PROMPT = `You are a helpful Home Assistant voice assistant. You help users control their smart home devices, particularly doors, locks, lights, and covers.

Your capabilities:
1. Check device status (open/closed, on/off, locked/unlocked)
2. Control devices with proper confirmation for state changes
3. Understand room contexts and device types
4. Find devices by location or name

IMPORTANT RULES:
- For status checks, use tools to get real information
- For state changes that could affect security or safety (doors, locks, garage), ALWAYS ask for confirmation using request_confirmation tool
- Be conversational and helpful
- If multiple devices match a request, show options or ask for clarification
- Use friendly, natural language responses

Workflow for control commands:
1. First find the relevant devices using find_entities_by_context or get_entities
2. If it's a status check, get the current state and report it
3. If it's a control action, use request_confirmation tool to get user approval
4. Only after confirmation, use call_service to execute the action

Always be helpful and explain what you're doing.`

// Define tools that will be executed on the client side
const homeAssistantTools = {
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
}

export async function POST(request: NextRequest) {
    try {
        const { messages } = await request.json()

        console.log('Chat request received with', messages?.length, 'messages')

        const result = await generateText({
            model: openai('gpt-5-mini'),
            system: SYSTEM_PROMPT,
            messages,
            tools: homeAssistantTools,
            temperature: 0.6,
        })

        console.log('AI response:', JSON.stringify(result))

        // Return both the text and tool calls for client-side processing
        return new Response(
            JSON.stringify({
                content: result.text,
                toolCalls:
                    result.toolCalls?.map((call) => ({
                        name: call.toolName,
                        input: call.input,
                    })) || [],
            }),
            {
                headers: { 'Content-Type': 'application/json' },
            }
        )
    } catch (error) {
        console.error('Chat API error:', error)
        return new Response(
            JSON.stringify({
                error: 'Error processing chat request',
                content: 'Sorry, I encountered an error processing your request. Please try again.',
            }),
            {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
            }
        )
    }
}
