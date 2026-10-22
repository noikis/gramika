import type { FastifyInstance } from 'fastify'
import {
  ExplanationFailure,
  ExplanationMetrics,
  ExplanationInput,
  ExplanationLookup,
  ExplanationSuccess,
  EXPLANATION_ERROR_MESSAGES,
  ErrorCode,
} from '@gramota/contracts'
import { CorrectionError } from '../correction'
import type { createExplanationService } from '../explanation'
import { HTTP_STATUS } from '../http-status'

const MAX_EXPLANATION_BODY_BYTES = 4096
const statuses = {
  INVALID_INPUT: HTTP_STATUS.BAD_REQUEST,
  PAYLOAD_TOO_LARGE: HTTP_STATUS.PAYLOAD_TOO_LARGE,
  NOT_CONFIGURED: HTTP_STATUS.SERVICE_UNAVAILABLE,
  STORAGE_ERROR: HTTP_STATUS.SERVICE_UNAVAILABLE,
  UPSTREAM_ERROR: HTTP_STATUS.BAD_GATEWAY,
  INVALID_RESPONSE: HTTP_STATUS.BAD_GATEWAY,
  REASONING_NOT_DISABLED: HTTP_STATUS.BAD_GATEWAY,
  TIMEOUT: HTTP_STATUS.GATEWAY_TIMEOUT,
}

export async function explanationRoutes(
  app: FastifyInstance,
  service: ReturnType<typeof createExplanationService>,
) {
  app.register(async (api) => {
    api.setErrorHandler((error, _request, reply) => {
      const errorCode = error instanceof Error && 'code' in error ? error.code : undefined
      const statusCode =
        error instanceof Error && 'statusCode' in error ? error.statusCode : undefined
      const code =
        errorCode === 'FST_ERR_CTP_BODY_TOO_LARGE'
          ? ErrorCode.enum.PAYLOAD_TOO_LARGE
          : error instanceof CorrectionError
            ? error.code
            : statusCode === HTTP_STATUS.BAD_REQUEST ||
                statusCode === HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE
              ? ErrorCode.enum.INVALID_INPUT
              : null
      if (!code) throw error
      return reply.code(statuses[code]).send(
        ExplanationFailure.parse({
          error: { code, message: EXPLANATION_ERROR_MESSAGES[code] },
        }),
      )
    })
    api.post('/api/explanations/metrics', async (request) =>
      ExplanationMetrics.parse(service.metrics(request.body)),
    )
    for (const isLookup of [true, false]) {
      api.post(
        isLookup ? '/api/explanations/lookup' : '/api/explanations',
        { bodyLimit: MAX_EXPLANATION_BODY_BYTES },
        async (request) => {
          const parsed = ExplanationInput.safeParse(request.body)
          if (!parsed.success) throw new CorrectionError(ErrorCode.enum.INVALID_INPUT)
          return isLookup
            ? ExplanationLookup.parse(service.lookup(parsed.data))
            : ExplanationSuccess.parse(await service.explain(parsed.data))
        },
      )
    }
  })
}
