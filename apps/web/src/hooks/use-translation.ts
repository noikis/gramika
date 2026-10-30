import { useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  TranslationScope,
  TranslationSource,
  TranslationTarget,
  type TranslationErrorCode,
} from '@gramota/contracts'
import { requestTranslation, TranslationApiError } from '../api/translations'
import type { SavedTranslation } from '../lib/workspace-storage'
import { useLocale } from '../i18n/use-locale'

export const TRANSLATION_TARGET_KEY = 'gramika.translation-target'
const DEFAULT_TRANSLATION_SOURCE = TranslationSource.enum.ru

function defaultTarget(locale: string): TranslationTarget {
  return locale === 'fr' ? TranslationTarget.enum.fr : TranslationTarget.enum.en
}

function loadTarget(locale: string): TranslationTarget {
  try {
    const value = localStorage.getItem(TRANSLATION_TARGET_KEY)
    return TranslationTarget.safeParse(value).success
      ? (value as TranslationTarget)
      : defaultTarget(locale)
  } catch {
    return defaultTarget(locale)
  }
}

function errorMessageKey(
  code: TranslationErrorCode,
):
  | 'translationInvalidInput'
  | 'translationNotConfigured'
  | 'translationUnavailable'
  | 'translationInvalidResponse'
  | 'translationTimeout' {
  if (code === 'INVALID_INPUT') return 'translationInvalidInput'
  if (code === 'NOT_CONFIGURED') return 'translationNotConfigured'
  if (code === 'INVALID_RESPONSE') return 'translationInvalidResponse'
  if (code === 'TIMEOUT') return 'translationTimeout'
  return 'translationUnavailable'
}

export function useTranslation(initial: SavedTranslation | null, locale: string) {
  const { message } = useLocale()
  const [target, setTargetState] = useState<TranslationTarget>(() => loadTarget(locale))
  const [source, setSourceState] = useState<TranslationSource>(
    () => initial?.source ?? DEFAULT_TRANSLATION_SOURCE,
  )
  const [saved, setSaved] = useState<SavedTranslation | null>(initial)
  const [isOpen, setOpen] = useState(Boolean(initial))
  const [isClosing, setIsClosing] = useState(false)
  const closingTimer = useRef<number | null>(null)
  const [request, setRequest] = useState<{
    scope: TranslationScope
    text: string
    source: TranslationSource
    target: TranslationTarget
  } | null>(null)
  const query = useQuery({
    queryKey: request
      ? ['translation', request.scope, request.text, request.source, request.target]
      : ['translation', 'idle'],
    queryFn: ({ signal }) =>
      requestTranslation(
        {
          text: request!.text,
          source: request!.source,
          target: request!.target,
          scope: request!.scope,
        },
        signal,
      ),
    enabled: request !== null,
    staleTime: Infinity,
    gcTime: 30 * 60 * 1000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  function swapLanguages(nextSource: TranslationSource, nextTarget: TranslationTarget) {
    const hasResult = Boolean(saved?.translatedText.trim())
    setSourceState(nextSource)
    setTargetState(nextTarget)
    setRequest(null)
    if (saved) {
      setSaved({
        ...saved,
        source: nextSource,
        target: nextTarget,
        sourceText: hasResult ? saved.translatedText : saved.sourceText,
        translatedText: hasResult ? saved.sourceText : '',
      })
    }
    try {
      localStorage.setItem(TRANSLATION_TARGET_KEY, nextTarget)
    } catch {
      // Keep the preference in memory when storage is unavailable.
    }
  }

  function setTarget(value: TranslationTarget) {
    if (value === source) {
      swapLanguages(target, source)
      return
    }
    setTargetState(value)
    setRequest(null)
    if (saved) setSaved({ ...saved, target: value, translatedText: '' })
    try {
      localStorage.setItem(TRANSLATION_TARGET_KEY, value)
    } catch {
      // Keep the preference in memory when storage is unavailable.
    }
  }

  function resetTarget() {
    try {
      localStorage.removeItem(TRANSLATION_TARGET_KEY)
    } catch {
      // Keep the default active for this session.
    }
    setTargetState(defaultTarget(locale))
  }

  function clear() {
    if (closingTimer.current !== null) window.clearTimeout(closingTimer.current)
    setIsClosing(false)
    setRequest(null)
    setSaved(null)
    setOpen(false)
  }

  function close() {
    if (closingTimer.current !== null) window.clearTimeout(closingTimer.current)
    setIsClosing(true)
    setOpen(false)
    closingTimer.current = window.setTimeout(() => {
      setIsClosing(false)
      closingTimer.current = null
    }, 300)
  }

  function updateSourceText(text: string) {
    setRequest(null)
    if (saved) setSaved({ ...saved, sourceText: text, translatedText: '' })
  }

  function setSource(value: TranslationSource) {
    if (value === target) {
      swapLanguages(value, source)
      return
    }
    setSourceState(value)
    setRequest(null)
    if (saved) setSaved({ ...saved, source: value, translatedText: '' })
  }

  function translate(scope: TranslationScope, sourceText: string, selectedText?: string) {
    const text = selectedText?.trim() || sourceText.trim()
    if (!text || query.isFetching) return
    setOpen(true)
    setIsClosing(false)
    setSaved({ scope, sourceText: text, source, target, translatedText: '' })
    setRequest({ scope, text, source, target })
  }

  const activeSaved = useMemo(
    () => (saved ? { ...saved, translatedText: query.data?.text ?? saved.translatedText } : null),
    [query.data?.text, saved],
  )
  const error = query.error
    ? query.error instanceof TranslationApiError
      ? message(errorMessageKey(query.error.code))
      : message('translationFailed')
    : ''

  return {
    target,
    setTarget,
    source,
    setSource,
    updateSourceText,
    resetTarget,
    saved: activeSaved,
    isOpen,
    isClosing,
    pending: query.isFetching,
    error,
    translate,
    close,
    clear,
    workspace: activeSaved,
  }
}
