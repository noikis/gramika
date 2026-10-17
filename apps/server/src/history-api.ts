import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { HistoryFailure } from '@gramota/contracts'
import type { CorrectionDatabase } from './database'

export async function historyApi(app: FastifyInstance, database: CorrectionDatabase | null) {
  const unavailable = () => HistoryFailure.parse({ error: {
    code: 'HISTORY_UNAVAILABLE', message: 'Could not load history. Please try again later.',
  } })
  app.register(async history => {
    history.setErrorHandler((_error, _request, reply) => {
      history.log.error({ code: 'HISTORY_UNAVAILABLE' }, 'History read failed')
      reply.code(503).send(unavailable())
    })
    history.get('/api/history', async (_request, reply) => {
      if (!database) return reply.code(503).send(unavailable())
      return database.listHistory()
    })
    history.get<{ Params: { correctionId: string } }>('/api/history/:correctionId', async (request, reply) => {
      const parsed = z.uuid().safeParse(request.params.correctionId)
      if (!parsed.success) return reply.code(400).send(HistoryFailure.parse({ error: {
        code: 'INVALID_HISTORY_ID', message: 'The history identifier is invalid.',
      } }))
      if (!database) return reply.code(503).send(unavailable())
      const detail = database.getHistory(parsed.data)
      if (!detail) return reply.code(404).send(HistoryFailure.parse({ error: {
        code: 'HISTORY_NOT_FOUND', message: 'This correction was not found.',
      } }))
      return detail
    })
  })
}
