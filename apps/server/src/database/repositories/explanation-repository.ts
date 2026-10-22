import { and, eq, isNull } from 'drizzle-orm'
import { ExplanationMetrics, type ExplanationInput } from '@gramota/contracts'
import type { ExplanationRepository } from '../../explanation'
import type { DatabaseClient } from '../sqlite-database'
import { corrections, explanations, explanationAttempts, modelRequests } from '../schema'

function columns(selection: ExplanationInput) {
  return {
    requestId: selection.requestId,
    originalStart: selection.originalRange.start,
    originalEnd: selection.originalRange.end,
    correctedStart: selection.correctedRange.start,
    correctedEnd: selection.correctedRange.end,
  }
}

function matches(selection: ExplanationInput) {
  const value = columns(selection)
  return and(
    eq(explanations.requestId, value.requestId),
    eq(explanations.originalStart, value.originalStart),
    eq(explanations.originalEnd, value.originalEnd),
    eq(explanations.correctedStart, value.correctedStart),
    eq(explanations.correctedEnd, value.correctedEnd),
  )
}

export function createExplanationRepository(db: DatabaseClient): ExplanationRepository {
  return {
    recordAttempt(attempt) {
      db.insert(explanationAttempts)
        .values({ id: attempt.id, requestId: attempt.selection.requestId, record: attempt })
        .onConflictDoUpdate({ target: explanationAttempts.id, set: { record: attempt } })
        .run()
    },
    metrics(requestId) {
      const attempts = db
        .select()
        .from(explanationAttempts)
        .where(eq(explanationAttempts.requestId, requestId))
        .all()
        .map((row) => row.record)
        .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
      const legacySelections = db
        .select()
        .from(explanations)
        .where(eq(explanations.requestId, requestId))
        .all()
        .map((row) => ({
          requestId,
          originalRange: { start: row.originalStart, end: row.originalEnd },
          correctedRange: { start: row.correctedStart, end: row.correctedEnd },
        }))
        .filter(
          (selection) =>
            !attempts.some(
              (attempt) =>
                attempt.status === 'succeeded' &&
                JSON.stringify(attempt.selection) === JSON.stringify(selection),
            ),
        )
      return ExplanationMetrics.parse({ attempts, legacySelections })
    },
    getSource(requestId) {
      const row = db
        .select({
          originalText: corrections.originalText,
          correctedText: modelRequests.correctedText,
          modelId: modelRequests.requestedModel,
          mode: modelRequests.mode,
        })
        .from(modelRequests)
        .innerJoin(corrections, eq(corrections.id, modelRequests.correctionId))
        .where(
          and(
            eq(modelRequests.id, requestId),
            eq(modelRequests.status, 'succeeded'),
            isNull(corrections.deletedAt),
          ),
        )
        .get()
      return row?.correctedText ? { ...row, correctedText: row.correctedText } : null
    },
    get(selection) {
      return (
        db
          .select({ explanation: explanations.explanation })
          .from(explanations)
          .where(matches(selection))
          .get()?.explanation ?? null
      )
    },
    save(selection, explanation) {
      db.insert(explanations)
        .values({ ...columns(selection), explanation })
        .onConflictDoNothing()
        .run()
      return db
        .select({ explanation: explanations.explanation })
        .from(explanations)
        .where(matches(selection))
        .get()!.explanation
    },
  }
}

export function recoverInterruptedExplanations(db: DatabaseClient, now: string) {
  db.transaction((tx) => {
    for (const row of tx.select().from(explanationAttempts).all()) {
      if (row.record.status !== 'pending') continue
      tx.update(explanationAttempts)
        .set({ record: { ...row.record, status: 'interrupted', endedAt: now } })
        .where(eq(explanationAttempts.id, row.id))
        .run()
    }
  })
}
