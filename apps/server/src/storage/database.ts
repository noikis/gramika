import { openDatabase } from './sqlite'
import { migrateDatabase } from './migrations'
import { createCorrectionStore, recoverInterruptedAttempts } from './corrections'
import { createHistoryStore, registerHistorySearch } from './history'
import { createModelPreferenceStore } from './model-preferences'

export class SqliteStorage {
  readonly db: ReturnType<typeof openDatabase>
  readonly corrections: ReturnType<typeof createCorrectionStore>
  readonly history: ReturnType<typeof createHistoryStore>
  readonly modelPreferences: ReturnType<typeof createModelPreferenceStore>

  constructor(path: string, now = new Date().toISOString()) {
    this.db = openDatabase(path)

    try {
      registerHistorySearch(this.db)
      migrateDatabase(this.db)
      recoverInterruptedAttempts(this.db, now)

      this.corrections = createCorrectionStore(this.db)
      this.history = createHistoryStore(this.db)
      this.modelPreferences = createModelPreferenceStore(this.db)
    } catch (error) {
      this.db.close()
      throw error
    }
  }

  close() {
    this.db.close()
  }
}
