import { Icon } from './ui/icon'
import type { RequestMetrics as SavedMetrics } from '@gramota/contracts'
import { formatCost, formatCount, formatDate, formatTime } from '../lib/history-format'

export function MetricFacts({
  request,
  rate,
  totals,
}: {
  request: SavedMetrics & { errorCode?: string | null }
  rate: number | null
  totals?: Pick<SavedMetrics, 'costUsd' | 'inputTokens' | 'outputTokens'>
}) {
  const summary = totals ?? request
  const primary = [
    [totals ? 'Total cost' : 'Cost', formatCost(summary.costUsd, rate)],
    [totals ? 'Correction response time' : 'Response time', formatTime(request.appRequestTimeMs)],
    [totals ? 'Total input tokens' : 'Input tokens', formatCount(summary.inputTokens)],
    [totals ? 'Total output tokens' : 'Output tokens', formatCount(summary.outputTokens)],
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
    ...(totals
      ? [
          ['Correction cost', formatCost(request.costUsd, rate)],
          ['Correction input tokens', formatCount(request.inputTokens)],
          ['Correction output tokens', formatCount(request.outputTokens)],
        ]
      : []),
    ['Total tokens', formatCount(request.totalTokens)],
    ['Reasoning tokens', formatCount(request.reasoningTokens)],
    ['Cache-read tokens', formatCount(request.cachedInputTokens)],
    ['Cache-write tokens', formatCount(request.cacheWriteTokens)],
    ['Upstream cost', formatCost(request.upstreamInferenceCostUsd, rate)],
    ['Upstream input cost', formatCost(request.upstreamPromptCostUsd, rate)],
    ['Upstream output cost', formatCost(request.upstreamCompletionCostUsd, rate)],
  ]
  const diagnostics = [
    ['Started', formatDate(request.startedAt)],
    ['Ended', formatDate(request.endedAt)],
    ['Generation time', formatTime(request.generationTimeMs)],
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
      <div className="detail-groups">
        {[
          { title: 'Usage breakdown', facts: usage },
          { title: 'Model & routing', facts: routing },
          { title: 'Timing & diagnostics', facts: diagnostics },
        ].map(({ title, facts }) => (
          <details className="metric-group" key={title}>
            <summary>
              <Icon name="plus" className="disclosure-plus" />
              <Icon name="minus" className="disclosure-minus" />
              {title}
            </summary>
            <dl className="request-facts">
              {facts.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value ?? 'Unavailable'}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
        <details className="metric-group parameters-section">
          <summary>
            <Icon name="plus" className="disclosure-plus" />
            <Icon name="minus" className="disclosure-minus" />
            Sent parameters
          </summary>
          <pre className="request-parameters">{JSON.stringify(request.parameters, null, 2)}</pre>
        </details>
      </div>
    </>
  )
}
