import { useEffect, useMemo, useState } from 'react'
import { Sheet } from 'react-modal-sheet'
import { CorrectionMode, type ExplanationInput } from '@gramota/contracts'
import type { ChangeGroup } from '@gramota/text-diff'
import { fetchExplanation, ExplanationApiError } from '../../api/explanations'
import { explanationSelection } from '../../lib/text-diff'
import { useLocale } from '../../i18n/use-locale'
import { Icon } from '../ui/icon'
import { Button } from '../ui/button'

export type CorrectionSheetPage = 'variant' | 'corrections' | 'explain' | null

export type CorrectionSheetProps = {
  page: CorrectionSheetPage
  onClose: () => void
  onBack: () => void
  canGoBack: boolean
  onRequestVariant: (mode: 'strict' | 'gentle-rewrite') => void
  isPending: boolean
  groups: ChangeGroup[]
  requestId: string | null
  originalText: string
  correctedText: string
  mode: 'strict' | 'gentle-rewrite'
  variantIndex: number
  variantTotal: number
  selectedGroup: ChangeGroup | null
  onExplain: (group: ChangeGroup) => void
}

function visibleFragment(text: string, empty: string) {
  if (!text) return empty
  const value = /^\s+$/u.test(text) ? text.replace(/ /gu, '·') : text
  return value.replace(/\t/gu, '⇥').replace(/\n/gu, '↵\n')
}

function CorrectionExplanation({
  requestId,
  group,
  originalText,
  correctedText,
}: {
  requestId: string
  group: ChangeGroup
  originalText: string
  correctedText: string
}) {
  const { t } = useLocale()
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<{
    isLoading: boolean
    text: string | null
    error: string | null
  }>({ isLoading: true, text: null, error: null })
  const selection: ExplanationInput = useMemo(
    () => explanationSelection(requestId, group),
    [requestId, group],
  )

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false
    async function load() {
      try {
        const saved = await fetchExplanation(selection, false, controller.signal)
        const text = saved ?? (await fetchExplanation(selection, true, controller.signal))
        if (!cancelled) setState({ isLoading: false, text, error: null })
      } catch (cause) {
        if (!cancelled && !controller.signal.aborted)
          setState({
            isLoading: false,
            text: null,
            error:
              cause instanceof ExplanationApiError ? cause.message : t('explanationFailed'),
          })
      }
    }
    void load()
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [selection, attempt, t])

  const original = visibleFragment(
    originalText.slice(group.originalRange.start, group.originalRange.end),
    t('removedText'),
  )
  const corrected = visibleFragment(
    correctedText.slice(group.correctedRange.start, group.correctedRange.end),
    t('removedText'),
  )

  return (
    <div className="mobile-explanation" aria-busy={state.isLoading}>
      <p className="mobile-explanation-change">
        <span>{original}</span> <span aria-hidden="true">→</span>{' '}
        <strong>{corrected}</strong>
      </p>
      {state.isLoading && <p className="mobile-sheet-loading" role="status">{t('loading')}</p>}
      {state.text && <p className="mobile-explanation-text" role="status">{state.text}</p>}
      {state.error && (
        <div className="mobile-explanation-error">
          <p role="alert">{state.error}</p>
          <Button variant="secondary" type="button" onClick={() => {
            setState({ isLoading: true, text: null, error: null })
            setAttempt((count) => count + 1)
          }}>{t('retry')}</Button>
        </div>
      )}
    </div>
  )
}

