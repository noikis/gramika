import type { ComponentProps } from 'react'
import { cn } from '../../lib/utils'
import './select.css'

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn('ui-select', className)} {...props} />
}
