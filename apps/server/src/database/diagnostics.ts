import { ErrorCode } from '@gramota/contracts'
import { DrizzleQueryError } from 'drizzle-orm'

export function databaseDiagnostic(error: unknown, stage: 'initialize' | 'begin' | 'finish') {
  if (error instanceof DrizzleQueryError) error = error.cause

  const allowed = [
    'SQLITE_BUSY',
    'SQLITE_LOCKED',
    'SQLITE_ERROR',
    'SQLITE_CANTOPEN',
    'SQLITE_READONLY',
    'SQLITE_FULL',
    'SQLITE_IOERR',
    'SQLITE_CORRUPT',
    'SQLITE_NOTADB',
    'SQLITE_CONSTRAINT_CHECK',
    'SQLITE_CONSTRAINT_FOREIGNKEY',
    'SQLITE_CONSTRAINT_PRIMARYKEY',
    'SQLITE_CONSTRAINT_NOTNULL',
    'SQLITE_CONSTRAINT_TRIGGER',
    'EACCES',
    'EPERM',
    'ENOENT',
    'ATTEMPT_NOT_PENDING',
  ]

  const code =
    error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string' &&
    allowed.includes(error.code)
      ? error.code
      : 'UNKNOWN_STORAGE_ERROR'

  return { code: ErrorCode.enum.STORAGE_ERROR, stage, driverCode: code }
}
