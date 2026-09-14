import { NextResponse } from 'next/server'

import { requireCustomerAction } from '@/lib/auth'
import { logError } from '@/lib/errors'
import { createTaskDraftFromChat } from '@/services/ai/deepseek'
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
    .slice(-30)
}

export async function POST(request: Request) {
  try {
    await requireCustomerAction()
    const body = (await request.json()) as { messages?: unknown }
    const messages = sanitizeMessages(body.messages)

    if (!messages.some((message) => message.role === 'user')) {
      return NextResponse.json({ error: 'Describe a task before creating a request.' }, { status: 400 })
    }

    const draft = await createTaskDraftFromChat(messages)
    return NextResponse.json({ draft })
  } catch (error) {
    logError('api.ai.taskDraft', error)
    return NextResponse.json(
      { error: 'We could not build the request from this chat. Please try again.' },
      { status: 500 },
    )
  }
}
