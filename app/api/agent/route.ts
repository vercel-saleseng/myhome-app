import { generateText, tool } from "ai"
import { openai } from "@ai-sdk/openai"
import { type NextRequest, NextResponse } from "next/server"
import { z } from "zod"

export interface AgentRequest {
  transcript: string
  userId: string
  toolResults?: Record<string, any>
}

export interface AgentResponse {
  type: "success" | "error" | "info" | "confirmation_needed" | "tool_call_needed"
  message: string
  action?: string
  confirmationData?: {
    action: string
    entity: string
    newState: string
    domain: string
    service: string
    entityId: string
  }
  toolCalls?: Array<{
    name: string
    parameters: Record<string, any>
  }>
}

const SYSTEM_PROMPT = `You are a helpful Home Assistant voice assistant. You help users control their smart home devices, particularly doors and locks.

Your capabilities:
1. Check door/lock status (open/closed, locked/unlocked)
2. Open/close doors and locks (with user confirmation)
3. Understand room contexts (garage, front door, back door, living room, etc.)

IMPORTANT RULES:
- For status checks (like "is the garage door open?"), use tools to get real information
- For state changes (like "open the garage door"), you MUST ask for confirmation first
- Never perform state-changing actions (like opening/closing doors, lights, etc) without explicit user confirmation
- Be conversational and helpful
- If you don't understand a request, ask for clarification

Available tools:
- get_entities: Get all door/cover entities
- get_entity_state: Get current state of a specific entity
- find_entities_by_context: Find entities by room/location (e.g., "garage", "front")
- call_service: Control an entity (only use after confirmation)

When you need to use tools, respond with type "tool_call_needed" and include the tool calls.

CRITICAL: When asking for confirmation for state changes, you MUST:
1. Use type "confirmation_needed"
2. Include confirmationData with ALL required fields:
   - action: human-readable action (e.g., "open garage door")
   - entity: human-readable entity name (e.g., "garage door")
   - newState: desired state (e.g., "open", "closed")
   - domain: Home Assistant domain (e.g., "cover", "lock")
   - service: Home Assistant service (e.g., "open_cover", "close_cover")
   - entityId: exact entity ID (e.g., "cover.garage_door")

Example confirmation response:
{
  "type": "confirmation_needed",
  "message": "Are you sure you want to open the garage door? Say yes to confirm or no to cancel.",
  "confirmationData": {
    "action": "open garage door",
    "entity": "garage door", 
    "newState": "open",
    "domain": "cover",
    "service": "open_cover",
    "entityId": "cover.garage_door"
  }
}`

// Define tools that will be called on the client side
const homeAssistantTools = {
  get_entities: tool({
    description: "Get all door and cover entities from Home Assistant",
    parameters: z.object({}),
  }),

  get_entity_state: tool({
    description: "Get the current state of a specific Home Assistant entity",
    parameters: z.object({
      entityId: z.string().describe("The entity ID to check (e.g., cover.garage_door)"),
    }),
  }),

  find_entities_by_context: tool({
    description: "Find entities by room or location context",
    parameters: z.object({
      context: z.string().describe("The room or location context (e.g., garage, front, back)"),
    }),
  }),

  call_service: tool({
    description: "Call a Home Assistant service to control an entity (only use after user confirmation)",
    parameters: z.object({
      domain: z.string().describe("The domain (e.g., cover, lock)"),
      service: z.string().describe("The service (e.g., open_cover, close_cover, lock, unlock)"),
      entityId: z.string().describe("The entity ID to control"),
    }),
  }),
}

export async function POST(request: NextRequest) {
  try {
    const { transcript, userId, toolResults }: AgentRequest = await request.json()

    if (!transcript?.trim()) {
      return NextResponse.json({
        type: "error",
        message: "No transcript provided",
      } as AgentResponse)
    }

    console.log("[v0] Processing agent request:", { transcript, userId, hasToolResults: !!toolResults })

    let prompt = `User said: "${transcript}"`

    if (toolResults) {
      prompt = `Previous tool results: ${JSON.stringify(toolResults)}
                
                User originally said: "${transcript}"
                
                Based on the tool results, provide a response. If this involves changing device state (opening, closing, locking, unlocking), ask for confirmation with proper confirmationData.`
    }

    const { text, toolCalls } = await generateText({
      model: openai("gpt-4o-mini"),
      system: SYSTEM_PROMPT,
      prompt,
      tools: homeAssistantTools,
      maxToolRoundtrips: 0, // We'll handle tool calls manually on the client
    })

    console.log("AI response:", { text, toolCalls: toolCalls?.length || 0 })

    // If the AI wants to use tools, return them for client-side execution
    if (toolCalls && toolCalls.length > 0) {
      return NextResponse.json({
        type: "tool_call_needed",
        message: "Processing your request...",
        action: "tool_execution",
        toolCalls: toolCalls.map((call) => ({
          name: call.toolName,
          parameters: call.args,
        })),
      } as AgentResponse)
    }

    const lowerText = text.toLowerCase()
    if (lowerText.includes("are you sure") || lowerText.includes("confirm") || lowerText.includes("say yes")) {
      // Try to extract confirmation data from the response
      // This is a fallback - ideally the AI should provide structured confirmationData
      let confirmationData = undefined

      // Look for patterns in the text to extract action details
      if (lowerText.includes("open") && lowerText.includes("garage")) {
        confirmationData = {
          action: "open garage door",
          entity: "garage door",
          newState: "open",
          domain: "cover",
          service: "open_cover",
          entityId: "cover.garage_door", // This should come from tool results
        }
      }

      return NextResponse.json({
        type: "confirmation_needed",
        message: text,
        action: "pending_confirmation",
        confirmationData,
      } as AgentResponse)
    }

    return NextResponse.json({
      type: "success",
      message: text,
      action: "ai_response",
    } as AgentResponse)
  } catch (error) {
    console.error("[v0] Agent API error:", error)
    return NextResponse.json(
      {
        type: "error",
        message: "Sorry, I encountered an error processing your request. Please try again.",
        action: "error",
      } as AgentResponse,
      { status: 500 },
    )
  }
}
