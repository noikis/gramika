import type { FastifyInstance } from 'fastify'
import {
  ErrorCode,
  CorrectionConfig,
  ModelId,
  ModelPreference,
  DEFAULT_MODEL_ID,
  MODELS,
  MAX_INPUT_CHARACTERS,
  TIMEOUT_MS,
} from '@gramota/contracts'
import type { ModelPreferenceRepository } from '../database'
import { sendCorrectionFailure, setCorrectionErrorHandler } from './correction-errors'

export async function modelSettingsRoutes(
  app: FastifyInstance,
  preferences: ModelPreferenceRepository | null,
  available: boolean,
) {
  app.register(async (api) => {
    setCorrectionErrorHandler(api)

    api.get('/api/correction-config', async (_request, reply) => {
      try {
        if (!preferences) return sendCorrectionFailure(reply, ErrorCode.enum.STORAGE_ERROR)

        const selected = ModelId.safeParse(preferences.get())
        if (!selected.success) preferences.set(DEFAULT_MODEL_ID)

        return CorrectionConfig.parse({
          modelId: selected.success ? selected.data : DEFAULT_MODEL_ID,
          models: MODELS,
          maxInputCharacters: MAX_INPUT_CHARACTERS,
          timeoutMs: TIMEOUT_MS,
          available,
        })
      } catch {
        return sendCorrectionFailure(reply, ErrorCode.enum.STORAGE_ERROR)
      }
    })

    api.put('/api/model-preference', async (request, reply) => {
      const parsed = ModelPreference.safeParse(request.body)
      if (!parsed.success) return sendCorrectionFailure(reply, ErrorCode.enum.INVALID_INPUT)

      try {
        if (!preferences) return sendCorrectionFailure(reply, ErrorCode.enum.STORAGE_ERROR)

        preferences.set(parsed.data.modelId)
        return parsed.data
      } catch {
        return sendCorrectionFailure(reply, ErrorCode.enum.STORAGE_ERROR)
      }
    })
  })
}
