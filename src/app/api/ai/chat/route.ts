import { NextResponse } from 'next/server'

import { requireCustomerAction } from '@/lib/auth'
import { logError } from '@/lib/errors'
import { chatWithOpenRouter } from '@/services/ai/openrouter'
import { cleanAiChatReply, TOOL_CALL_FALLBACK } from '@/services/ai/sanitize'
import type { AiChatMessage } from '@/services/ai/types'

export const runtime = 'nodejs'

function sanitizeMessages(value: unknown): AiChatMessage[] {
  if (!Array.isArray(value)) return []
  return value
    .filter(
      (item): item is { role: 'user' | 'assistant'; content: string } =>
        Boolean(
          item &&
            typeof item === 'object' &&
            ((item as { role?: unknown }).role === 'user' ||
              (item as { role?: unknown }).role === 'assistant') &&
            typeof (item as { content?: unknown }).content === 'string',
        ),
    )
    .map((item) => ({ role: item.role, content: item.content.trim().slice(0, 5000) }))
    .filter((item) => item.content.length > 0)
    .slice(-24)
}

export async function POST(request: Request) {
  try {
    await requireCustomerAction()
    const body = (await request.json()) as { messages?: unknown }
    const messages = sanitizeMessages(body.messages)

    if (!messages.length || messages[messages.length - 1]?.role !== 'user') {
      return NextResponse.json({ error: 'Send a message to continue.' }, { status: 400 })
    }

    const reply = cleanAiChatReply(await chatWithOpenRouter(messages)) || TOOL_CALL_FALLBACK
    return NextResponse.json({ reply })
  } catch (error) {
    logError('api.ai.chat', error)
    return NextResponse.json(
      { error: 'The AI assistant is unavailable right now. Please try again or use the regular request form.' },
      { status: 500 },
    )
  }
}
