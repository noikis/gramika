import { useState } from 'react'
import {
  CorrectionMode,
  DEFAULT_MODEL_ID,
  type CorrectionResult,
  type ModelId,
} from '@gramota/contracts'
import type { ResultViewMode } from '../components/result-view'
import type { CorrectionWorkspaceState, SavedResult } from '../lib/workspace-storage'

type ResultPair = { revision: number; gemma: SavedResult; gemini: SavedResult | null }

export function useResultPair(draftRevision: number, initial?: CorrectionWorkspaceState | null) {
  const [mode, setMode] = useState(initial?.mode ?? CorrectionMode.enum.strict)
  const [pair, setPair] = useState<ResultPair | null>(
    initial?.gemma ? { revision: 0, gemma: initial.gemma, gemini: initial.gemini } : null,
  )
  const [activeModel, setActiveModel] = useState<ModelId>(initial?.activeModel ?? DEFAULT_MODEL_ID)
  const visiblePair = pair?.revision === draftRevision ? pair : null
  const results = visiblePair
    ? [visiblePair.gemma, ...(visiblePair.gemini ? [visiblePair.gemini] : [])]
    : []
  const visibleResult =
    results.find((entry) => entry.result.modelId === activeModel)?.result ?? null

  function receive(result: CorrectionResult, revision: number) {
    const saved: SavedResult = { result, view: 'changes' }
    setPair((current) =>
      result.modelId !== DEFAULT_MODEL_ID && current?.revision === revision
        ? { ...current, gemini: saved }
        : { revision, gemma: saved, gemini: null },
    )
    setActiveModel(result.modelId)
  }

  function selectMode(value: string) {
    const parsed = CorrectionMode.safeParse(value)
    if (parsed.success) setMode(parsed.data)
  }

  function selectResult(modelId: ModelId) {
    if (results.some((entry) => entry.result.modelId === modelId)) setActiveModel(modelId)
  }

  function setResultView(modelId: ModelId, view: ResultViewMode, requestId: string) {
    setPair((current) => {
      if (!current) return current
      const key = modelId === DEFAULT_MODEL_ID ? 'gemma' : 'gemini'
      return current[key]?.result.requestId === requestId
        ? { ...current, [key]: { ...current[key], view } }
        : current
    })
  }

  function reset() {
    setPair(null)
    setActiveModel(DEFAULT_MODEL_ID)
  }

  return {
    mode,
    activeModel,
    results,
    visibleResult,
    pair: visiblePair,
    correctionId: pair?.gemma.result.correctionId,
    isModeChanged: !!visiblePair && visiblePair.gemma.result.mode !== mode,
    draftChanged: pair !== null && visiblePair === null,
    receive,
    selectMode,
    selectResult,
    setResultView,
    reset,
    clear: () => setPair(null),
    resetMode: () => setMode(CorrectionMode.enum.strict),
  }
}
