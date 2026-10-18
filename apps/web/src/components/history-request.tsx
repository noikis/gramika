import { useId, useRef, useState } from 'react'
import type { HistoryRequest as SavedRequest } from '@gramota/contracts'
import { formatCost, formatCount, formatDate, formatTime, modelName } from '../lib/history-format'
import { writeClipboardText } from '../lib/clipboard'
import { notify } from '../lib/notifications'
import { ResultView, type ResultViewMode } from './result-view'
import { Button } from './ui/button'

function RequestMetrics({ request }: { request: SavedRequest }) {
  const primary = [
    ['Generation time', formatTime(request.generationTimeMs)],
    ['Input tokens', formatCount(request.inputTokens)],
    ['Output tokens', formatCount(request.outputTokens)],
    ['Cost', formatCost(request.costUsd)],
  ]
  const routing = [
    ['Requested model', request.requestedModel],
    ['Returned model', request.returnedModel],
    ['Provider', request.provider],
    ['Routing strategy', request.routingStrategy],
    ['Routing region', request.routingRegion],
    ['Routing attempt', formatCount(request.routingAttempt)],
    ['Bring your own key', request.isByok === null ? null : request.isByok ? 'Yes' : 'No'],
  ]
  const usage = [
    ['Total tokens', formatCount(request.totalTokens)],
    ['Reasoning tokens', formatCount(request.reasoningTokens)],
    ['Cache-read tokens', formatCount(request.cachedInputTokens)],
    ['Cache-write tokens', formatCount(request.cacheWriteTokens)],
    ['Upstream cost', formatCost(request.upstreamInferenceCostUsd)],
    ['Upstream input cost', formatCost(request.upstreamPromptCostUsd)],
    ['Upstream output cost', formatCost(request.upstreamCompletionCostUsd)],
  ]
  const diagnostics = [
    ['Started', formatDate(request.startedAt)],
    ['Ended', formatDate(request.endedAt)],
    ['App request time', formatTime(request.appRequestTimeMs)],
    ['OpenRouter generation ID', request.openrouterGenerationId],
    ['Finish reason', request.finishReason],
    ['Prompt version', request.promptVersion],
    ...(request.errorCode ? [['Error code', request.errorCode]] : []),
  ]
  return (
    <>
      <dl className="request-metrics">
        {primary.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <details className="request-more">
        <summary>
          Request details
          <span className="disclosure-sign" aria-hidden="true" />
        </summary>
        <div className="detail-groups">
          {[
            { title: 'Model & routing', facts: routing },
            { title: 'Usage & cost', facts: usage },
            { title: 'Timing & diagnostics', facts: diagnostics },
          ].map(({ title, facts }) => (
            <section key={title} aria-label={title}>
              <h3>{title}</h3>
              <dl className="request-facts">
                {facts.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value ?? 'Unavailable'}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <section className="parameters-section" aria-label="Sent parameters">
            <h3>Sent parameters</h3>
            <pre className="request-parameters">{JSON.stringify(request.parameters, null, 2)}</pre>
          </section>
        </div>
      </details>
    </>
  )
}

export function HistoryRequest({ request, original }: { request: SavedRequest; original: string }) {
  const labelId = useId()
  const [view, setView] = useState<ResultViewMode>('changes')
  const [copying, setCopying] = useState(false)
  const writing = useRef(false)
  const success = request.status === 'succeeded' && request.correctedText !== null

  async function copy() {
    if (!success || writing.current) return
    writing.current = true
    setCopying(true)
    try {
      const outcome = await writeClipboardText(request.correctedText!)
      if (!outcome.success) setView('text')
      notify(outcome.message, outcome.success)
    } finally {
      writing.current = false
      setCopying(false)
    }
  }

  return (
    <section className="history-request" aria-labelledby={labelId}>
      {success ? (
        <ResultView
          result={{ originalText: original, correctedText: request.correctedText! }}
          view={view}
          onViewChange={setView}
          labelId={labelId}
          title={modelName(request.requestedModel)}
        />
      ) : (
        <>
          <div className="editor-heading">
            <h2 id={labelId}>{modelName(request.requestedModel)}</h2>
          </div>
          <p className="history-status">{request.status === 'pending' ? 'Pending' : 'Failed'}</p>
          {request.errorMessage && <p className="history-error">{request.errorMessage}</p>}
        </>
      )}
      {success && original === request.correctedText && (
        <p className="clipboard-feedback">No changes.</p>
      )}
      {success && (
        <>
          <div className="result-actions">
            <Button type="button" disabled={copying} onClick={copy}>
              {copying ? 'Copying...' : 'Copy text'}
            </Button>
          </div>
        </>
      )}
      <RequestMetrics request={request} />
    </section>
  )
}
