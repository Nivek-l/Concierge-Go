import type { AiChatMessage } from './types'

export const TOOL_CALL_FALLBACK =
  'I can help turn that into a Concierge Go verification task, but I cannot perform a live web search or confirm current availability from this chat. Please give me the exact date and any contact or location details you have, and a Go Agent can verify the information and report back.'

/**
 * Some third-party chat models occasionally print their private tool syntax as
 * ordinary text even when no tools were provided. That syntax is never useful
 * to a customer, so remove it at the application boundary.
 */
export function cleanAiChatReply(value: string): string {
  return value
    .replace(/<\|tool_call_start\|>[\s\S]*?(?:<\|tool_call_end\|>|$)/gi, '')
    .replace(/<\|tool_calls_section_begin\|>[\s\S]*?(?:<\|tool_calls_section_end\|>|$)/gi, '')
    .replace(/<tool_call>[\s\S]*?(?:<\/tool_call>|$)/gi, '')
    .replace(/\[tool_call\][\s\S]*?(?:\[\/tool_call\]|$)/gi, '')
    .replace(/^\s*(?:google|browser|web|search)\s*\([^\r\n]*\)\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function cleanAiChatHistory(history: AiChatMessage[]): AiChatMessage[] {
  return history
    .map((message) => ({
      ...message,
      content:
        message.role === 'assistant'
          ? cleanAiChatReply(message.content)
          : message.content.trim(),
    }))
    .filter((message) => message.content.length > 0)
}

