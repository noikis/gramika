import type { ComponentProps } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex min-h-12 shrink-0 items-center justify-center rounded-lg px-4 py-2 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-default disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground enabled:hover:brightness-110',
        secondary: 'border border-border bg-secondary text-foreground enabled:hover:border-primary',
        ghost:
          'bg-transparent text-muted-foreground enabled:hover:bg-secondary enabled:hover:text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
)

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({ className, variant, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button'
  return <Component className={cn(buttonVariants({ variant }), className)} {...props} />
}
