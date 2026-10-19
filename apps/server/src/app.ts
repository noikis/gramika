import { storageDiagnostic } from './storage'
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
  const { config, storage, transport } = createAppResources(fastify, opts.correction)

  const correct = createCorrectionService({
    store: storage?.corrections ?? null,
    transport,
    isAvailable: config.available,
    timeoutMs: opts.correction?.timeoutMs,
    onStorageFailure: (error, stage) =>
      fastify.log.error(storageDiagnostic(error, stage), 'Correction storage operation failed'),
  })

  fastify.register(rootRoutes)
  await correctionRoutes(fastify, correct)
  await historyRoutes(fastify, storage?.history ?? null)
  await modelSettingsRoutes(fastify, storage?.modelPreferences ?? null, config.available)
}

export default app
export { app, options }
