import type { HTMLAttributes } from 'react'

export function ReadableTextSurface({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div tabIndex={0} className={`readable-text-surface ${className}`.trim()} {...props} />
}
