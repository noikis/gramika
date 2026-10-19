export { SqliteStorage } from './database'
export { storageDiagnostic } from './diagnostics'

import type { SqliteStorage } from './database'

export type HistoryStore = SqliteStorage['history']
export type ModelPreferenceStore = SqliteStorage['modelPreferences']
export type Storage = Pick<SqliteStorage, 'corrections' | 'history' | 'modelPreferences' | 'close'>
