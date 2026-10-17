import { useEffect, useRef, useState } from 'react'
import { CorrectionConfig, CorrectionFailure, CorrectionInput, CorrectionSuccess,
  ERROR_MESSAGES, type CorrectionResult, type PublicConfig } from '@gramota/contracts'
import type { ResultViewMode } from './components/result-view'
import { writeClipboardText } from './lib/clipboard'

type Feedback = { original: string; message: string }

export function useCorrection(text: string) {
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const [configFailed, setConfigFailed] = useState(false)
  const [pending, setPending] = useState(false)
  const [result, setResult] = useState<CorrectionResult | null>(null)
  const [resultView, setResultView] = useState<ResultViewMode>('changes')
  const [error, setError] = useState<Feedback | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<Feedback | null>(null)
  const [copying, setCopying] = useState(false)
  const sending = useRef(false)
  const writing = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/correction-config', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw Error('Configuration unavailable')
      const value = CorrectionConfig.parse(await response.json())
      if (!controller.signal.aborted) setConfig(value)
    }).catch(() => { if (!controller.signal.aborted) setConfigFailed(true) })
    return () => controller.abort()
  }, [])

  const validation = CorrectionInput.safeParse({ text })
  const visibleResult = result?.originalText === text ? result : null
  const canCorrect = config?.available === true && validation.success && !pending && !visibleResult

  async function correct() {
    if (sending.current || !canCorrect) return
    const original = text
    sending.current = true
    setPending(true)
    setResult(null)
    setError(null)
    setCopyFeedback(null)
    try {
      const response = await fetch('/api/corrections', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: original }),
      })
      const payload: unknown = await response.json()
      if (!response.ok) {
        const failure = CorrectionFailure.safeParse(payload)
        setError({ original, message: failure.success ? ERROR_MESSAGES[failure.data.error.code]
          : 'Could not complete correction. You can try again.' })
        return
      }
      const value = CorrectionSuccess.parse(payload)
      if (value.originalText !== original) throw Error('Mismatched original')
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
  return { config, pending, visibleResult, resultView, setResultView, canCorrect, correct, copy, copying, availability,
    validationMessage, error: error?.original === text ? error.message : '',
    copyFeedback: copyFeedback?.original === text ? copyFeedback.message : '',
    draftChanged: result !== null && visibleResult === null }
}
