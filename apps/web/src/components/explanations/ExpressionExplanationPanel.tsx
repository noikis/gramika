import { useId, useRef, useState, type ReactNode } from 'react'
import type { ExpressionExplanationInput } from '@gramota/contracts'
import { Button } from '../ui/button'
import { Icon } from '../ui/icon'
import { useLocale } from '../../i18n/use-locale'
import { SpeechButton } from '../ui/speech-button'
import { TranslationAction } from '../translation/TranslationAction'
import { ExplanationApiError, generateExpressionExplanation } from '../../api/explanations'
import { selectedTextWithin, type TranslationController } from './explanation-shared'

export function ExpressionExplanationPanel({
  selection,
  translation,
  actions,
}: {
  selection: ExpressionExplanationInput
  translation?: TranslationController
  actions?: ReactNode
}) {
  const { t } = useLocale()
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [explanation, setExplanation] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const bodyId = useId()
  const bodyRef = useRef<HTMLParagraphElement>(null)
  async function explain() {
    setState('loading')
    setError(null)
    try {
      setExplanation(await generateExpressionExplanation(selection))
      setState('done')
    } catch (cause) {
      setError(
        cause instanceof ExplanationApiError ? cause.message : 'Could not explain the selection.',
      )
      setState('error')
    }
  }

  const explainAction = (
    <Button
      className="explain-button"
      type="button"
      variant="secondary"
      disabled={state === 'loading'}
      onClick={() => void explain()}
    >
      <Icon name="info" />
      {state === 'loading' ? t('loading') : state === 'error' ? t('retry') : t('explain')}
    </Button>
  )

  return (
    <div
      className={actions ? 'expression-tools-panel' : 'explanation-panel'}
      aria-busy={state === 'loading'}
    >
      {actions && (
        <div className="speech-row expression-action-row">
          {actions}
          {state !== 'done' && explainAction}
        </div>
      )}
      {state === 'done' && explanation ? (
        <div className={actions ? 'explanation-panel' : undefined}>
          <div className="explanation-heading">
            <p className="explanation-label">{t('explanation')}</p>
            <div className="explanation-actions">
              <SpeechButton
                sourceId={`expression-explanation-${bodyId}`}
                lang="ru-RU"
                getSelection={() => selectedTextWithin(bodyRef.current)}
                getText={() =>
                  selectedTextWithin(bodyRef.current) ?? bodyRef.current?.textContent ?? explanation
                }
              />
              {translation && (
                <TranslationAction
                  scope="explanation"
                  getSelection={() => selectedTextWithin(bodyRef.current)}
                  getText={() => bodyRef.current?.textContent ?? explanation}
                  translation={translation}
                />
              )}
            </div>
          </div>
          <p ref={bodyRef} className="explanation-text" lang="ru" role="status">
            {explanation}
          </p>
        </div>
      ) : (
        <>
          {!actions && explainAction}
          {error && (
            <p role="alert" className="history-error">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  )
}
