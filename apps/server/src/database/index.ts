export { SqliteDatabase } from './sqlite-database'
export { databaseDiagnostic } from './diagnostics'

import type { SqliteDatabase } from './sqlite-database'

export type HistoryRepository = SqliteDatabase['history']
export type ModelPreferenceRepository = SqliteDatabase['modelPreferences']
export type Database = Pick<
  SqliteDatabase,
  'corrections' | 'history' | 'modelPreferences' | 'close'
>
