import { HTTP_STATUS, type HttpStatus } from '../http-status'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { CorrectionFailure, ERROR_MESSAGES, ErrorCode } from '@gramota/contracts'
import type { Attempt } from '../correction'
import { databaseDiagnostic } from '../database'
import { LogOperation } from '../logging'

const statusCodes: Record<ErrorCode, HttpStatus> = {
  [ErrorCode.enum.INVALID_INPUT]: HTTP_STATUS.BAD_REQUEST,
  [ErrorCode.enum.PAYLOAD_TOO_LARGE]: HTTP_STATUS.PAYLOAD_TOO_LARGE,
  [ErrorCode.enum.NOT_CONFIGURED]: HTTP_STATUS.SERVICE_UNAVAILABLE,
  [ErrorCode.enum.STORAGE_ERROR]: HTTP_STATUS.SERVICE_UNAVAILABLE,
  [ErrorCode.enum.UPSTREAM_ERROR]: HTTP_STATUS.BAD_GATEWAY,
  [ErrorCode.enum.INVALID_RESPONSE]: HTTP_STATUS.BAD_GATEWAY,
  [ErrorCode.enum.REASONING_NOT_DISABLED]: HTTP_STATUS.BAD_GATEWAY,
  [ErrorCode.enum.TIMEOUT]: HTTP_STATUS.GATEWAY_TIMEOUT,
}

export function createCorrectionStorageFailureLogger(request: FastifyRequest) {
  return (error: unknown, stage: Parameters<typeof databaseDiagnostic>[1]) => {
    request.log.error(
      {
        req: request,
        err: error,
        operation: LogOperation.enum['correction-storage'],
        ...databaseDiagnostic(error, stage),
      },
      'Correction repository operation failed',
    )
  }
}

export function sendCorrectionFailure(
  reply: FastifyReply,
  code: ErrorCode,
  ids: Attempt | null = null,
  error?: unknown,
) {
  if (statusCodes[code] >= HTTP_STATUS.INTERNAL_SERVER_ERROR)
    reply.request.log.error(
      {
        req: reply.request,
        err: error,
        code,
        operation: LogOperation.enum['correction-api'],
        attemptId: ids?.requestId,
        durationMs: reply.elapsedTime,
      },
      'Request failed',
    )

  return reply.code(statusCodes[code]).send(
    CorrectionFailure.parse({
      error: { code, message: ERROR_MESSAGES[code] },
      correctionId: ids?.correctionId ?? null,
      requestId: ids?.requestId ?? null,
    }),
  )
}

export function setCorrectionErrorHandler(api: FastifyInstance) {
  api.setErrorHandler((error, _request, reply) => {
    const errorCode = error instanceof Error && 'code' in error ? error.code : undefined
    const statusCode =
      error instanceof Error && 'statusCode' in error ? error.statusCode : undefined
    const code: ErrorCode =
      errorCode === 'FST_ERR_CTP_BODY_TOO_LARGE'
        ? ErrorCode.enum.PAYLOAD_TOO_LARGE
        : statusCode === HTTP_STATUS.BAD_REQUEST ||
            statusCode === HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE
          ? ErrorCode.enum.INVALID_INPUT
          : ErrorCode.enum.UPSTREAM_ERROR
    return sendCorrectionFailure(reply, code, null, error)
  })
}
