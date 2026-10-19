import type { DatabaseSync } from 'node:sqlite'
import type { ModelId } from '@gramota/contracts'

export function createModelPreferenceStore(db: DatabaseSync) {
  return {
    get() {
      const row = db.prepare('SELECT model_id FROM model_preference WHERE id=1').get()
      if (!row) throw new Error('Missing model preference')

      return String(row.model_id)
    },

    set(modelId: ModelId) {
      const result = db
        .prepare('UPDATE model_preference SET model_id=:modelId WHERE id=1')
        .run({ modelId })
      if (result.changes !== 1) throw new Error('Missing model preference')
    },
  }
}
