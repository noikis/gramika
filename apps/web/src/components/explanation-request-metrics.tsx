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

function SelectionFragments({
  selection,
  original,
  corrected,
}: {
  selection: RecordedExplanationSelection
  original: string
  corrected: string
}) {
  if ('kind' in selection && selection.kind === 'expression') {
    return (
      <dl className="explanation-fragments">
        <div>
          <dt>
            Selected expression · {'source' in selection && selection.source === 'original' ? 'original' : 'edited'} text
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
          <dt>{selection.kind === 'move' ? 'Moved' : 'Selected change'}</dt>
          <dd lang="ru">
            {selection.originalSpans
              .map((range) => original.slice(range.start, range.end))
              .join(' · ') || '(nothing)'}{' '}
            →{' '}
            {selection.correctedSpans
              .map((range) => corrected.slice(range.start, range.end))
              .join(' · ') || '(nothing)'}
          </dd>
        </div>
      )}
      <div>
        <dt>Original</dt>
        <dd lang="ru">{before || '(nothing)'}</dd>
      </div>
      <div>
        <dt>Corrected</dt>
        <dd lang="ru">{after || '(nothing)'}</dd>
      </div>
    </dl>
  )
}

export function ExplanationRequestMetrics({
  request,
  original,
  rate,
  onLoaded,
}: {
  request: HistoryRequest
  original: string
  rate: number | null
  onLoaded: (metrics: ExplanationMetrics) => void
}) {
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
          onLoaded(value)
        }
      } catch {
        if (!controller.signal.aborted) setIsError(true)
      }
    }
    void load()
    return () => controller.abort()
  }, [request.id, retry, onLoaded])

  return (
    <section className="explanation-metrics" aria-label="Explanation requests">
      <h3>Explanation requests</h3>
      <p className="metric-caption">
        Each generated explanation has its own usage. Opening a saved explanation makes no new model
        call.
      </p>
      {isError ? (
        <div>
          <p role="alert">Could not load explanation metrics.</p>
          <Button
            variant="secondary"
            onClick={() => {
              setIsError(false)
              setRetry((value) => value + 1)
            }}
          >
            Retry metrics
          </Button>
        </div>
      ) : !data ? (
        <p role="status">Loading explanation metrics...</p>
      ) : (
        <>
          {data.attempts.length === 0 && data.legacySelections.length === 0 && (
            <p>No explanation requests recorded.</p>
          )}
          {data.attempts.map((attempt, index) => (
            <details className="explanation-attempt" key={attempt.id}>
              <summary>
                <Icon name="plus" className="disclosure-plus" />
                <Icon name="minus" className="disclosure-minus" />
                <span>
                  Explanation {index + 1} ·{' '}
                  {attempt.status === 'succeeded'
                    ? 'Completed'
                    : attempt.status === 'failed'
                      ? 'Failed'
                      : attempt.status === 'interrupted'
                        ? 'Interrupted'
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
                <p className="history-error">
                  This request was interrupted. Final usage and cost may be unavailable.
                </p>
              )}
              <MetricFacts request={attempt} rate={rate} />
            </details>
          ))}
          {data.legacySelections.map((selection) => (
            <details className="explanation-attempt" key={JSON.stringify(selection)}>
              <summary>
                <Icon name="plus" className="disclosure-plus" />
                <Icon name="minus" className="disclosure-minus" />
                Previous explanation · metrics not recorded
              </summary>
              <SelectionFragments
                selection={selection}
                original={original}
                corrected={request.correctedText!}
              />
              <p className="metric-caption">
                This explanation was saved before metrics were recorded. Its original usage and cost
                are unavailable.
              </p>
            </details>
          ))}
        </>
      )}
    </section>
  )
}
