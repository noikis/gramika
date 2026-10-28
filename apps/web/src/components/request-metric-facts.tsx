import { Icon } from './ui/icon'
import type { RequestMetrics as SavedMetrics } from '@gramota/contracts'
import { formatCost, formatCount, formatDate, formatTime } from '../lib/history-format'
import { useLocale } from '../hooks/use-locale'

export function MetricFacts({
  request,
  rate,
  totals,
}: {
  request: SavedMetrics & { errorCode?: string | null }
  rate: number | null
  totals?: Pick<SavedMetrics, 'costUsd' | 'inputTokens' | 'outputTokens'>
}) {
  const { locale, messages } = useLocale()
  const m = messages.metrics
  const summary = totals ?? request
  const primary = [
    [totals ? m.totalCost : m.cost, formatCost(summary.costUsd, rate)],
    [totals ? m.correctionResponseTime : m.responseTime, formatTime(request.appRequestTimeMs)],
    [totals ? m.totalInputTokens : m.inputTokens, formatCount(summary.inputTokens, locale)],
    [totals ? m.totalOutputTokens : m.outputTokens, formatCount(summary.outputTokens, locale)],
  ]
  const routing = [
    [m.requestedModel, request.requestedModel],
    [m.returnedModel, request.returnedModel],
    [m.provider, request.provider],
    [m.routingStrategy, request.routingStrategy],
    [m.routingRegion, request.routingRegion],
    [m.routingAttempt, formatCount(request.routingAttempt, locale)],
    [m.bringYourOwnKey, request.isByok === null ? null : request.isByok ? m.yes : m.no],
  ]
  const usage = [
    ...(totals
      ? [
          [m.correctionCost, formatCost(request.costUsd, rate)],
          [m.correctionInputTokens, formatCount(request.inputTokens, locale)],
          [m.correctionOutputTokens, formatCount(request.outputTokens, locale)],
        ]
      : []),
    [m.totalTokens, formatCount(request.totalTokens, locale)],
    [m.reasoningTokens, formatCount(request.reasoningTokens, locale)],
    [m.cacheReadTokens, formatCount(request.cachedInputTokens, locale)],
    [m.cacheWriteTokens, formatCount(request.cacheWriteTokens, locale)],
    ['Upstream cost', formatCost(request.upstreamInferenceCostUsd, rate)],
    ['Upstream input cost', formatCost(request.upstreamPromptCostUsd, rate)],
    ['Upstream output cost', formatCost(request.upstreamCompletionCostUsd, rate)],
  ]
  const diagnostics = [
    [m.started, formatDate(request.startedAt, locale)],
    [m.ended, formatDate(request.endedAt, locale)],
    [m.generationTime, formatTime(request.generationTimeMs)],
    [m.generationId, request.openrouterGenerationId],
    [m.finishReason, request.finishReason],
    [m.promptVersion, request.promptVersion],
    ...(request.errorCode ? [[m.errorCode, request.errorCode]] : []),
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
          { title: m.usageBreakdown, facts: usage },
          { title: m.modelRouting, facts: routing },
          { title: m.timingDiagnostics, facts: diagnostics },
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
                  <dd>{value ?? m.unavailable}</dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
        <details className="metric-group parameters-section">
          <summary>
            <Icon name="plus" className="disclosure-plus" />
            <Icon name="minus" className="disclosure-minus" />
            {m.sentParameters}
          </summary>
          <pre className="request-parameters">{JSON.stringify(request.parameters, null, 2)}</pre>
        </details>
      </div>
    </>
  )
}
