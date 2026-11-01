import type { FastifyInstance } from 'fastify'
import {
  DictionaryErrorCode,
  DictionaryFailure,
  DictionaryInput,
  DictionaryResponse,
  DictionaryDetailsInput,
  DictionaryDetailsResponse,
} from '@gramota/contracts'
import {
  createDictionaryService,
  createDictionaryDetailsService,
  DictionaryError,
} from '../dictionary'
import { HTTP_STATUS, type HttpStatus } from '../http-status'

const ERROR_STATUS: Record<DictionaryErrorCode, HttpStatus> = {
  [DictionaryErrorCode.enum.INVALID_INPUT]: HTTP_STATUS.BAD_REQUEST,
  [DictionaryErrorCode.enum.DICTIONARY_UNAVAILABLE]: HTTP_STATUS.SERVICE_UNAVAILABLE,
  [DictionaryErrorCode.enum.DICTIONARY_TIMEOUT]: HTTP_STATUS.GATEWAY_TIMEOUT,
  [DictionaryErrorCode.enum.DICTIONARY_FAILED]: HTTP_STATUS.BAD_GATEWAY,
}

export async function dictionaryRoutes(
  app: FastifyInstance,
  lookup: ReturnType<typeof createDictionaryService>,
  details?: ReturnType<typeof createDictionaryDetailsService>,
) {
  app.post('/api/dictionary/lookup', async (request, reply) => {
    reply.header('Cache-Control', 'no-store')
    const parsed = DictionaryInput.safeParse(request.body)
    if (!parsed.success)
      return reply
        .code(HTTP_STATUS.BAD_REQUEST)
        .send(DictionaryFailure.parse({ error: { code: DictionaryErrorCode.enum.INVALID_INPUT } }))
    try {
      return DictionaryResponse.parse(await lookup(parsed.data.word))
    } catch (error) {
      if (!(error instanceof DictionaryError)) throw error
      return reply
        .code(ERROR_STATUS[error.code])
        .send(DictionaryFailure.parse({ error: { code: error.code } }))
    }
  })
  if (details)
    app.post('/api/dictionary/details', async (request, reply) => {
      reply.header('Cache-Control', 'no-store')
      const parsed = DictionaryDetailsInput.safeParse(request.body)
      if (!parsed.success)
        return reply
          .code(HTTP_STATUS.BAD_REQUEST)
          .send(
            DictionaryFailure.parse({ error: { code: DictionaryErrorCode.enum.INVALID_INPUT } }),
          )
      try {
        return DictionaryDetailsResponse.parse(await details(parsed.data.word))
      } catch (error) {
        if (!(error instanceof DictionaryError)) throw error
        return reply
          .code(ERROR_STATUS[error.code])
          .send(DictionaryFailure.parse({ error: { code: error.code } }))
      }
    })
}
