import { and, desc, eq, isNull } from 'drizzle-orm'
import { isDeepStrictEqual } from 'node:util'
import { DEFAULT_MODEL_ID } from '@gramota/contracts'
import { InvalidCorrectionReference, type CorrectionRepository } from '../../correction'
import type { DatabaseClient } from '../sqlite-database'
import { corrections, modelRequests } from '../schema'

export function recoverInterruptedAttempts(db: DatabaseClient, endedAt: string) {
  db.update(modelRequests)
    .set({
      status: 'failed',
      endedAt,
      errorCode: 'INTERRUPTED',
      errorMessage: 'The server stopped before recording an outcome.',
    })
    .where(eq(modelRequests.status, 'pending'))
    .run()
}

export function createCorrectionRepository(db: DatabaseClient): CorrectionRepository {
  return {
    findReusable(input) {
      return db.transaction(
        (tx) => {
          if (input.correctionId) {
            const parent = tx
              .select()
              .from(corrections)
              .where(and(eq(corrections.id, input.correctionId), isNull(corrections.deletedAt)))
              .get()
            if (!parent || parent.originalText !== input.originalText)
              throw new InvalidCorrectionReference()
          }
          if (input.forceRefresh) return null
          const candidates = tx
            .select({ request: modelRequests })
            .from(modelRequests)
            .innerJoin(corrections, eq(corrections.id, modelRequests.correctionId))
            .where(
              and(
                isNull(corrections.deletedAt),
                eq(corrections.originalText, input.originalText),
                eq(modelRequests.requestedModel, input.modelId),
                eq(modelRequests.mode, input.mode),
                eq(modelRequests.promptVersion, input.promptVersion),
                eq(modelRequests.status, 'succeeded'),
                input.correctionId && input.modelId !== DEFAULT_MODEL_ID
                  ? eq(corrections.id, input.correctionId)
                  : undefined,
              ),
            )
            .orderBy(
              desc(modelRequests.endedAt),
              desc(modelRequests.startedAt),
              desc(modelRequests.id),
            )
            .all()
          const saved = candidates.find(({ request }) =>
            isDeepStrictEqual(request.parameters, input.parameters),
          )?.request
          if (!saved?.correctedText) return null
          tx.update(corrections)
            .set({ lastUsedAt: input.usedAt })
            .where(eq(corrections.id, saved.correctionId))
            .run()
          return {
            correctionId: saved.correctionId,
            requestId: saved.id,
            correctedText: saved.correctedText,
          }
        },
        { behavior: 'immediate' },
      )
    },
    beginAttempt({
      ids,
      originalText,
      modelId,
      mode = 'strict',
      promptVersion,
      parameters,
      startedAt,
      isRepeat = false,
    }) {
      db.transaction(
        (tx) => {
          if (isRepeat) {
            const row = tx
              .select({ originalText: corrections.originalText })
              .from(corrections)
              .where(and(eq(corrections.id, ids.correctionId), isNull(corrections.deletedAt)))
              .get()
            if (!row || row.originalText !== originalText) throw new InvalidCorrectionReference()
            tx.update(corrections)
              .set({ lastUsedAt: startedAt })
              .where(eq(corrections.id, ids.correctionId))
              .run()
          } else {
            tx.insert(corrections)
              .values({
                id: ids.correctionId,
                createdAt: startedAt,
                lastUsedAt: startedAt,
                originalText,
                language: 'ru',
              })
              .run()
          }

          tx.insert(modelRequests)
            .values({
              id: ids.requestId,
              correctionId: ids.correctionId,
              requestedModel: modelId,
              mode,
              promptVersion,
              parameters,
              startedAt,
              status: 'pending',
            })
            .run()
        },
        { behavior: 'immediate' },
      )
    },

    finishAttempt(requestId, outcome) {
      const { durationMs, ...fields } = outcome
      const result = db
        .update(modelRequests)
        .set({ ...fields, appRequestTimeMs: durationMs })
        .where(and(eq(modelRequests.id, requestId), eq(modelRequests.status, 'pending')))
        .run()

      if (result.changes !== 1) {
        throw Object.assign(new Error('Attempt is not pending'), { code: 'ATTEMPT_NOT_PENDING' })
      }
    },
  }
}
