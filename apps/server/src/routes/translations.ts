import type { FastifyInstance } from 'fastify'
import {
  TranslationFailure,
  TranslationInput,
  TranslationSuccess,
  TRANSLATION_ERROR_MESSAGES,
} from '@gramota/contracts'
import { createTranslationService, TranslationError } from '../translation'

export async function translationRoutes(
  app: FastifyInstance,
  translate: ReturnType<typeof createTranslationService>,
) {
  app.post('/api/translations', async (request, reply) => {
    const parsed = TranslationInput.safeParse(request.body)
    if (!parsed.success)
      return reply.code(400).send(
        TranslationFailure.parse({
          error: { code: 'INVALID_INPUT', message: TRANSLATION_ERROR_MESSAGES.INVALID_INPUT },
        }),
      )
    try {
      return TranslationSuccess.parse(
        await translate(parsed.data.text, parsed.data.target, parsed.data.scope),
      )
    } catch (error) {
      if (!(error instanceof TranslationError)) throw error
      const status =
        error.code === 'INVALID_INPUT' ? 400 : error.code === 'NOT_CONFIGURED' ? 503 : 502
      return reply.code(status).send(
        TranslationFailure.parse({
          error: { code: error.code, message: TRANSLATION_ERROR_MESSAGES[error.code] },
        }),
      )
    }
  })
}
