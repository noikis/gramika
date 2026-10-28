import { MetricFacts } from './request-metric-facts'
import { useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import type { ExplanationMetrics, HistoryRequest as SavedRequest } from '@gramota/contracts'
import { formatDate, shortModelName } from '../lib/history-format'
import { writeClipboardText } from '../lib/clipboard'
import { notify } from '../lib/notifications'
import { ResultView, type ResultViewMode } from './result-view'
import { ExplanationRequestMetrics } from './explanation-request-metrics'
import { Button } from './ui/button'
import { Icon } from './ui/icon'
import { useLocale } from '../hooks/use-locale'

function isOutsideDialog(event: PointerEvent<HTMLDialogElement>) {
  const bounds = event.currentTarget.getBoundingClientRect()
  return (
    event.target === event.currentTarget &&
    (event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom)
  )
}

export function RequestMetrics({
  request,
  rate,
  actions,
  entryAction,
  original,
}: {
  original: string
  request: SavedRequest
  rate: number | null
  actions?: ReactNode
  entryAction?: ReactNode
}) {
  const { t, locale, message } = useLocale()
  const [isOpen, setIsOpen] = useState(false)
  const [explanationMetrics, setExplanationMetrics] = useState<ExplanationMetrics | null>(null)
  const [metricsError, setMetricsError] = useState(false)
  const hasExplanations =
    explanationMetrics !== null &&
    (explanationMetrics.attempts.length > 0 || explanationMetrics.legacySelections.length > 0)
  function sum(field: 'costUsd' | 'inputTokens' | 'outputTokens') {
    if (!explanationMetrics || explanationMetrics.legacySelections.length > 0) return null
    const values = [request, ...explanationMetrics.attempts].map((item) => item[field])
    return values.some((value) => value === null)
      ? null
      : values.reduce<number>((total, value) => total + value!, 0)
  }
  const totals = hasExplanations
    ? {
        costUsd: sum('costUsd'),
        inputTokens: sum('inputTokens'),
        outputTokens: sum('outputTokens'),
      }
    : undefined
  const dialog = useRef<HTMLDialogElement>(null)
  const opener = useRef<HTMLButtonElement>(null)
  const isBackdropStart = useRef(false)
  const titleId = useId()
  useEffect(() => {
    const element = dialog.current
    return () => {
      element?.close()
    }
  }, [])
  return (
    <>
      <div className="request-actions">
        {actions}
        <Button
          type="button"
          variant="secondary"
          ref={opener}
          onClick={() => {
            setExplanationMetrics(null)
            setMetricsError(false)
            dialog.current?.showModal()
            setIsOpen(true)
          }}
        >
          <Icon name="info" /> {t('details')}
        </Button>
        {entryAction}
      </div>
      <dialog
        ref={dialog}
        className="request-sheet"
        aria-labelledby={titleId}
        onPointerDown={(event) => {
          isBackdropStart.current = isOutsideDialog(event)
        }}
        onPointerUp={(event) => {
          if (isBackdropStart.current && isOutsideDialog(event)) event.currentTarget.close()
          isBackdropStart.current = false
        }}
        onPointerCancel={() => {
          isBackdropStart.current = false
        }}
        onClose={() => {
          setIsOpen(false)
          if (opener.current?.isConnected) opener.current.focus()
        }}
      >
        <header className="sheet-heading">
          <div>
            <h2 id={titleId}>{shortModelName(request.requestedModel)}</h2>
            <p>
              {message('requestDetails')} ·{' '}
              {request.mode === 'strict' ? t('strictMode') : t('rewriteMode')}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>
            <Icon name="close" /> {t('close')}
          </Button>
        </header>
        <section className="request-summary" aria-label={message('correctionMetrics')}>
          <h3>{message('correctionMetrics')}</h3>
          <p className="metric-caption">
            {formatDate(request.startedAt, locale)} ·{' '}
            {request.status === 'succeeded'
              ? message('completed')
              : request.status === 'failed'
                ? 'Failed'
                : 'Pending'}
          </p>
          {request.errorCode && (
            <p className="history-error">{request.errorMessage ?? request.errorCode}</p>
          )}
          {hasExplanations && (
            <p className="metric-caption">
              {message('totalsNote')}
              {Object.values(totals!).some((value) => value === null) &&
                ` ${message('totalsUnavailable')}`}
            </p>
          )}
          {!isOpen && <MetricFacts request={request} rate={rate} totals={totals} />}
          {isOpen && !explanationMetrics && !metricsError && (
            <p role="status">{message('loadingDetails')}</p>
          )}
          {isOpen && metricsError && (
            <p role="alert" className="history-error">
              {message('metricsLoadFailed')}
            </p>
          )}
          {isOpen && explanationMetrics && (
            <MetricFacts request={request} rate={rate} totals={totals} />
          )}
        </section>
        {isOpen && request.status === 'succeeded' && (
          <ExplanationRequestMetrics
            request={request}
            original={original}
            rate={rate}
            onLoaded={setExplanationMetrics}
            onError={setMetricsError}
          />
        )}
      </dialog>
    </>
  )
}

export function HistoryRequest({
  request,
  original,
  rate,
  onCopyingChange,
  entryAction,
  multipleResults = false,
}: {
  request: SavedRequest
  original: string
  rate: number | null
  onCopyingChange: (isCopying: boolean) => void
  entryAction?: ReactNode
  multipleResults?: boolean
}) {
  const { t, locale, message } = useLocale()
  const labelId = useId()
  const [view, setView] = useState<ResultViewMode>('changes')
  const [copying, setCopying] = useState(false)
  const writing = useRef(false)
  const success = request.status === 'succeeded' && request.correctedText !== null

  async function copy() {
    if (!success || writing.current) return
    writing.current = true
    onCopyingChange(true)
    setCopying(true)
    try {
      const outcome = await writeClipboardText(request.correctedText!)
      if (!outcome.success) setView('text')
      notify(message(outcome.messageKey), outcome.success)
    } finally {
      writing.current = false
      onCopyingChange(false)
      setCopying(false)
    }
  }

  const requestActions = (
    <RequestMetrics
      request={request}
      original={original}
      rate={rate}
      entryAction={entryAction}
      actions={
        success && (
          <Button type="button" disabled={copying} onClick={copy}>
            <Icon name="copy" /> {copying ? t('copying') : t('copy')}
          </Button>
        )
      }
    />
  )

  return (
    <section
      className={`history-request${multipleResults ? ' multiple-results' : ''}${request.status === 'failed' ? ' request-failed' : ''}`}
      aria-labelledby={labelId}
    >
      <p className="history-request-caption">
        {request.mode === 'strict' ? t('strictMode') : t('rewriteMode')} ·{' '}
        {shortModelName(request.requestedModel)} ·{' '}
        <time dateTime={request.startedAt}>{formatDate(request.startedAt, locale)}</time>
      </p>
      {success ? (
        <ResultView
          result={{
            originalText: original,
            correctedText: request.correctedText!,
            requestId: request.id,
            mode: request.mode,
          }}
          view={view}
          onViewChange={setView}
          labelId={labelId}
          title={shortModelName(request.requestedModel)}
          actions={requestActions}
        />
      ) : (
        <>
          <div className="result-toolbar">
            <div className="editor-heading request-outcome-heading">
              {request.status === 'failed' && (
                <span className="request-outcome-badge">
                  <Icon name="error" /> {t('failed')}
                </span>
              )}
              <h2 id={labelId}>
                {shortModelName(request.requestedModel)}
                <span className="request-mode">
                  {' '}
                  · {request.mode === 'strict' ? t('strictMode') : t('rewriteMode')}
                </span>
              </h2>
            </div>
            {requestActions}
          </div>
          <p className="history-status">
            {request.status === 'pending' ? t('pending') : t('failed')}
          </p>
          {request.errorMessage && <p className="history-error">{request.errorMessage}</p>}
        </>
      )}
      {success && original === request.correctedText && (
        <p className="clipboard-feedback">{t('noChanges')}</p>
      )}
    </section>
  )
}
