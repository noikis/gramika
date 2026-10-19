import type { FastifyInstance } from 'fastify'
import { HealthReason, HealthResponse, HealthStatus } from '@gramota/contracts'
import type { Database } from '../database'
import { HTTP_STATUS } from '../http-status'

export async function healthRoutes(
  app: FastifyInstance,
  database: Database | null,
  isConfigured: boolean,
) {
  app.get('/health', async (_request, reply) => {
    reply.header('Cache-Control', 'no-store')

    let isDatabaseAvailable = false
    try {
      database?.checkHealth()
      isDatabaseAvailable = database !== null
    } catch {
      // Health polling returns a safe status without repeating failure logs.
    }

    if (!isDatabaseAvailable)
      return reply.code(HTTP_STATUS.SERVICE_UNAVAILABLE).send(
        HealthResponse.parse({
          status: HealthStatus.enum.unavailable,
          reason: HealthReason.enum.DATABASE_UNAVAILABLE,
        }),
      )

    if (!isConfigured)
      return reply.code(HTTP_STATUS.SERVICE_UNAVAILABLE).send(
        HealthResponse.parse({
          status: HealthStatus.enum.unavailable,
          reason: HealthReason.enum.NOT_CONFIGURED,
        }),
      )

    return HealthResponse.parse({ status: HealthStatus.enum.ok })
  })
}
