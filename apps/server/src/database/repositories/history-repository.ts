import type Database from 'better-sqlite3'
import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  getTableColumns,
  gte,
  isNull,
  lt,
  ne,
  or,
  sql,
} from 'drizzle-orm'
import {
  HISTORY_PAGE_SIZE,
  HistoryDetail,
  HistoryList,
  HistorySearchQuery,
} from '@gramota/contracts'
import type { DatabaseClient } from '../sqlite-database'
import { corrections, modelRequests } from '../schema'

const MAX_PREVIEW_GRAPHEMES = 120

function createHistoryPreview(text: string) {
  const segmenter = new Intl.Segmenter('ru', { granularity: 'grapheme' })
  let preview = ''
  let count = 0

  for (const part of segmenter.segment(text)) {
    if (count++ === MAX_PREVIEW_GRAPHEMES) break
    preview += part.segment
  }

  return preview
}

export function registerHistorySearch(db: Database.Database) {
  db.function('history_contains', { deterministic: true }, (text, phrase) =>
    typeof text === 'string' &&
    typeof phrase === 'string' &&
    text.toLowerCase().includes(phrase.toLowerCase())
      ? 1
      : 0,
  )
}

function historyFilter(db: DatabaseClient, query: HistorySearchQuery) {
  const matchingAttempt = db
    .select({ id: modelRequests.id })
    .from(modelRequests)
    .where(
      and(
        eq(modelRequests.correctionId, corrections.id),
        query.model ? eq(modelRequests.requestedModel, query.model) : undefined,
        query.result === 'corrected'
          ? and(
              eq(modelRequests.status, 'succeeded'),
              ne(modelRequests.correctedText, corrections.originalText),
            )
          : query.result === 'unchanged'
            ? and(
                eq(modelRequests.status, 'succeeded'),
                eq(modelRequests.correctedText, corrections.originalText),
              )
            : query.result === 'all'
              ? undefined
              : eq(modelRequests.status, query.result),
      ),
    )
  const matchingText = db
    .select({ id: modelRequests.id })
    .from(modelRequests)
    .where(
      and(
        eq(modelRequests.correctionId, corrections.id),
        eq(modelRequests.status, 'succeeded'),
        sql`history_contains(${modelRequests.correctedText}, ${query.search})`,
      ),
    )

  return and(
    isNull(corrections.deletedAt),
    query.search
      ? or(
          sql`history_contains(${corrections.originalText}, ${query.search})`,
          exists(matchingText),
        )
      : undefined,
    query.model || query.result !== 'all' ? exists(matchingAttempt) : undefined,
    query.from === null ? undefined : gte(corrections.lastUsedAt, query.from),
    query.to === null ? undefined : lt(corrections.lastUsedAt, query.to),
  )
}

function selectHistoryPage(db: DatabaseClient, query: HistorySearchQuery) {
  const filter = historyFilter(db, query)
  const total = db.select({ total: count() }).from(corrections).where(filter).get()!.total
  const page = Math.min(query.page, Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)))
  const direction = query.sort === 'oldest' ? asc : desc
  const rows = db
    .select()
    .from(corrections)
    .where(filter)
    .orderBy(direction(corrections.lastUsedAt), direction(corrections.id))
    .limit(HISTORY_PAGE_SIZE)
    .offset((page - 1) * HISTORY_PAGE_SIZE)
    .all()

  return { total, page, rows }
}

export function createHistoryRepository(db: DatabaseClient) {
  return {
    list(query: HistorySearchQuery = HistorySearchQuery.parse({})) {
      const { total, page, rows } = selectHistoryPage(db, query)
      const models = db
        .selectDistinct({ model: modelRequests.requestedModel })
        .from(modelRequests)
        .innerJoin(corrections, eq(modelRequests.correctionId, corrections.id))
        .where(isNull(corrections.deletedAt))
        .orderBy(modelRequests.requestedModel)
        .all()
        .map((row) => row.model)

      return HistoryList.parse({
        total,
        page,
        models,
        items: rows.map((row) => ({
          id: row.id,
          createdAt: row.createdAt,
          lastUsedAt: row.lastUsedAt,
          preview: createHistoryPreview(row.originalText),
          models: [
            ...new Set(
              db
                .select({ model: modelRequests.requestedModel })
                .from(modelRequests)
                .where(eq(modelRequests.correctionId, row.id))
                .orderBy(modelRequests.startedAt, modelRequests.id)
                .all()
                .map((request) => request.model),
            ),
          ],
        })),
      })
    },

    softDelete(id: string) {
      return (
        db
          .update(corrections)
          .set({ deletedAt: new Date().toISOString() })
          .where(and(eq(corrections.id, id), isNull(corrections.deletedAt)))
          .run().changes === 1
      )
    },

    get(id: string) {
      const correction = db
        .select()
        .from(corrections)
        .where(and(eq(corrections.id, id), isNull(corrections.deletedAt)))
        .get()
      if (!correction) return null

      const { correctionId, ...requestColumns } = getTableColumns(modelRequests)
      const rows = db
        .select(requestColumns)
        .from(modelRequests)
        .where(eq(correctionId, id))
        .orderBy(modelRequests.startedAt, modelRequests.id)
        .all()

      return HistoryDetail.parse({
        id: correction.id,
        createdAt: correction.createdAt,
        lastUsedAt: correction.lastUsedAt,
        originalText: correction.originalText,
        language: correction.language,
        requests: rows,
      })
    },
  }
}
