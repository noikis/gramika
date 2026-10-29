import {
  CorrectionMode,
  CorrectionSuccess,
  TranslationScope,
  TranslationTarget,
  type CorrectionResult,
} from '@gramota/contracts'
import type { ResultViewMode } from '../components/results/types'
import type { MessageCatalog } from '../i18n/messages/types'

export const WORKSPACE_STORAGE_KEY = 'gramota.workspace'
const WORKSPACE_VERSION = 3
export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]
export type SavedResult = { result: CorrectionResult; view: ResultViewMode }
export type SavedTranslation = {
  scope: TranslationScope
  sourceText: string
  target: TranslationTarget
  translatedText: string
}

export type CorrectionWorkspaceState = {
  mode: CorrectionMode
  activeRequestId: string | null
  results: SavedResult[]
  isRequestPending: boolean
  translation?: SavedTranslation | null
}

export type LocalWorkspace = CorrectionWorkspaceState & {
  version: typeof WORKSPACE_VERSION
  text: string
  theme: Theme
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readResult(value: unknown): SavedResult {
  if (!isRecord(value) || (value.view !== 'text' && value.view !== 'changes'))
    throw Error('Invalid saved result')
  const result = CorrectionSuccess.parse(value.result)
  return { result, view: value.view }
}

export function loadWorkspace(): {
  workspace: LocalWorkspace | null
  messageKey: keyof MessageCatalog | null
} {
  let raw: string | null
  try {
    raw = localStorage.getItem(WORKSPACE_STORAGE_KEY)
  } catch {
    return {
      workspace: null,
      messageKey: 'storageUnavailable',
    }
  }
  if (raw === null) return { workspace: null, messageKey: null }
  try {
    const value: unknown = JSON.parse(raw)
    if (
      !isRecord(value) ||
      (value.version !== WORKSPACE_VERSION && value.version !== 2) ||
      typeof value.text !== 'string' ||
      !THEMES.some((theme) => theme === value.theme) ||
      typeof value.isRequestPending !== 'boolean' ||
      !Array.isArray(value.results) ||
      (value.activeRequestId !== null && typeof value.activeRequestId !== 'string')
    )
      throw Error('Invalid workspace')
    CorrectionMode.parse(value.mode)
    let translation: SavedTranslation | null = null
    if (value.translation !== undefined && value.translation !== null) {
      if (!isRecord(value.translation)) throw Error('Invalid translation')
      translation = {
        scope: TranslationScope.parse(value.translation.scope),
        sourceText:
          typeof value.translation.sourceText === 'string' ? value.translation.sourceText : '',
        target: TranslationTarget.parse(value.translation.target),
        translatedText:
          typeof value.translation.translatedText === 'string'
            ? value.translation.translatedText
            : '',
      }
      if (!translation.sourceText.trim() || !translation.translatedText.trim())
        throw Error('Invalid translation')
    }
    const results = value.results.map(readResult)
    const first = results[0]?.result
    if (
      (first && first.originalText !== value.text.trim()) ||
      results.some(
        ({ result }) =>
          result.correctionId !== first?.correctionId ||
          result.originalText !== first?.originalText,
      ) ||
      (value.activeRequestId !== null &&
        !results.some(({ result }) => result.requestId === value.activeRequestId))
    )
      throw Error('Mismatched workspace results')
    return {
      workspace: {
        version: WORKSPACE_VERSION,
        text: value.text,
        theme: value.theme as Theme,
        mode: CorrectionMode.enum.strict,
        results,
        activeRequestId: value.activeRequestId,
        isRequestPending: value.isRequestPending,
        translation,
      },
      messageKey: null,
    }
  } catch {
    try {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY)
    } catch {
      // Keep the same user-facing recovery message when storage is unavailable.
    }
    return {
      workspace: null,
      messageKey: 'workspaceRestoreFailed',
    }
  }
}

export function saveWorkspace(serialized: string): boolean {
  try {
    localStorage.setItem(WORKSPACE_STORAGE_KEY, serialized)
    return true
  } catch {
    return false
  }
}

export function clearWorkspace(): boolean {
  try {
    localStorage.removeItem(WORKSPACE_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
