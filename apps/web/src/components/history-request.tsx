import { useEffect, useId, useRef, useState } from 'react'
import type { PointerEvent, ReactNode } from 'react'
import type { HistoryRequest as SavedRequest } from '@gramota/contracts'
import {
  formatCost,
  formatCount,
  formatDate,
  formatTime,
  shortModelName,
  modeLabels,
} from '../lib/history-format'
import { writeClipboardText } from '../lib/clipboard'
import { notify } from '../lib/notifications'
import { ResultView, type ResultViewMode } from './result-view'
import { Button } from './ui/button'
import { Icon } from './ui/icon'

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
}: {
  request: SavedRequest
  rate: number | null
  actions?: ReactNode
  entryAction?: ReactNode
}) {
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
  const primary = [
    ['Generation time', formatTime(request.generationTimeMs)],
    ['Input tokens', formatCount(request.inputTokens)],
    ['Output tokens', formatCount(request.outputTokens)],
    ['Cost', formatCost(request.costUsd, rate)],
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
    ['Upstream cost', formatCost(request.upstreamInferenceCostUsd, rate)],
    ['Upstream input cost', formatCost(request.upstreamPromptCostUsd, rate)],
    ['Upstream output cost', formatCost(request.upstreamCompletionCostUsd, rate)],
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
      <div className="request-actions">
        {actions}
        <Button
          type="button"
          variant="secondary"
          ref={opener}
          onClick={() => dialog.current?.showModal()}
        >
          <Icon name="info" /> Details
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
          if (opener.current?.isConnected) opener.current.focus()
        }}
      >
        <header className="sheet-heading">
          <div>
            <h2 id={titleId}>{shortModelName(request.requestedModel)}</h2>
            <p>Request details · {modeLabels[request.mode]}</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => dialog.current?.close()}>
            <Icon name="close" /> Close
          </Button>
        </header>
        <section className="request-summary" aria-label="Request summary">
          <h3>Summary</h3>
          <dl className="request-metrics">
            {primary.map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
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
      notify(outcome.message, outcome.success)
    } finally {
      writing.current = false
      onCopyingChange(false)
      setCopying(false)
    }
  }

  const requestActions = (
    <RequestMetrics
      request={request}
      rate={rate}
      entryAction={entryAction}
      actions={
        success && (
          <Button type="button" disabled={copying} onClick={copy}>
            <Icon name="copy" /> {copying ? 'Copying...' : 'Copy'}
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
                  <Icon name="error" /> Failed
                </span>
              )}
              <h2 id={labelId}>
                {shortModelName(request.requestedModel)}
                <span className="request-mode"> · {modeLabels[request.mode]}</span>
              </h2>
            </div>
            {requestActions}
          </div>
          <p className="history-status">{request.status === 'pending' ? 'Pending' : 'Failed'}</p>
          {request.errorMessage && <p className="history-error">{request.errorMessage}</p>}
        </>
      )}
      {success && original === request.correctedText && (
        <p className="clipboard-feedback">No changes.</p>
      )}
    </section>
  )
}
