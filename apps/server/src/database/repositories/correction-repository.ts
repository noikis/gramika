import { and, eq } from 'drizzle-orm'
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
    beginAttempt({
      ids,
      originalText,
      modelId,
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
              .where(eq(corrections.id, ids.correctionId))
              .get()
            if (!row || row.originalText !== originalText) throw new InvalidCorrectionReference()
          } else {
            tx.insert(corrections)
              .values({
                id: ids.correctionId,
                createdAt: startedAt,
                originalText,
                language: 'ru',
                mode: 'strict',
              })
              .run()
          }

          tx.insert(modelRequests)
            .values({
              id: ids.requestId,
              correctionId: ids.correctionId,
              requestedModel: modelId,
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
