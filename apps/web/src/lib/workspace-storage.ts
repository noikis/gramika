import {
  CorrectionMode,
  CorrectionSuccess,
  DEFAULT_MODEL_ID,
  MODELS,
  type ModelId,
  type CorrectionResult,
} from '@gramota/contracts'
import type { ResultViewMode } from '../components/result-view'

export const WORKSPACE_STORAGE_KEY = 'gramota.workspace'
export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]
export type SavedResult = { result: CorrectionResult; view: ResultViewMode }

export type CorrectionWorkspaceState = {
  mode: CorrectionMode
  activeModel: ModelId
  gemma: SavedResult | null
  gemini: SavedResult | null
  isRequestPending: boolean
}

export type LocalWorkspace = CorrectionWorkspaceState & {
  version: 1
  text: string
  theme: Theme
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readResult(value: unknown, modelId: ModelId): SavedResult | null {
  if (value === null) return null
  if (!isRecord(value) || (value.view !== 'text' && value.view !== 'changes'))
    throw Error('Invalid saved result')
  const result = CorrectionSuccess.parse(value.result)
  if (result.modelId !== modelId) throw Error('Invalid saved model')
  return { result, view: value.view }
}

export function loadWorkspace(): { workspace: LocalWorkspace | null; message: string } {
  let raw: string | null
  try {
    raw = localStorage.getItem(WORKSPACE_STORAGE_KEY)
  } catch {
    return {
      workspace: null,
      message: 'Local saving is unavailable. Keep this tab open to retain your text.',
    }
  }
  if (raw === null) return { workspace: null, message: '' }
  try {
    const value: unknown = JSON.parse(raw)
    if (
      !isRecord(value) ||
      value.version !== 1 ||
      typeof value.text !== 'string' ||
      !THEMES.some((theme) => theme === value.theme) ||
      typeof value.isRequestPending !== 'boolean'
    )
      throw Error('Invalid workspace')
    CorrectionMode.parse(value.mode)
    const gemma = readResult(value.gemma, DEFAULT_MODEL_ID)
    const gemini = readResult(value.gemini, MODELS[1].id)
    if (
      (gemma && gemma.result.originalText !== value.text.trim()) ||
      (gemini &&
        (!gemma ||
          gemini.result.correctionId !== gemma.result.correctionId ||
          gemini.result.originalText !== gemma.result.originalText ||
          gemini.result.mode !== gemma.result.mode))
    )
      throw Error('Mismatched workspace results')
    return {
      workspace: {
        version: 1,
        text: value.text,
        theme: value.theme as Theme,
        mode: CorrectionMode.enum.strict,
        gemma,
        gemini,
        activeModel: value.activeModel === MODELS[1].id && gemini ? MODELS[1].id : DEFAULT_MODEL_ID,
        isRequestPending: value.isRequestPending,
      },
      message: '',
    }
  } catch {
    return {
      workspace: null,
      message: 'The saved workspace could not be restored. You can start a new correction.',
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
