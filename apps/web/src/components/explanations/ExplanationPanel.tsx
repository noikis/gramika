import { useEffect, useId, useRef, useState } from 'react'
import type { ExplanationInput } from '@gramota/contracts'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { useLocale } from '../../i18n/use-locale'
import { SpeechButton } from '../ui/speech-button'
import { TranslationAction } from '../translation/TranslationAction'
import { ExplanationApiError, fetchExplanation } from '../../api/explanations'
import { selectedTextWithin, type TranslationController } from './explanation-shared'

type Outcome = { explanation: string | null; error: string | null }
export function ExplanationPanel({
  selection,
  translation,
}: {
  selection: ExplanationInput
  translation?: TranslationController
}) {
  const { t } = useLocale()
  const [attempt, setAttempt] = useState({ number: 0, isGenerate: false })
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const body = JSON.stringify(selection)
  const bodyId = useId()
  const bodyRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const explanation = await fetchExplanation(
          JSON.parse(body) as ExplanationInput,
          attempt.isGenerate,
          controller.signal,
        )
        if (!controller.signal.aborted) setOutcome({ explanation, error: null })
      } catch (cause) {
        if (!controller.signal.aborted)
          setOutcome({
            explanation: null,
            error:
              cause instanceof ExplanationApiError
                ? cause.message
                : 'Could not load the explanation. Please try again.',
          })
      }
    }
    void load()
    return () => controller.abort()
  }, [body, attempt])

  function request(isGenerate: boolean) {
    setOutcome(null)
    setAttempt((current) => ({ number: current.number + 1, isGenerate }))
  }

  return (
    <div className="explanation-panel" aria-busy={outcome === null}>
      {outcome?.explanation ? (
        <>
          <div className="explanation-heading">
            <p className="explanation-label">{t('explanation')}</p>
            <div className="explanation-actions">
              <SpeechButton
                sourceId={`explanation-${bodyId}`}
                lang="ru-RU"
                getSelection={() => selectedTextWithin(bodyRef.current)}
                getText={() =>
                  selectedTextWithin(bodyRef.current) ??
                  bodyRef.current?.textContent ??
                  outcome.explanation ??
                  ''
                }
              />
              {translation && (
                <TranslationAction
                  scope="explanation"
                  getSelection={() => selectedTextWithin(bodyRef.current)}
                  getText={() => bodyRef.current?.textContent ?? outcome.explanation ?? ''}
                  translation={translation}
                />
              )}
            </div>
          </div>
          <p ref={bodyRef} className="explanation-text" lang="ru" role="status">
            {outcome.explanation}
          </p>
        </>
      ) : (
        <>
          <Button
            className="explain-button"
            type="button"
            variant="secondary"
            disabled={outcome === null}
            onClick={() => request(outcome?.error ? attempt.isGenerate : true)}
          >
            <Icon name="info" />
            {outcome === null
              ? attempt.isGenerate
                ? t('loading')
                : t('loading')
              : outcome.error
                ? t('retry')
                : t('explain')}
          </Button>
          {outcome?.error && (
            <p role="alert" className="history-error">
              {outcome.error}
            </p>
          )}
        </>
      )}
    </div>
  )
}

