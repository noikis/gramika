import { eq } from 'drizzle-orm'
import { DEFAULT_MODEL_ID, type ModelId } from '@gramota/contracts'
import type { DatabaseClient } from '../sqlite-database'
import { modelPreference, userModelPreference } from '../schema'

const MODEL_PREFERENCE_ID = 1

export function createModelPreferenceRepository(db: DatabaseClient) {
  return {
    get(userId?: string) {
      if (userId) {
        const row = db.select().from(userModelPreference).where(eq(userModelPreference.userId, userId)).get()
        if (row) return row.modelId
        return DEFAULT_MODEL_ID
      }
      const row = db
        .select()
        .from(modelPreference)
        .where(eq(modelPreference.id, MODEL_PREFERENCE_ID))
        .get()
      if (!row) throw new Error('Missing model preference')

      return row.modelId
    },

    set(modelId: ModelId, userId?: string) {
      if (userId) {
        db.insert(userModelPreference)
          .values({ userId, modelId })
          .onConflictDoUpdate({ target: userModelPreference.userId, set: { modelId } })
          .run()
        return
      }
      const result = db
        .update(modelPreference)
        .set({ modelId })
        .where(eq(modelPreference.id, MODEL_PREFERENCE_ID))
        .run()
      if (result.changes !== 1) throw new Error('Missing model preference')
    },
  }
}
