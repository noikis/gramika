import { and, eq, isNull } from 'drizzle-orm'
import type { ExplanationInput } from '@gramota/contracts'
import type { ExplanationRepository } from '../../explanation'
import type { DatabaseClient } from '../sqlite-database'
import { corrections, explanations, modelRequests } from '../schema'

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
