import { databaseDiagnostic } from './database'
import type { FastifyPluginAsync, FastifyServerOptions } from 'fastify'
import { createAppResources, type AppResourcesOptions } from './app-resources'
import { createCorrectionService } from './correction'
import rootRoutes from './routes/root'
import { correctionRoutes } from './routes/corrections'
import { historyRoutes } from './routes/history'
import { modelSettingsRoutes } from './routes/model-settings'

export interface AppOptions extends FastifyServerOptions {
  correction?: AppResourcesOptions
}

const options: AppOptions = {}

const app: FastifyPluginAsync<AppOptions> = async (fastify, opts): Promise<void> => {
  const { config, database, transport } = createAppResources(fastify, opts.correction)

  const correct = createCorrectionService({
    repository: database?.corrections ?? null,
    transport,
    isAvailable: config.available,
    timeoutMs: opts.correction?.timeoutMs,
    onRepositoryFailure: (error, stage) =>
      fastify.log.error(databaseDiagnostic(error, stage), 'Correction repository operation failed'),
  })

  fastify.register(rootRoutes)
  await correctionRoutes(fastify, correct)
  await historyRoutes(fastify, database?.history ?? null)
  await modelSettingsRoutes(fastify, database?.modelPreferences ?? null, config.available)
}

export default app
export { app, options }
