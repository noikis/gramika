import type { FastifyInstance } from 'fastify'
import { parseConfig, readEnvironment, type Environment } from './correction-config'
import { SqliteDatabase, databaseDiagnostic, type Database } from './database'
import { createTransport } from './openrouter'
import { type CorrectionTransport } from './correction'

export type AppResourcesOptions = {
  environment?: Environment
  databasePath?: string
  transport?: CorrectionTransport
  database?: Database | null
  timeoutMs?: number
}

export function createAppResources(app: FastifyInstance, options: AppResourcesOptions = {}) {
  const config = parseConfig(options.environment ?? readEnvironment())

  let database: Database | null = null

  try {
    database =
      options.database !== undefined
        ? options.database
        : new SqliteDatabase(options.databasePath ?? config.databasePath)
  } catch (error) {
    app.log.error(databaseDiagnostic(error, 'initialize'), 'Correction database is unavailable')
  }

  const transport = options.transport ?? (config.available ? createTransport(config) : null)

  app.addHook('onClose', async () => {
    try {
      await transport?.close()
    } finally {
      database?.close()
    }
  })

  return { config, database, transport }
}
