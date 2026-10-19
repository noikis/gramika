import { join } from 'node:path'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import type { DatabaseClient } from './sqlite-database'

const MIGRATIONS_FOLDER = join(__dirname, '../../drizzle')

export function migrateDatabase(db: DatabaseClient) {
  migrate(db, { migrationsFolder: MIGRATIONS_FOLDER })
}
