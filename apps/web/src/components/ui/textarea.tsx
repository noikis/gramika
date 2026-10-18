import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'block w-full resize-y rounded-2xl border border-border bg-card p-4 text-base leading-relaxed text-foreground outline-none placeholder:text-muted-foreground focus:border-primary disabled:cursor-default disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
