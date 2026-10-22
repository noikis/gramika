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
    result.setResultView(value.modelId, 'text', value.requestId),
  )
  const validation = OriginalText.safeParse(text.trim())
  const pending = request.pendingModel !== null
  const canCorrect = config.config !== null && validation.success && !pending
  const canRequestOpinion =
    canCorrect && !!result.pair && !result.pair.gemini && !result.isModeChanged
  const canRegenerate = canCorrect && config.config?.available === true && !result.isModeChanged
  const visibleError =
    request.error?.revision === draftRevision && request.error.mode === result.mode
      ? request.error
      : null

  async function submit(modelId: ModelId, forceRefresh = false) {
    const isOpinion = modelId === SECOND_OPINION_MODEL_ID
    const prior = result.results.find((entry) => entry.result.modelId === modelId)?.result
    if (forceRefresh ? !canRegenerate || !prior : isOpinion ? !canRequestOpinion : !canCorrect)
      return
    return request.submit({
      text: text.trim(),
      modelId,
      forceRefresh,
      mode: forceRefresh ? prior!.mode : isOpinion ? result.pair!.gemma.result.mode : result.mode,
      correctionId: isOpinion ? result.pair!.gemma.result.correctionId : undefined,
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
      activeModel: result.activeModel,
      gemma: result.pair?.gemma ?? null,
      gemini: result.pair?.gemini ?? null,
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
    activeModel: result.activeModel,
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
