import type { FastifyInstance } from 'fastify'
import { parseConfig, readEnvironment, type Environment } from './config'
import { SqliteDatabase, databaseDiagnostic, type Database } from './database'
import { createTransport } from './openrouter'
import { type CorrectionTransport } from './correction'
import { LogOperation } from './logging'

export type AppResourcesOptions = {
  environment?: Environment
  databasePath?: string
  transport?: CorrectionTransport
  database?: Database | null
  timeoutMs?: number
}

export function createAppResources(app: FastifyInstance, options: AppResourcesOptions = {}) {
  const config = parseConfig(options.environment ?? readEnvironment())

  if (!config.available)
    app.log.warn({ code: 'NOT_CONFIGURED' }, 'Correction configuration is unavailable')

  let database: Database | null = null

  try {
    database =
      options.database !== undefined
        ? options.database
        : new SqliteDatabase(options.databasePath ?? config.databasePath)
  } catch (error) {
    app.log.error(
      {
        ...databaseDiagnostic(error, 'initialize'),
        err: error,
        operation: LogOperation.enum['database-initialize'],
      },
      'Correction database is unavailable',
    )
  }

  const transport = options.transport ?? (config.available ? createTransport(config) : null)
  app.addHook('onClose', async () => {
    try {
      await transport?.close()
    } finally {
      database?.close()
    }
    app.log.info('Application resources closed')
  })

  return { config, database, transport }
}
