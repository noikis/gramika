import type { FastifyInstance } from 'fastify'
import { parseConfig, readEnvironment, type Environment } from './correction-config'
import { SqliteStorage, storageDiagnostic, type Storage } from './storage'
import { createTransport } from './openrouter'
import { type CorrectionTransport } from './correction'

export type AppResourcesOptions = {
  environment?: Environment
  databasePath?: string
  transport?: CorrectionTransport
  storage?: Storage | null
  timeoutMs?: number
}

export function createAppResources(app: FastifyInstance, options: AppResourcesOptions = {}) {
  const config = parseConfig(options.environment ?? readEnvironment())

  let storage: Storage | null = null

  try {
    storage =
      options.storage !== undefined
        ? options.storage
        : new SqliteStorage(options.databasePath ?? config.databasePath)
  } catch (error) {
    app.log.error(storageDiagnostic(error, 'initialize'), 'Correction storage is unavailable')
  }

  const transport = options.transport ?? (config.available ? createTransport(config) : null)

  app.addHook('onClose', async () => {
    try {
      await transport?.close()
    } finally {
      storage?.close()
    }
  })

  return { config, storage, transport }
}
