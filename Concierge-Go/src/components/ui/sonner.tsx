'use client'

import { Toaster as Sonner, toast } from 'sonner'

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Toast host. Mounted once in the root layout; feedback for every server
 * action flows through `toast()`.
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      position="top-center"
      closeButton
      richColors={false}
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lift group-[.toaster]:rounded-xl',
          description: 'group-[.toast]:text-muted-foreground',
          actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
          cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          error: 'group-[.toaster]:border-destructive/30',
          success: 'group-[.toaster]:border-success/30',
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
