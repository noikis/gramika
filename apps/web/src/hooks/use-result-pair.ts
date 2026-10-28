import { useState } from 'react'
import { CorrectionMode, type CorrectionResult } from '@gramota/contracts'
import type { ResultViewMode } from '../components/results/types'
import type { CorrectionWorkspaceState, SavedResult } from '../lib/workspace-storage'

type ResultHistory = { revision: number; results: SavedResult[] }

export function useResultPair(draftRevision: number, initial?: CorrectionWorkspaceState | null) {
  const [mode, setMode] = useState(initial?.mode ?? CorrectionMode.enum.strict)
  const [history, setHistory] = useState<ResultHistory | null>(
    initial?.results.length ? { revision: 0, results: initial.results } : null,
  )
  const [activeRequestId, setActiveRequestId] = useState<string | null>(
    initial?.activeRequestId ?? initial?.results.at(-1)?.result.requestId ?? null,
  )
  const visibleHistory = history?.revision === draftRevision ? history : null
  const allResults = visibleHistory?.results ?? []
  const results = allResults.filter((entry) => entry.result.mode === mode)
  const visibleResult =
    results.find((entry) => entry.result.requestId === activeRequestId)?.result ??
    results.at(-1)?.result ??
    null

  function receive(result: CorrectionResult, revision: number) {
    const saved: SavedResult = { result, view: 'changes' }
    setHistory((current) =>
      current?.revision !== revision
        ? { revision, results: [saved] }
        : current.results.some((entry) => entry.result.requestId === result.requestId)
          ? current
          : { ...current, results: [...current.results, saved] },
    )
    setActiveRequestId(result.requestId)
  }

  function selectMode(value: string) {
    const parsed = CorrectionMode.safeParse(value)
    if (!parsed.success) return
    setMode(parsed.data)
    const latest = allResults.filter((entry) => entry.result.mode === parsed.data).at(-1)
    setActiveRequestId(latest?.result.requestId ?? null)
  }

  function selectResult(requestId: string) {
    if (results.some((entry) => entry.result.requestId === requestId)) setActiveRequestId(requestId)
  }

  function setResultView(requestId: string, view: ResultViewMode) {
    setHistory((current) => {
      if (!current) return current
      return {
        ...current,
        results: current.results.map((entry) =>
          entry.result.requestId === requestId ? { ...entry, view } : entry,
        ),
      }
    })
  }

  function reset() {
    setHistory(null)
    setActiveRequestId(null)
  }

  function clear() {
    setHistory(null)
    setActiveRequestId(null)
  }

  function resetMode() {
    setMode(CorrectionMode.enum.strict)
    const latest = allResults
      .filter((entry) => entry.result.mode === CorrectionMode.enum.strict)
      .at(-1)
    setActiveRequestId(latest?.result.requestId ?? null)
  }

  const firstResult = results[0]?.result
  return {
    mode,
    activeRequestId,
    results,
    visibleResult,
    history: visibleHistory,
    allResults,
    correctionId: firstResult?.correctionId,
    isModeChanged: allResults.length > 0 && results.length === 0,
    draftChanged: history !== null && visibleHistory === null,
    receive,
    selectMode,
    selectResult,
    setResultView,
    reset,
    clear,
    resetMode,
  }
}
