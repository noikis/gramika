import { eq } from 'drizzle-orm'
import type { ModelId } from '@gramota/contracts'
import type { DatabaseClient } from '../sqlite-database'
import { modelPreference } from '../schema'

const MODEL_PREFERENCE_ID = 1

export function createModelPreferenceRepository(db: DatabaseClient) {
  return {
    get() {
      const row = db
        .select()
        .from(modelPreference)
        .where(eq(modelPreference.id, MODEL_PREFERENCE_ID))
        .get()
      if (!row) throw new Error('Missing model preference')

      return row.modelId
    },

    set(modelId: ModelId) {
      const result = db
        .update(modelPreference)
        .set({ modelId })
        .where(eq(modelPreference.id, MODEL_PREFERENCE_ID))
        .run()
      if (result.changes !== 1) throw new Error('Missing model preference')
    },
  }
}
