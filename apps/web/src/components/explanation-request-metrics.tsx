import { Icon } from './ui/icon'
import { useEffect, useState } from 'react'
import {
  ExplanationMetrics,
  EXPLANATION_ERROR_MESSAGES,
  type RecordedExplanationSelection,
  type HistoryRequest,
} from '@gramota/contracts'
import { formatCost, formatDate, formatTime } from '../lib/history-format'
import { MetricFacts } from './request-metric-facts'
import { Button } from './ui/button'
import { useLocale } from '../hooks/use-locale'

function SelectionFragments({
  selection,
  original,
  corrected,
}: {
  selection: RecordedExplanationSelection
  original: string
  corrected: string
}) {
  const { message } = useLocale()
  if ('kind' in selection && selection.kind === 'expression') {
    return (
      <dl className="explanation-fragments">
        <div>
          <dt>
            {message('selectedExpression')} ·{' '}
            {'source' in selection && selection.source === 'original' ? 'original' : 'edited'} text
          </dt>
          <dd lang="ru">{selection.value}</dd>
        </div>
      </dl>
    )
  }
  const before = original.slice(selection.originalRange.start, selection.originalRange.end)
  const after = corrected.slice(selection.correctedRange.start, selection.correctedRange.end)
  return (
    <dl className="explanation-fragments">
      {'version' in selection && (
        <div>
          <dt>{selection.kind === 'move' ? message('moved') : message('selectedChange')}</dt>
          <dd lang="ru">
            {selection.originalSpans
              .map((range) => original.slice(range.start, range.end))
              .join(' · ') || message('nothing')}
            →{' '}
            {selection.correctedSpans
              .map((range) => corrected.slice(range.start, range.end))
              .join(' · ') || message('nothing')}
          </dd>
        </div>
      )}
      <div>
        <dt>Original</dt>
        <dd lang="ru">{before || message('nothing')}</dd>
      </div>
      <div>
        <dt>Corrected</dt>
        <dd lang="ru">{after || message('nothing')}</dd>
      </div>
    </dl>
  )
}

export function ExplanationRequestMetrics({
  request,
  original,
  rate,
  onLoaded,
  onError,
}: {
  request: HistoryRequest
  original: string
  rate: number | null
  onLoaded: (metrics: ExplanationMetrics) => void
  onError: (isError: boolean) => void
}) {
  const { t, message } = useLocale()
  const [data, setData] = useState<ExplanationMetrics | null>(null)
  const [isError, setIsError] = useState(false)
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/explanations/metrics', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ requestId: request.id }),
          signal: controller.signal,
        })
        if (!response.ok) throw Error('Metrics unavailable')
        const value = ExplanationMetrics.parse(await response.json())
        if (
          value.attempts.some((attempt) => attempt.selection.requestId !== request.id) ||
          value.legacySelections.some((selection) => selection.requestId !== request.id)
        )
          throw Error('Mismatched request metrics')
        if (!controller.signal.aborted) {
          setData(value)
          onError(false)
          onLoaded(value)
        }
      } catch {
        if (!controller.signal.aborted) {
          setIsError(true)
          onError(true)
        }
      }
    }
    void load()
    return () => controller.abort()
  }, [request.id, retry, onLoaded, onError])

  return (
    <section className="explanation-metrics" aria-label="Explanation requests">
      <h3>{t('explanationRequests')}</h3>
      <p className="metric-caption">{message('explanationUsageNote')}</p>
      {isError ? (
        <div>
          <p role="alert">{t('metricsUnavailable')}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setIsError(false)
              onError(false)
              setRetry((value) => value + 1)
            }}
          >
            {t('retry')}
          </Button>
        </div>
      ) : !data ? (
        <p role="status">{t('loading')}</p>
      ) : (
        <>
          {data.attempts.length === 0 && data.legacySelections.length === 0 && (
            <p>{t('noExplanationRequests')}</p>
          )}
          {data.attempts.map((attempt, index) => (
            <details className="explanation-attempt" key={attempt.id}>
              <summary>
                <Icon name="plus" className="disclosure-plus" />
                <Icon name="minus" className="disclosure-minus" />
                <span>
                  Explanation {index + 1} ·{' '}
                  {attempt.status === 'succeeded'
                    ? message('completed')
                    : attempt.status === 'failed'
                      ? 'Failed'
                      : attempt.status === 'interrupted'
                        ? message('interrupted')
                        : 'Pending'}
                </span>
                <span className="metric-caption">
                  {formatCost(attempt.costUsd, rate)} · {formatTime(attempt.appRequestTimeMs)}
                </span>
              </summary>
              <p className="metric-caption">
                <time dateTime={attempt.startedAt}>{formatDate(attempt.startedAt)}</time>
              </p>
              <SelectionFragments
                selection={attempt.selection}
                original={original}
                corrected={request.correctedText!}
              />
              {attempt.errorCode && (
                <p className="history-error">{EXPLANATION_ERROR_MESSAGES[attempt.errorCode]}</p>
              )}
              {attempt.status === 'interrupted' && (
                <p className="history-error">{t('interruptedRequest')}</p>
              )}
              <MetricFacts request={attempt} rate={rate} />
            </details>
          ))}
          {data.legacySelections.map((selection) => (
            <details className="explanation-attempt" key={JSON.stringify(selection)}>
              <summary>
                <Icon name="plus" className="disclosure-plus" />
                <Icon name="minus" className="disclosure-minus" />
                {t('previousExplanation')}
              </summary>
              <SelectionFragments
                selection={selection}
                original={original}
                corrected={request.correctedText!}
              />
              <p className="metric-caption">{t('savedExplanation')}</p>
            </details>
          ))}
        </>
      )}
    </section>
  )
}
