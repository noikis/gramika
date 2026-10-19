import type { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import { createAppResources, type AppResourcesOptions } from './app-resources'
import { createCorrectionService } from './correction'
import rootRoutes from './routes/root'
import { correctionRoutes } from './routes/corrections'
import { historyRoutes } from './routes/history'
import { modelSettingsRoutes } from './routes/model-settings'
import { healthRoutes } from './routes/health'
import { LogOperation, loggingOptions } from './logging'
import { HTTP_STATUS } from './http-status'

export interface AppOptions extends FastifyServerOptions {
  correction?: AppResourcesOptions
}

const options: AppOptions = loggingOptions

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts): Promise<void> => {
  const { config, database, transport } = createAppResources(fastify, opts.correction)

  fastify.setErrorHandler((_error, request, reply) => {
    const statusCode =
      _error instanceof Error && 'statusCode' in _error ? _error.statusCode : undefined
    if (typeof statusCode === 'number' && statusCode < HTTP_STATUS.INTERNAL_SERVER_ERROR)
      return reply.code(statusCode).send({ error: 'Invalid request' })

    request.log.error(
      { req: request, err: _error, code: 'INTERNAL_ERROR', operation: LogOperation.enum.handler },
      'Unexpected server error',
    )
    return reply.code(HTTP_STATUS.INTERNAL_SERVER_ERROR).send({ error: 'Internal server error' })
  })

  const correct = createCorrectionService({
    repository: database?.corrections ?? null,
    transport,
    isAvailable: config.available,
    timeoutMs: opts.correction?.timeoutMs,
  })

  fastify.register(rootRoutes)
  await healthRoutes(fastify, database, config.available)
  await correctionRoutes(fastify, correct)
  await historyRoutes(fastify, database?.history ?? null)
  await modelSettingsRoutes(fastify, database?.modelPreferences ?? null, config.available)
}

export default app
export { app, options }
