import { HTTP_STATUS } from '../http-status'
import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { HistoryErrorCode, HistoryFailure, HistorySearchQuery } from '@gramota/contracts'
import type { HistoryStore } from '../storage'

export async function historyRoutes(app: FastifyInstance, historyStore: HistoryStore | null) {
  const unavailable = () =>
    HistoryFailure.parse({
      error: {
        code: HistoryErrorCode.enum.HISTORY_UNAVAILABLE,
        message: 'Could not load history. Please try again later.',
      },
    })

  app.register(async (history) => {
    const invalidQuery = () =>
      HistoryFailure.parse({
        error: {
          code: HistoryErrorCode.enum.INVALID_HISTORY_QUERY,
          message: 'The history search criteria are invalid.',
        },
      })

    history.setErrorHandler((_error, _request, reply) => {
      if (
        typeof _error === 'object' &&
        _error !== null &&
        'statusCode' in _error &&
        (_error.statusCode === HTTP_STATUS.BAD_REQUEST ||
          _error.statusCode === HTTP_STATUS.PAYLOAD_TOO_LARGE ||
          _error.statusCode === HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE)
      ) {
        return reply.code(_error.statusCode).send(invalidQuery())
      }

      history.log.error({ code: HistoryErrorCode.enum.HISTORY_UNAVAILABLE }, 'History read failed')
      reply.code(HTTP_STATUS.SERVICE_UNAVAILABLE).send(unavailable())
    })

    history.get('/api/history', async (_request, reply) => {
      if (!historyStore) return reply.code(HTTP_STATUS.SERVICE_UNAVAILABLE).send(unavailable())
      return historyStore.list()
    })

    history.post('/api/history/search', async (request, reply) => {
      const parsed = HistorySearchQuery.safeParse(request.body)
      if (!parsed.success) return reply.code(HTTP_STATUS.BAD_REQUEST).send(invalidQuery())
      if (!historyStore) return reply.code(HTTP_STATUS.SERVICE_UNAVAILABLE).send(unavailable())
      return historyStore.list(parsed.data)
    })

    history.get<{ Params: { correctionId: string } }>(
      '/api/history/:correctionId',
      async (request, reply) => {
        const parsed = z.uuid().safeParse(request.params.correctionId)

        if (!parsed.success)
          return reply.code(HTTP_STATUS.BAD_REQUEST).send(
            HistoryFailure.parse({
              error: {
                code: HistoryErrorCode.enum.INVALID_HISTORY_ID,
                message: 'The history identifier is invalid.',
              },
            }),
          )

        if (!historyStore) return reply.code(HTTP_STATUS.SERVICE_UNAVAILABLE).send(unavailable())
        const detail = historyStore.get(parsed.data)
        if (!detail)
          return reply.code(HTTP_STATUS.NOT_FOUND).send(
            HistoryFailure.parse({
              error: {
                code: HistoryErrorCode.enum.HISTORY_NOT_FOUND,
                message: 'This correction was not found.',
              },
            }),
          )
        return detail
      },
    )
  })
}
