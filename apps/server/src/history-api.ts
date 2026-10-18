import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { HistoryFailure, HistorySearchQuery } from '@gramota/contracts'
import type { CorrectionDatabase } from './database'

export async function historyApi(app: FastifyInstance, database: CorrectionDatabase | null) {
  const unavailable = () =>
    HistoryFailure.parse({
      error: {
        code: 'HISTORY_UNAVAILABLE',
        message: 'Could not load history. Please try again later.',
      },
    })

  app.register(async (history) => {
    const invalidQuery = () =>
      HistoryFailure.parse({
        error: {
          code: 'INVALID_HISTORY_QUERY',
          message: 'The history search criteria are invalid.',
        },
      })
    history.setErrorHandler((_error, _request, reply) => {
      if (
        typeof _error === 'object' &&
        _error !== null &&
        'statusCode' in _error &&
        (_error.statusCode === 400 || _error.statusCode === 413 || _error.statusCode === 415)
      ) {
        return reply.code(_error.statusCode).send(invalidQuery())
      }
      history.log.error({ code: 'HISTORY_UNAVAILABLE' }, 'History read failed')
      reply.code(503).send(unavailable())
    })

    history.get('/api/history', async (_request, reply) => {
      if (!database) return reply.code(503).send(unavailable())
      return database.listHistory()
    })

    history.post('/api/history/search', async (request, reply) => {
      const parsed = HistorySearchQuery.safeParse(request.body)
      if (!parsed.success) return reply.code(400).send(invalidQuery())
      if (!database) return reply.code(503).send(unavailable())
      return database.listHistory(parsed.data)
    })

    history.get<{ Params: { correctionId: string } }>(
      '/api/history/:correctionId',
      async (request, reply) => {
        const parsed = z.uuid().safeParse(request.params.correctionId)

        if (!parsed.success)
          return reply.code(400).send(
            HistoryFailure.parse({
              error: {
                code: 'INVALID_HISTORY_ID',
                message: 'The history identifier is invalid.',
              },
            }),
          )

        if (!database) return reply.code(503).send(unavailable())
        const detail = database.getHistory(parsed.data)
        if (!detail)
          return reply.code(404).send(
            HistoryFailure.parse({
              error: {
                code: 'HISTORY_NOT_FOUND',
                message: 'This correction was not found.',
              },
            }),
          )
        return detail
      },
    )
  })
}
