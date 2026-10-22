import type { FastifyInstance } from 'fastify'
import { ErrorCode, CorrectionInput, CorrectionSuccess } from '@gramota/contracts'
import { AttemptError, type createCorrectionService } from '../correction'
import {
  createCorrectionStorageFailureLogger,
  sendCorrectionFailure,
  setCorrectionErrorHandler,
} from './correction-errors'

const MAX_CORRECTION_BODY_BYTES = 128 * 1024

export async function correctionRoutes(
  app: FastifyInstance,
  correct: ReturnType<typeof createCorrectionService>,
) {
  app.register(async (api) => {
    setCorrectionErrorHandler(api)

    api.post(
      '/api/corrections',
      { bodyLimit: MAX_CORRECTION_BODY_BYTES },
      async (request, reply) => {
        const parsed = CorrectionInput.safeParse(request.body)

        try {
          if (!parsed.success) throw new AttemptError(ErrorCode.enum.INVALID_INPUT, null)

          return CorrectionSuccess.parse(
            await correct(
              parsed.data.text,
              parsed.data.modelId,
              parsed.data.correctionId,
              createCorrectionStorageFailureLogger(request),
              parsed.data.mode,
              parsed.data.forceRefresh,
            ),
          )
        } catch (error) {
          if (!(error instanceof AttemptError)) throw error
          return sendCorrectionFailure(reply, error.code, error.ids, error)
        }
      },
    )
  })
}
