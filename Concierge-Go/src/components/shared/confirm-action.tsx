'use client'

import { useState, useTransition } from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button, type ButtonProps } from '@/components/ui/button'
import { toast } from '@/components/ui/sonner'
import type { ActionResult } from '@/types/domain'

/**
 * Confirmation dialog wired straight to a server action. Used everywhere a
 * destructive or hard-to-undo action needs an explicit "are you sure".
 */
export function ConfirmAction({
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = true,
  trigger,
  onConfirm,
  onSuccess,
}: {
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
  trigger: React.ReactNode
  onConfirm: () => Promise<ActionResult<unknown>>
  onSuccess?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleConfirm() {
    startTransition(async () => {
      const result = await onConfirm()
      if (result.ok) {
        toast.success(result.message ?? 'Done.')
        setOpen(false)
        onSuccess?.()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            disabled={isPending}
            onClick={(event) => {
              event.preventDefault()
              handleConfirm()
            }}
            className={
              destructive
                ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                : undefined
            }
          >
            {isPending ? 'Working…' : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** A plain button wired to a no-argument server action, with a loading state and a toast. */
export function ActionButton({
  action,
  onSuccess,
  children,
  ...props
}: ButtonProps & {
  action: () => Promise<ActionResult<unknown>>
  onSuccess?: () => void
}) {
  const [isPending, startTransition] = useTransition()

  return (
    <Button
      {...props}
      loading={isPending}
      onClick={(event) => {
        props.onClick?.(event)
        startTransition(async () => {
          const result = await action()
          if (result.ok) {
            if (result.message) toast.success(result.message)
            onSuccess?.()
          } else {
            toast.error(result.error)
          }
        })
      }}
    >
      {children}
    </Button>
  )
}
