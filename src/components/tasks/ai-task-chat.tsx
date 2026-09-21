'use client'

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bot, Loader2, Send, Sparkles, UserRound } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { AiChatMessage, AiTaskDraft } from '@/services/ai/types'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'

export const AI_TASK_DRAFT_STORAGE_KEY = 'concierge-go:ai-task-draft'
const AI_CHAT_STORAGE_KEY = 'concierge-go:ai-chat'

const WELCOME: AiChatMessage = {
  role: 'assistant',
  content:
    "Hi! Tell me what you need Concierge Go to handle. You can explain it normally — I'll ask only for details we still need, then turn the chat into a request you can review.",
}

export function AiTaskChat() {
  const router = useRouter()
  const [messages, setMessages] = useState<AiChatMessage[]>([WELCOME])
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [isBuilding, setIsBuilding] = useState(false)
  const [draft, setDraft] = useState<AiTaskDraft | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  const hasCustomerMessage = useMemo(
    () => messages.some((message) => message.role === 'user'),
    [messages],
  )

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(AI_CHAT_STORAGE_KEY)
      if (!stored) return
      const parsed = JSON.parse(stored) as AiChatMessage[]
      if (Array.isArray(parsed) && parsed.some((message) => message.role === 'user')) {
        setMessages(parsed.slice(-30))
      }
    } catch {
      sessionStorage.removeItem(AI_CHAT_STORAGE_KEY)
    }
  }, [])

  useEffect(() => {
    if (messages.some((message) => message.role === 'user')) {
      sessionStorage.setItem(AI_CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-30)))
    }
  }, [messages])

  async function sendMessage(event: FormEvent) {
    event.preventDefault()
    const content = input.trim()
    if (!content || isSending) return

    const nextMessages: AiChatMessage[] = [...messages, { role: 'user', content }]
    setMessages(nextMessages)
    setInput('')
    setDraft(null)
    setIsSending(true)

    requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }))

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })
      const body = (await response.json()) as { reply?: string; error?: string }
      if (!response.ok || !body.reply) throw new Error(body.error || 'AI response failed.')

      setMessages((current) => [...current, { role: 'assistant', content: body.reply! }])
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The AI assistant could not reply.')
    } finally {
      setIsSending(false)
    }
  }

  async function buildRequest() {
    if (!hasCustomerMessage || isBuilding) return
    setIsBuilding(true)

    try {
      const response = await fetch('/api/ai/task-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })
      const body = (await response.json()) as { draft?: AiTaskDraft; error?: string }
      if (!response.ok || !body.draft) throw new Error(body.error || 'Could not build the request.')
      setDraft(body.draft)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'We could not prepare the request.')
    } finally {
      setIsBuilding(false)
    }
  }

  function continueToForm() {
    if (!draft) return
    sessionStorage.setItem(AI_TASK_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    router.push('/tasks/new?source=ai')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
      <Card className="overflow-hidden">
        <CardHeader className="border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-subtle text-primary">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <CardTitle>Go Assistant</CardTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Chat naturally. You will review everything before submitting.
              </p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="h-[52vh] min-h-[380px] space-y-4 overflow-y-auto p-4 sm:p-5">
            {messages.map((message, index) => {
              const assistant = message.role === 'assistant'
              return (
                <div
                  key={`${message.role}-${index}`}
                  className={`flex gap-2.5 ${assistant ? 'justify-start' : 'justify-end'}`}
                >
                  {assistant ? (
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-primary">
                      <Bot className="h-4 w-4" aria-hidden />
                    </span>
                  ) : null}
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      assistant
                        ? 'rounded-tl-md bg-muted text-foreground'
                        : 'whitespace-pre-wrap rounded-tr-md bg-primary text-primary-foreground'
                    }`}
                  >
                    {assistant ? <AssistantMarkdown content={message.content} /> : message.content}
                  </div>
                  {!assistant ? (
                    <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <UserRound className="h-4 w-4" aria-hidden />
                    </span>
                  ) : null}
                </div>
              )
            })}

            {isSending ? (
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-subtle text-primary">
                  <Bot className="h-4 w-4" aria-hidden />
                </span>
                <span className="flex items-center gap-2 rounded-2xl rounded-tl-md bg-muted px-4 py-2.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  Thinking…
                </span>
              </div>
            ) : null}
            <div ref={endRef} />
          </div>

          <form onSubmit={sendMessage} className="border-t p-3 sm:p-4">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    event.currentTarget.form?.requestSubmit()
                  }
                }}
                rows={2}
                maxLength={5000}
                placeholder="e.g. I need someone to collect my transcript from UNICAL tomorrow and bring it to Marian…"
                className="min-h-[52px] resize-none"
                disabled={isSending}
              />
              <Button type="submit" size="icon" className="h-[52px] w-[52px] shrink-0" disabled={!input.trim() || isSending}>
                {isSending ? <Loader2 className="animate-spin" aria-hidden /> : <Send aria-hidden />}
                <span className="sr-only">Send message</span>
              </Button>
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              AI can misunderstand details. Check the generated request before submitting it.
            </p>
          </form>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Turn chat into a request</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              When you have explained the task, the assistant can summarize the conversation and fill the regular request form for you.
            </p>
            <Button className="w-full" onClick={buildRequest} loading={isBuilding} disabled={!hasCustomerMessage}>
              <Sparkles aria-hidden />
              Build request from chat
            </Button>
          </CardContent>
        </Card>

        {draft ? (
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="text-base">Request preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="font-semibold">{draft.title || 'Untitled request'}</p>
                <p className="mt-1 text-sm text-muted-foreground">{draft.summary || draft.description}</p>
              </div>

              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-xs">
                <dt className="text-muted-foreground">Category</dt>
                <dd className="font-medium">{draft.categorySlug}</dd>
                <dt className="text-muted-foreground">Urgency</dt>
                <dd className="font-medium capitalize">{draft.urgency}</dd>
                <dt className="text-muted-foreground">Location</dt>
                <dd className="font-medium">{draft.locationAddress || 'Still needed'}</dd>
              </dl>

              {draft.missingFields.length > 0 ? (
                <div className="rounded-lg border border-warning/30 bg-warning-subtle/40 p-3">
                  <p className="text-xs font-semibold">Still worth confirming</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {draft.missingFields.join(' · ')}
                  </p>
                </div>
              ) : null}

              <Button className="w-full" onClick={continueToForm}>
                Review & continue
              </Button>
              <p className="text-[11px] text-muted-foreground">
                Nothing is submitted yet. The next screen is the normal request form with these details pre-filled.
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  )
}

function AssistantMarkdown({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        ul: ({ children }) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
        ol: ({ children }) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
        li: ({ children }) => <li>{children}</li>,
        code: ({ children }) => (
          <code className="rounded bg-background/70 px-1 py-0.5 font-mono text-[0.85em]">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="my-2 overflow-x-auto rounded-lg bg-background/70 p-3 text-xs">
            {children}
          </pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground">
            {children}
          </blockquote>
        ),
        a: ({ children, href }) => (
          <a href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-2">
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  )
}
