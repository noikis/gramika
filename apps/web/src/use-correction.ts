import { useEffect, useRef, useState } from 'react'
import { CorrectionConfig, CorrectionFailure, CorrectionInput, CorrectionSuccess,
  OriginalText, ModelPreference, ERROR_MESSAGES, type CorrectionResult, type PublicConfig } from '@gramota/contracts'
import type { ResultViewMode } from './components/result-view'
import { writeClipboardText } from './lib/clipboard'

type Feedback = { original: string; message: string }

export function useCorrection(text: string) {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [configFailed, setConfigFailed] = useState(false)
  const [configAttempt, setConfigAttempt] = useState(0)
  const [savingModel, setSavingModel] = useState(false)
  const [modelError, setModelError] = useState('')
  const [retryModel, setRetryModel] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<CorrectionResult | null>(null)
  const [resultView, setResultView] = useState<ResultViewMode>('changes')
  const [error, setError] = useState<Feedback | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<Feedback | null>(null)
  const [copying, setCopying] = useState(false)
  const sending = useRef(false)
  const writing = useRef(false)
  const saving = useRef(false)
  const association = useRef<{ original: string; correctionId: string } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/correction-config', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error('Configuration unavailable')
      const value = CorrectionConfig.parse(await response.json())
      if (!controller.signal.aborted) setConfig(value)
    }).catch(() => { if (!controller.signal.aborted) setConfigFailed(true) })
    return () => controller.abort()
  }, [configAttempt])

  function reloadConfig() {
    setConfigFailed(false)
    setConfigAttempt(attempt => attempt + 1)
  }

  async function selectModel(modelId: string) {
    const parsed = ModelPreference.safeParse({ modelId })
    if (!config || !parsed.success || saving.current || sending.current) return
    saving.current = true
    setSavingModel(true)
    setModelError('')
    setRetryModel(null)
    try {
      const response = await fetch('/api/model-preference', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(parsed.data),
      })
      if (!response.ok) throw Error('Preference unavailable')
      const saved = ModelPreference.parse(await response.json())
      if (saved.modelId !== modelId) throw Error('Mismatched preference')
      setConfig(current => current ? { ...current, modelId: saved.modelId } : current)
    } catch {
      setModelError('Could not save the model. Your previous selection was kept.')
      setRetryModel(modelId)
    } finally { saving.current = false; setSavingModel(false) }
  }

  const validation = OriginalText.safeParse(text)
  const visibleResult = result?.originalText === text ? result : null
  const canCorrect = config?.available === true && config.modelId !== null && validation.success && !pending && !savingModel

  async function correct() {
    if (sending.current || saving.current || !canCorrect || !config?.modelId) return
    const original = text
    const modelId = config.modelId
    const correctionId = association.current?.original === original ? association.current.correctionId : undefined
    if (!correctionId) association.current = null
    sending.current = true
    setPending(true)
    setResult(null)
    setError(null)
    setCopyFeedback(null)
    try {
      const response = await fetch('/api/corrections', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(CorrectionInput.parse({ text: original, modelId, correctionId })),
      })
      const payload: unknown = await response.json()
      if (!response.ok) {
        const failure = CorrectionFailure.safeParse(payload)
        if (failure.success && failure.data.correctionId) {
          association.current = { original, correctionId: failure.data.correctionId }
        } else if (failure.success && failure.data.error.code === 'INVALID_INPUT') association.current = null
        setError({ original, message: failure.success ? ERROR_MESSAGES[failure.data.error.code]
          : 'Could not complete correction. You can try again.' })
        return
      }
      const value = CorrectionSuccess.parse(payload)
      if (value.originalText !== original || value.modelId !== modelId
        || (correctionId && value.correctionId !== correctionId)) throw Error('Mismatched correction')
      association.current = { original, correctionId: value.correctionId }
      setResultView('changes')
      setResult(value)
    } catch {
      setError({ original, message: 'Could not complete correction. Your text was kept. You can try again.' })
    } finally { sending.current = false; setPending(false) }
  }

  async function copy() {
    if (!visibleResult || writing.current) return
    const original = visibleResult.originalText
    writing.current = true
    setCopying(true)
    setCopyFeedback(null)
    try {
      const outcome = await writeClipboardText(visibleResult.correctedText)
      if (!outcome.success) setResultView('text')
      setCopyFeedback({ original, message: outcome.message })
    } finally { writing.current = false; setCopying(false) }
  }

  const availability = configFailed ? 'Could not connect to the correction server.'
    : !config ? 'Connecting...' : !config.available ? ERROR_MESSAGES.NOT_CONFIGURED : ''
  const validationMessage = text && !validation.success ? validation.error.issues[0]?.message ?? '' : ''
  return { config, configFailed, reloadConfig, savingModel, selectModel, modelError, retryModel,
    pending, visibleResult, resultView, setResultView, canCorrect, correct, copy, copying, availability,
    validationMessage, error: error?.original === text ? error.message : '',
    copyFeedback: copyFeedback?.original === text ? copyFeedback.message : '',
    draftChanged: result !== null && visibleResult === null }
}
