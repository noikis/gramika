import type { FastifyInstance } from 'fastify'
import { CorrectionConfig, CorrectionInput, CorrectionSuccess, CorrectionFailure,
  ERROR_MESSAGES, MODEL_ID, MODEL_NAME, MAX_INPUT_CHARACTERS, TIMEOUT_MS, type ErrorCode } from '@gramota/contracts'
import { parseConfig, readEnvironment, type Environment } from './correction-config'
import { CorrectionDatabase, storageDiagnostic } from './database'
import { AttemptError, createCorrectionService } from './correction-service'
import { createTransport, type CorrectionTransport } from './openrouter'

export type CorrectionOptions = {
  environment?: Environment; databasePath?: string; transport?: CorrectionTransport
  database?: CorrectionDatabase | null; timeoutMs?: number
}
const statusCodes: Record<ErrorCode, number> = {
  INVALID_INPUT: 400, PAYLOAD_TOO_LARGE: 413, NOT_CONFIGURED: 503, STORAGE_ERROR: 503,
  UPSTREAM_ERROR: 502, INVALID_RESPONSE: 502, REASONING_NOT_DISABLED: 502, TIMEOUT: 504,
}
export async function correctionApi(app: FastifyInstance, options: CorrectionOptions = {}) {
  const config = parseConfig(options.environment ?? readEnvironment())
  let database: CorrectionDatabase | null = null
  try { database = options.database !== undefined ? options.database : new CorrectionDatabase(options.databasePath ?? config.databasePath) }
  catch (error) { app.log.error(storageDiagnostic(error, 'initialize'), 'Correction storage is unavailable') }
  const transport = options.transport ?? (config.available ? createTransport(config) : null)
  const correct = createCorrectionService({ database, transport, available: config.available, timeoutMs: options.timeoutMs,
    onStorageFailure: diagnostic => app.log.error(diagnostic, 'Correction storage operation failed') })
  app.addHook('onClose', async () => { try { await transport?.close() } finally { database?.close() } })

  app.register(async api => {
    api.setErrorHandler((error, _request, reply) => {
      const errorCode = error instanceof Error && 'code' in error ? error.code : undefined
      const statusCode = error instanceof Error && 'statusCode' in error ? error.statusCode : undefined
      const code: ErrorCode = errorCode === 'FST_ERR_CTP_BODY_TOO_LARGE' ? 'PAYLOAD_TOO_LARGE'
        : statusCode === 400 || statusCode === 415 ? 'INVALID_INPUT' : 'UPSTREAM_ERROR'
      if (code === 'UPSTREAM_ERROR') api.log.error({ code }, 'Unexpected correction error')
      reply.code(statusCodes[code]).send(CorrectionFailure.parse({
        error: { code, message: ERROR_MESSAGES[code] }, correctionId: null, requestId: null,
      }))
    })
    api.get('/api/correction-config', async () => CorrectionConfig.parse({
      modelId: MODEL_ID, modelName: MODEL_NAME, maxInputCharacters: MAX_INPUT_CHARACTERS,
      timeoutMs: TIMEOUT_MS, available: config.available && database !== null,
    }))
    api.post('/api/corrections', { bodyLimit: 128 * 1024 }, async (request, reply) => {
      const parsed = CorrectionInput.safeParse(request.body)
      try {
        if (!parsed.success) throw new AttemptError('INVALID_INPUT', null)
        return CorrectionSuccess.parse(await correct(parsed.data.text))
      } catch (error) {
        if (!(error instanceof AttemptError)) throw error
        return reply.code(statusCodes[error.code]).send(CorrectionFailure.parse({
          error: { code: error.code, message: ERROR_MESSAGES[error.code] },
          correctionId: error.ids?.correctionId ?? null, requestId: error.ids?.requestId ?? null,
        }))
      }
    })
  })
}