export function CorrectionSheet({
  page,
  onClose,
  onBack,
  canGoBack,
  onRequestVariant,
  isPending,
  groups,
  requestId,
  originalText,
  correctedText,
  mode,
  variantIndex,
  variantTotal,
  selectedGroup,
  onExplain,
}: CorrectionSheetProps) {
  const { t, message } = useLocale()
  const isOpen = page !== null
  const title =
    page === 'variant'
      ? t('moreVariant')
      : page === 'corrections'
        ? `${t('correctionsList')} (${groups.length})`
        : t('explanation')

  useEffect(() => {
    if (!isOpen) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  return (
    <Sheet
      unstyled
      isOpen={isOpen}
      onClose={onClose}
      detent="content"
      snapPoints={[0, 1]}
      initialSnap={1}
      dragCloseThreshold={0.4}
      dragVelocityThreshold={500}
      className="correction-sheet-root"
      style={{ zIndex: 45 }}
    >
      <Sheet.Container
        className="correction-sheet-container"
        role="dialog"
        aria-modal="true"
        aria-hidden={!isOpen}
        aria-label={title}
      >
        <Sheet.Header className="correction-sheet-header">
          <Sheet.DragIndicator className="correction-sheet-grab" />
          <div className="correction-sheet-heading">
            {page === 'explain' && canGoBack && (
              <button type="button" className="correction-sheet-back" onClick={onBack} aria-label={t('previous')}>
                <Icon name="chevronLeft" />
              </button>
            )}
            <h2>{title}</h2>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              className="correction-sheet-close"
            >
              <Icon name="close" />
            </button>
          </div>
          {page === 'variant' && <p className="correction-sheet-subtitle">{t('chooseMode')}</p>}
          {page === 'corrections' && (
            <p className="correction-sheet-subtitle">
              {message('variantCounter', { current: variantIndex, total: variantTotal })} ·{' '}
              {mode === CorrectionMode.enum.strict ? t('strictMode') : t('rewriteMode')}
            </p>
          )}
        </Sheet.Header>
        <Sheet.Content className="correction-sheet-content" disableDrag>
          {page === 'variant' && (
            <div className="correction-variant-choices">
              {CorrectionMode.options.map((option) => (
                <button
                  type="button"
                  key={option}
                  className="correction-variant-choice"
                  disabled={isPending}
                  onClick={() => onRequestVariant(option)}
                >
                  <span className="correction-variant-symbol">
                    <Icon name={option === 'strict' ? 'check' : 'pen'} />
                  </span>
                  <span className="correction-variant-text">
                    <strong>{option === 'strict' ? t('strictMode') : t('rewriteMode')}</strong>
                    <span>
                      {option === 'strict' ? t('strictDescription') : t('rewriteDescription')}
                    </span>
                  </span>
                  <Icon name="chevronRight" />
                </button>
              ))}
              <p className="correction-variant-note">{t('keepVariants')}</p>
            </div>
          )}
          {page === 'corrections' && (
            <ol className="mobile-corrections-list">
              {groups.map((group, index) => (
                <li key={group.id} className="mobile-correction-item">
                  <span className="mobile-correction-number">{index + 1}</span>
                  <p className="mobile-correction-description">
                    {visibleFragment(
                      originalText.slice(group.originalRange.start, group.originalRange.end),
                      t('noOriginalText'),
                    )}
                    {' '}→{' '}
                    {visibleFragment(
                      correctedText.slice(group.correctedRange.start, group.correctedRange.end),
                      t('removedText'),
                    )}
                  </p>
                  <button type="button" className="mobile-correction-explain" onClick={() => onExplain(group)}>
                    <Icon name="star4" /> {t('explain')}
                  </button>
                </li>
              ))}
            </ol>
          )}
          {page === 'explain' && selectedGroup && requestId && (
            <>
              <CorrectionExplanation
                key={`${requestId}-${selectedGroup.id}`}
                requestId={requestId}
                group={selectedGroup}
                originalText={originalText}
                correctedText={correctedText}
              />
              <button type="button" className="correction-sheet-done" onClick={onClose}>
                {t('done')}
              </button>
            </>
          )}
        </Sheet.Content>
      </Sheet.Container>
      <Sheet.Backdrop className="correction-sheet-backdrop" onClick={onClose} />
    </Sheet>
  )
}
