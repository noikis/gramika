import { useId, useRef, useState } from 'react'
import type { HistoryRequest as SavedRequest } from '@gramota/contracts'
import { formatCost, formatCount, formatDate, formatTime, modelName } from '../lib/history-format'
import { writeClipboardText } from '../lib/clipboard'
import { ResultView, type ResultViewMode } from './result-view'
import { Button } from './ui/button'

function RequestMetrics({ request }: { request: SavedRequest }) {
  const primary = [
    ['Generation time', formatTime(request.generationTimeMs)],
    ['Input', formatCount(request.inputTokens)], ['Output', formatCount(request.outputTokens)],
    ['Cost', formatCost(request.costUsd)],
  ]
  const secondary = [
    ['Requested model', request.requestedModel], ['Returned model', request.returnedModel],
    ['Provider', request.provider], ['Total tokens', formatCount(request.totalTokens)],
    ['Reasoning tokens', formatCount(request.reasoningTokens)], ['Cache-read tokens', formatCount(request.cachedInputTokens)],
    ['Cache-write tokens', formatCount(request.cacheWriteTokens)],
    ['Upstream cost', formatCost(request.upstreamInferenceCostUsd)],
    ['Upstream input cost', formatCost(request.upstreamPromptCostUsd)],
    ['Upstream output cost', formatCost(request.upstreamCompletionCostUsd)],
    ['OpenRouter generation ID', request.openrouterGenerationId], ['Finish reason', request.finishReason],
    ['Routing strategy', request.routingStrategy], ['Routing region', request.routingRegion],
    ['Routing attempt', formatCount(request.routingAttempt)],
    ['Bring your own key', request.isByok === null ? null : request.isByok ? 'Yes' : 'No'],
    ['Prompt version', request.promptVersion], ['Started', formatDate(request.startedAt)],
    ['Ended', formatDate(request.endedAt)], ['App request time', formatTime(request.appRequestTimeMs)],
  ]
  return <>
    <dl className="request-metrics">{primary.map(([label, value]) => (
      <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
    ))}</dl>
    <details className="request-more">
      <summary>Request details</summary>
      <dl className="request-facts">{secondary.map(([label, value]) => (
        <div key={label}><dt>{label}</dt><dd>{value ?? 'Unavailable'}</dd></div>
      ))}</dl>
      <h3>Sent parameters</h3>
      <pre className="request-parameters">{JSON.stringify(request.parameters, null, 2)}</pre>
    </details>
  </>
}

export function HistoryRequest({ request, original }: { request: SavedRequest; original: string }) {
  const labelId = useId()
  const feedbackId = useId()
  const [view, setView] = useState<ResultViewMode>('changes')
  const [feedback, setFeedback] = useState('')
  const [copying, setCopying] = useState(false)
  const writing = useRef(false)
  const success = request.status === 'succeeded' && request.correctedText !== null

  async function copy() {
    if (!success || writing.current) return
    writing.current = true
    setCopying(true)
    setFeedback('')
    try {
      const outcome = await writeClipboardText(request.correctedText!)
      if (!outcome.success) setView('text')
      setFeedback(outcome.message)
    } finally { writing.current = false; setCopying(false) }
  }

  return <section className="history-request" aria-labelledby={labelId}>
    {success ? <ResultView result={{ originalText: original, correctedText: request.correctedText! }}
      view={view} onViewChange={setView} labelId={labelId} feedbackId={feedbackId} title={modelName(request.requestedModel)} />
      : <>
        <div className="editor-heading"><h2 id={labelId}>{modelName(request.requestedModel)}</h2></div>
        <p className="history-status">{request.status === 'pending' ? 'Pending' : 'Failed'}</p>
        {request.errorMessage && <p className="history-error">{request.errorMessage}</p>}
        {request.errorCode && <p className="clipboard-feedback">{request.errorCode}</p>}
      </>}
    {success && original === request.correctedText && <p className="clipboard-feedback">No changes.</p>}
    <RequestMetrics request={request} />
    {success && <>
      <p id={feedbackId} className="clipboard-feedback" role="status" aria-atomic="true">{feedback}</p>
      <div className="editor-actions"><Button type="button" disabled={copying} onClick={copy}
        aria-describedby={feedbackId}>{copying ? 'Copying...' : 'Copy'}</Button></div>
    </>}
  </section>
}
