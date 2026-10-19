import { ErrorCode } from '@gramota/contracts'

export function storageDiagnostic(error: unknown, stage: 'initialize' | 'begin' | 'finish') {
  const allowed = [
    'ERR_SQLITE_ERROR',
    'ERR_INVALID_STATE',
    'ERR_INVALID_ARG_TYPE',
    'SQLITE_BUSY',
    'SQLITE_LOCKED',
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
  const sqliteCode =
    error instanceof Error &&
    'errcode' in error &&
    typeof error.errcode === 'number' &&
    Number.isSafeInteger(error.errcode) &&
    error.errcode >= 0
      ? error.errcode
      : undefined
  return { code: ErrorCode.enum.STORAGE_ERROR, stage, driverCode: code, sqliteCode }
}
