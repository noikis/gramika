import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { migrateDatabase } from './migrations'
import {
  createCorrectionRepository,
  recoverInterruptedAttempts,
} from './repositories/correction-repository'
import { createHistoryRepository, registerHistorySearch } from './repositories/history-repository'
import { createModelPreferenceRepository } from './repositories/model-preference-repository'

const BUSY_TIMEOUT_MS = 5000

export type DatabaseClient = BetterSQLite3Database

export class SqliteDatabase {
  readonly db: Database.Database
  readonly corrections: ReturnType<typeof createCorrectionRepository>
  readonly history: ReturnType<typeof createHistoryRepository>
  readonly modelPreferences: ReturnType<typeof createModelPreferenceRepository>

  constructor(path: string, now = new Date().toISOString()) {
    this.db = this.openConnection(path)

    try {
      registerHistorySearch(this.db)
      const database = this.createDrizzleClient()
      migrateDatabase(database)
      recoverInterruptedAttempts(database, now)

      this.corrections = createCorrectionRepository(database)
      this.history = createHistoryRepository(database)
      this.modelPreferences = createModelPreferenceRepository(database)
    } catch (error) {
      this.db.close()
      throw error
    }
  }

  close() {
    this.db.close()
  }

  private openConnection(path: string) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })

    const db = new Database(path, { timeout: BUSY_TIMEOUT_MS })
    try {
      db.pragma('foreign_keys = ON')
      return db
    } catch (error) {
      db.close()
      throw error
    }
  }

  private createDrizzleClient() {
    return drizzle(this.db, { logger: false })
  }
}
