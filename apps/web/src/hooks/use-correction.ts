import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  CorrectionConfig,
  CorrectionFailure,
  CorrectionInput,
  CorrectionMode,
  CorrectionSuccess,
  DEFAULT_MODEL_ID,
  MODELS,
  OriginalText,
  ERROR_MESSAGES,
  type CorrectionResult,
  type ModelId,
  type PublicConfig,
} from '@gramota/contracts'
import type { ResultViewMode } from '../components/result-view'
import { writeClipboardText } from '../lib/clipboard'
import { notify } from '../lib/notifications'
import { modelName } from '../lib/history-format'

const SECOND_OPINION_MODEL_ID = MODELS[1].id

type SavedResult = { result: CorrectionResult; view: ResultViewMode }
type ResultPair = { revision: number; gemma: SavedResult; gemini: SavedResult | null }
type Feedback = { revision: number; mode: CorrectionMode; modelId: ModelId; message: string }

export function useCorrection(text: string, draftRevision: number) {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [configFailed, setConfigFailed] = useState(false)
  const [configAttempt, setConfigAttempt] = useState(0)
  const [mode, setMode] = useState<CorrectionMode>(CorrectionMode.enum.strict)
  const [pendingModel, setPendingModel] = useState<ModelId | null>(null)
  const [pair, setPair] = useState<ResultPair | null>(null)
  const [activeModel, setActiveModel] = useState<ModelId>(DEFAULT_MODEL_ID)
  const [error, setError] = useState<Feedback | null>(null)
  const [copying, setCopying] = useState(false)
  const sending = useRef(false)
  const writing = useRef(false)
  const latestRevision = useRef(draftRevision)
  const requestGeneration = useRef(0)
  const association = useRef<{ revision: number; correctionId: string } | null>(null)

  useLayoutEffect(() => {
    latestRevision.current = draftRevision
  }, [draftRevision])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/correction-config', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw Error('Configuration unavailable')
        const value = CorrectionConfig.parse(await response.json())
        if (!controller.signal.aborted) setConfig(value)
      })
      .catch(() => {
        if (!controller.signal.aborted) setConfigFailed(true)
      })
    return () => controller.abort()
  }, [configAttempt])

  function reloadConfig() {
    setConfigFailed(false)
    setConfigAttempt((attempt) => attempt + 1)
  }

  function selectMode(value: string) {
    const parsed = CorrectionMode.safeParse(value)
    if (parsed.success && !sending.current) setMode(parsed.data)
  }

  const original = text.trim()
  const validation = OriginalText.safeParse(original)
  const visiblePair = pair?.revision === draftRevision ? pair : null
  const results = visiblePair
    ? [visiblePair.gemma, ...(visiblePair.gemini ? [visiblePair.gemini] : [])]
    : []
  const visibleResult =
    results.find((entry) => entry.result.modelId === activeModel)?.result ?? null
  const pending = pendingModel !== null
  const canCorrect = config?.available === true && validation.success && !pending
  const isModeChanged = !!visiblePair && visiblePair.gemma.result.mode !== mode
  const canRequestOpinion = canCorrect && !!visiblePair && !visiblePair.gemini && !isModeChanged

  function selectResult(modelId: ModelId) {
    if (results.some((entry) => entry.result.modelId === modelId)) setActiveModel(modelId)
  }

  function setResultView(modelId: ModelId, view: ResultViewMode, requestId: string) {
    setPair((current) => {
      if (!current) return current
      const key = modelId === DEFAULT_MODEL_ID ? 'gemma' : 'gemini'
      const entry = current[key]
      return entry?.result.requestId === requestId
        ? { ...current, [key]: { ...entry, view } }
        : current
    })
  }

  async function submit(modelId: ModelId) {
    const isOpinion = modelId === SECOND_OPINION_MODEL_ID
    if (sending.current || (isOpinion ? !canRequestOpinion : !canCorrect)) return
    const submittedMode = isOpinion ? visiblePair!.gemma.result.mode : mode
    const submittedRevision = draftRevision
    const generation = requestGeneration.current
    const correctionId = isOpinion
      ? visiblePair!.gemma.result.correctionId
      : association.current?.revision === submittedRevision
        ? association.current.correctionId
        : undefined
    const isCurrent = () =>
      latestRevision.current === submittedRevision && requestGeneration.current === generation
    sending.current = true
    setPendingModel(modelId)
    setError(null)
    try {
      const response = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(
          CorrectionInput.parse({ text: original, modelId, correctionId, mode: submittedMode }),
        ),
      })
      const payload: unknown = await response.json()
      if (!response.ok) {
        const failure = CorrectionFailure.parse(payload)
        if (correctionId && failure.correctionId && failure.correctionId !== correctionId)
          throw Error('Mismatched correction failure')
        if (!isCurrent()) return
        if (failure.error.code === 'INVALID_INPUT') association.current = null
        else if (failure.correctionId)
          association.current = { revision: submittedRevision, correctionId: failure.correctionId }
        setError({
          revision: submittedRevision,
          mode: submittedMode,
          modelId,
          message: ERROR_MESSAGES[failure.error.code],
        })
        return
      }
      const value = CorrectionSuccess.parse(payload)
      if (
        value.originalText !== original ||
        value.modelId !== modelId ||
        value.mode !== submittedMode ||
        (correctionId && value.correctionId !== correctionId)
      )
        throw Error('Mismatched correction')
      if (!isCurrent()) return
      association.current = { revision: submittedRevision, correctionId: value.correctionId }
      const saved: SavedResult = { result: value, view: 'changes' }
      setPair((current) =>
        isOpinion && current?.revision === submittedRevision
          ? { ...current, gemini: saved }
          : { revision: submittedRevision, gemma: saved, gemini: null },
      )
      setActiveModel(modelId)
      notify(
        `${modelName(value.modelId)}: ${value.originalText === value.correctedText ? 'No changes.' : 'Correction ready.'}`,
        true,
      )
    } catch {
      if (isCurrent())
        setError({
          revision: submittedRevision,
          mode: submittedMode,
          modelId,
          message: isOpinion
            ? 'Could not get another opinion. You can try again.'
            : 'Could not complete correction. Your text and previous results were kept. You can try again.',
        })
    } finally {
      sending.current = false
      setPendingModel(null)
    }
  }

  async function copy() {
    if (!visibleResult || writing.current) return
    const result = visibleResult
    writing.current = true
    setCopying(true)
    try {
      const outcome = await writeClipboardText(result.correctedText)
      if (!outcome.success) setResultView(result.modelId, 'text', result.requestId)
      notify(outcome.message, outcome.success)
    } finally {
      writing.current = false
      setCopying(false)
    }
  }

  const availability = configFailed
    ? 'Could not connect to the correction server.'
    : !config
      ? 'Connecting...'
      : !config.available
        ? ERROR_MESSAGES.NOT_CONFIGURED
        : ''
  const validationMessage =
    text && !validation.success ? (validation.error.issues[0]?.message ?? '') : ''
  const visibleError = error?.revision === draftRevision && error.mode === mode ? error : null

  function forgetHistoryEntry(id: string) {
    if (association.current?.correctionId === id || pair?.gemma.result.correctionId === id) {
      association.current = null
      requestGeneration.current += 1
      setPair(null)
    }
  }

  return {
    forgetHistoryEntry,
    mode,
    selectMode,
    configFailed,
    reloadConfig,
    pending,
    pendingModel,
    isOpinionPending: pendingModel === SECOND_OPINION_MODEL_ID,
    visibleResult,
    results,
    activeModel,
    selectResult,
    setResultView,
    isModeChanged,
    canCorrect,
    canRequestOpinion,
    correct: () => submit(DEFAULT_MODEL_ID),
    requestOpinion: () => submit(SECOND_OPINION_MODEL_ID),
    opinionModelName: modelName(SECOND_OPINION_MODEL_ID),
    copy,
    copying,
    availability,
    validationMessage,
    error: visibleError?.modelId === DEFAULT_MODEL_ID ? visibleError.message : '',
    opinionError: visibleError?.modelId === SECOND_OPINION_MODEL_ID ? visibleError.message : '',
    draftChanged: pair !== null && visiblePair === null,
  }
}
