import { DEFAULT_MODEL_ID, MODELS, OriginalText, type ModelId } from '@gramota/contracts'
import { modelName } from '../lib/history-format'
import type { CorrectionWorkspaceState } from '../lib/workspace-storage'
import { useServiceConfig } from './use-service-config'
import { useSubmission } from './use-submission'
import { useResultPair } from './use-result-pair'
import { useClipboardCopy } from './use-clipboard-copy'

const SECOND_OPINION_MODEL_ID = MODELS[1].id

export function useWritingSession(
  text: string,
  draftRevision: number,
  initial?: CorrectionWorkspaceState | null,
) {
  const config = useServiceConfig()
  const result = useResultPair(draftRevision, initial)
  const request = useSubmission(draftRevision, initial, result.receive)
  const clipboard = useClipboardCopy(result.visibleResult, (value) =>
    result.setResultView(value.requestId, 'text'),
  )
  const validation = OriginalText.safeParse(text.trim())
  const pending = request.pendingModel !== null
  const canCorrect = config.config !== null && validation.success && !pending
  const canRequestOpinion =
    canCorrect &&
    result.results.length > 0 &&
    !result.results.some((entry) => entry.result.modelId === SECOND_OPINION_MODEL_ID) &&
    !result.isModeChanged
  function canRegenerate(modelId: ModelId) {
    return (
      canCorrect &&
      config.config?.available === true &&
      !result.isModeChanged &&
      result.results.filter((entry) => entry.result.modelId === modelId).length < 2
    )
  }
  const visibleError =
    request.error?.revision === draftRevision && request.error.mode === result.mode
      ? request.error
      : null

  async function submit(modelId: ModelId, forceRefresh = false) {
    const isOpinion = modelId === SECOND_OPINION_MODEL_ID
    const prior = result.results.filter((entry) => entry.result.modelId === modelId).at(-1)?.result
    if (
      forceRefresh
        ? !canRegenerate(modelId) || !prior
        : isOpinion
          ? !canRequestOpinion
          : !canCorrect
    )
      return
    return request.submit({
      text: text.trim(),
      modelId,
      forceRefresh,
      mode: forceRefresh ? prior!.mode : isOpinion ? result.results[0].result.mode : result.mode,
      correctionId: result.correctionId,
    })
  }

  function selectMode(value: string) {
    if (!request.isSending()) result.selectMode(value)
  }

  function forgetHistoryEntry(id: string) {
    if (request.isAssociated(id) || result.correctionId === id) {
      request.invalidate()
      result.clear()
    }
  }

  function reset() {
    if (clipboard.isWriting() || !request.reset()) return false
    result.reset()
    return true
  }

  return {
    hasCompletedCorrection: request.hasCompletedCorrection,
    reset,
    resetMode: result.resetMode,
    interrupted: request.interrupted,
    dismissInterrupted: request.dismissInterrupted,
    workspace: {
      mode: result.mode,
      activeRequestId: result.activeRequestId,
      results: result.history?.results ?? [],
      isRequestPending: pending || request.interrupted,
    } satisfies CorrectionWorkspaceState,
    forgetHistoryEntry,
    mode: result.mode,
    selectMode,
    configFailed: config.configFailed,
    reloadConfig: config.reloadConfig,
    pending,
    pendingModel: request.pendingModel,
    isOpinionPending: request.pendingModel === SECOND_OPINION_MODEL_ID,
    visibleResult: result.visibleResult,
    results: result.results,
    activeRequestId: result.activeRequestId,
    selectResult: result.selectResult,
    setResultView: result.setResultView,
    isModeChanged: result.isModeChanged,
    canCorrect,
    canRequestOpinion,
    correct: () => submit(DEFAULT_MODEL_ID),
    requestOpinion: () => submit(SECOND_OPINION_MODEL_ID),
    regenerate: (modelId: ModelId) => submit(modelId, true),
    canRegenerate,
    opinionModelName: modelName(SECOND_OPINION_MODEL_ID),
    copy: clipboard.copy,
    copying: clipboard.copying,
    availability: config.availability,
    validationMessage:
      text && !validation.success ? (validation.error.issues[0]?.message ?? '') : '',
    error: visibleError?.modelId === DEFAULT_MODEL_ID ? visibleError.message : '',
    opinionError: visibleError?.modelId === SECOND_OPINION_MODEL_ID ? visibleError.message : '',
    draftChanged: result.draftChanged,
  }
}
