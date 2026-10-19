import type { DatabaseSync } from 'node:sqlite'
import { InvalidCorrectionReference, type CorrectionStore } from '../correction'
import { withTransaction } from './sqlite'

export function recoverInterruptedAttempts(db: DatabaseSync, endedAt: string) {
  db.prepare(
    `UPDATE model_requests SET status='failed', ended_at=:endedAt,
    error_code='INTERRUPTED', error_message='The server stopped before recording an outcome.'
    WHERE status='pending'`,
  ).run({ endedAt })
}

export function createCorrectionStore(db: DatabaseSync): CorrectionStore {
  return {
    beginAttempt({
      ids,
      originalText,
      modelId,
      promptVersion,
      parameters,
      startedAt,
      isRepeat = false,
    }) {
      withTransaction(db, () => {
        if (isRepeat) {
          const row = db
            .prepare('SELECT original_text FROM corrections WHERE id=:correctionId')
            .get({ correctionId: ids.correctionId })
          if (!row || row.original_text !== originalText) throw new InvalidCorrectionReference()
        } else {
          db.prepare(
            `INSERT INTO corrections (id, created_at, original_text, language, mode)
            VALUES (:correctionId, :startedAt, :originalText, 'ru', 'strict')`,
          ).run({ correctionId: ids.correctionId, startedAt, originalText })
        }

        db.prepare(
          `INSERT INTO model_requests
          (id, correction_id, requested_model, prompt_version, parameters_json, started_at, status)
          VALUES (:requestId, :correctionId, :modelId, :promptVersion, :parametersJson, :startedAt, 'pending')`,
        ).run({
          requestId: ids.requestId,
          correctionId: ids.correctionId,
          modelId,
          promptVersion,
          parametersJson: JSON.stringify(parameters),
          startedAt,
        })
      })
    },

    finishAttempt(requestId, outcome) {
      const result = db
        .prepare(
          `UPDATE model_requests SET
        status=:status, corrected_text=:correctedText, ended_at=:endedAt,
        duration_ms=:durationMs, error_code=:errorCode, error_message=:errorMessage,
        returned_model=:returnedModel, provider=:provider,
        openrouter_generation_id=:openrouterGenerationId,
        input_tokens=:inputTokens, output_tokens=:outputTokens,
        reasoning_tokens=:reasoningTokens, cached_input_tokens=:cachedInputTokens,
        cost_usd=:costUsd, finish_reason=:finishReason, total_tokens=:totalTokens,
        cache_write_tokens=:cacheWriteTokens, generation_time_ms=:generationTimeMs,
        upstream_inference_cost_usd=:upstreamInferenceCostUsd,
        upstream_prompt_cost_usd=:upstreamPromptCostUsd,
        upstream_completion_cost_usd=:upstreamCompletionCostUsd,
        routing_strategy=:routingStrategy, routing_region=:routingRegion,
        routing_attempt=:routingAttempt, is_byok=:isByok
        WHERE id=:requestId AND status='pending'`,
        )
        .run({
          requestId,
          status: outcome.status,
          correctedText: outcome.correctedText,
          endedAt: outcome.endedAt,
          durationMs: outcome.durationMs,
          errorCode: outcome.errorCode,
          errorMessage: outcome.errorMessage,
          returnedModel: outcome.returnedModel ?? null,
          provider: outcome.provider ?? null,
          openrouterGenerationId: outcome.openrouterGenerationId ?? null,
          inputTokens: outcome.inputTokens ?? null,
          outputTokens: outcome.outputTokens ?? null,
          reasoningTokens: outcome.reasoningTokens ?? null,
          cachedInputTokens: outcome.cachedInputTokens ?? null,
          costUsd: outcome.costUsd ?? null,
          finishReason: outcome.finishReason ?? null,
          totalTokens: outcome.totalTokens ?? null,
          cacheWriteTokens: outcome.cacheWriteTokens ?? null,
          generationTimeMs: outcome.generationTimeMs ?? null,
          upstreamInferenceCostUsd: outcome.upstreamInferenceCostUsd ?? null,
          upstreamPromptCostUsd: outcome.upstreamPromptCostUsd ?? null,
          upstreamCompletionCostUsd: outcome.upstreamCompletionCostUsd ?? null,
          routingStrategy: outcome.routingStrategy ?? null,
          routingRegion: outcome.routingRegion ?? null,
          routingAttempt: outcome.routingAttempt ?? null,
          isByok: outcome.isByok == null ? null : Number(outcome.isByok),
        })

      if (result.changes !== 1) {
        throw Object.assign(new Error('Attempt is not pending'), { code: 'ATTEMPT_NOT_PENDING' })
      }
    },
  }
}
