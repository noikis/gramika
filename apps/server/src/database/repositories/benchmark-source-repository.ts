import Database from 'better-sqlite3'
import type { ExplanationSource } from '../../explanation'

export function openBenchmarkSource(path: string) {
  const db = new Database(path, { readonly: true, fileMustExist: true })
  try {
    const query = db.prepare<[string, string], ExplanationSource>(`
    SELECT c.original_text AS originalText, r.corrected_text AS correctedText,
           r.requested_model AS modelId, r.mode
    FROM model_requests r JOIN corrections c ON c.id = r.correction_id
    WHERE r.id = ? AND c.id = ? AND c.deleted_at IS NULL AND r.status = 'succeeded'
  `)
    return {
      get: (requestId: string, correctionId: string) => query.get(requestId, correctionId) ?? null,
      close: () => db.close(),
    }
  } catch (error) {
    db.close()
    throw error
  }
}
