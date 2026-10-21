import { z } from 'zod'

export const LogOperation = z.enum([
  'response',
  'handler',
  'response-stream',
  'response-headers',
  'response-serialization',
  'correction-storage',
  'correction-api',
  'history-read',
  'history-delete',
  'database-initialize',
])
export type LogOperation = z.infer<typeof LogOperation>

export const LogLevel = z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
export type LogLevel = z.infer<typeof LogLevel>
