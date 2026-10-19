import { HTTP_STATUS } from '../http-status'
import type { FastifyInstance, FastifyReply } from 'fastify'
import { CorrectionFailure, ERROR_MESSAGES, ErrorCode } from '@gramota/contracts'
import type { Attempt } from '../correction'

const statusCodes: Record<ErrorCode, number> = {
  [ErrorCode.enum.INVALID_INPUT]: HTTP_STATUS.BAD_REQUEST,
  [ErrorCode.enum.PAYLOAD_TOO_LARGE]: HTTP_STATUS.PAYLOAD_TOO_LARGE,
  [ErrorCode.enum.NOT_CONFIGURED]: HTTP_STATUS.SERVICE_UNAVAILABLE,
  [ErrorCode.enum.STORAGE_ERROR]: HTTP_STATUS.SERVICE_UNAVAILABLE,
  [ErrorCode.enum.UPSTREAM_ERROR]: HTTP_STATUS.BAD_GATEWAY,
  [ErrorCode.enum.INVALID_RESPONSE]: HTTP_STATUS.BAD_GATEWAY,
  [ErrorCode.enum.REASONING_NOT_DISABLED]: HTTP_STATUS.BAD_GATEWAY,
  [ErrorCode.enum.TIMEOUT]: HTTP_STATUS.GATEWAY_TIMEOUT,
}

export function sendCorrectionFailure(
  reply: FastifyReply,
  code: ErrorCode,
  ids: Attempt | null = null,
) {
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
    if (code === ErrorCode.enum.UPSTREAM_ERROR)
      api.log.error({ code }, 'Unexpected correction error')

    return sendCorrectionFailure(reply, code)
  })
}
