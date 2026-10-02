'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'

import { sendMessageAction } from '@/actions/tasks'
import { formatRelative, initials } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from '@/components/ui/sonner'
import type { TaskMessageRow } from '@/types/database'

export interface MessageSender {
  full_name: string
  avatar_url: string | null
}

export function MessageThread({
  taskId,
  messages,
  senders,
  currentUserId,
  canSend,
  allowInternal = false,
  emptyLabel = 'No messages yet. Say hello, or ask a question about your task.',
}: {
  taskId: string
  messages: TaskMessageRow[]
  senders: Map<string, MessageSender>
  currentUserId: string
  canSend: boolean
  allowInternal?: boolean
  emptyLabel?: string
}) {
  const router = useRouter()
  const [body, setBody] = useState('')
  const [internal, setInternal] = useState(false)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(formData: FormData) {
    if (!body.trim()) return
    startTransition(async () => {
      const result = await sendMessageAction(formData)
      if (result.ok) {
        setBody('')
        setInternal(false)
        formRef.current?.reset()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      ) : (
        <ul className="space-y-3">
          {messages.map((message) => {
            const sender = senders.get(message.sender_id)
            const mine = message.sender_id === currentUserId
            return (
              <li
                key={message.id}
                className={cn('flex gap-2.5', mine && 'flex-row-reverse text-right')}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarImage src={sender?.avatar_url ?? undefined} alt="" />
                  <AvatarFallback className="text-[10px]">
                    {initials(sender?.full_name ?? 'CG')}
                  </AvatarFallback>
                </Avatar>
                <div className={cn('max-w-[80%]', mine && 'items-end')}>
                  <div
                    className={cn(
                      'inline-block rounded-2xl px-3.5 py-2 text-sm text-pretty',
                      message.is_internal
                        ? 'border border-dashed border-warning/40 bg-warning-subtle'
                        : mine
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted',
                    )}
                  >
                    {message.is_internal ? (
                      <Badge variant="warning" className="mb-1">
                        Internal note
                      </Badge>
                    ) : null}
                    <p>{message.body}</p>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {sender?.full_name ?? 'Concierge Go'} · {formatRelative(message.created_at)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {canSend ? (
        <form ref={formRef} action={handleSubmit} className="flex items-end gap-2 border-t pt-3">
          <input type="hidden" name="taskId" value={taskId} />
          {allowInternal ? <input type="hidden" name="isInternal" value={internal ? 'on' : ''} /> : null}
          <Textarea
            name="body"
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={internal ? 'Internal note (not visible to the customer)' : 'Write a message…'}
            rows={2}
            className="flex-1 resize-none"
          />
          <div className="flex flex-col gap-2">
            {allowInternal ? (
              <Button
                type="button"
                size="sm"
                variant={internal ? 'default' : 'outline'}
                onClick={() => setInternal((v) => !v)}
              >
                Internal
              </Button>
            ) : null}
            <Button type="submit" size="icon" loading={isPending} aria-label="Send message">
              <Send aria-hidden />
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  )
}
