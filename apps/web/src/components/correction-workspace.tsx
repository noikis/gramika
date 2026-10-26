import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import { CorrectionMode, DEFAULT_MODEL_ID, MAX_INPUT_CHARACTERS } from '@gramota/contracts'
import type { ExpressionExplanationInput } from '@gramota/contracts'
import type { useDraft } from '../hooks/use-draft'
import type { useWritingSession } from '../hooks/use-writing-session'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { ExpressionExplanationPanel } from './explanation-panel'
import { ResultView } from './result-view'
import { modeLabels } from '../lib/history-format'
import { Icon } from './ui/icon'

type Draft = ReturnType<typeof useDraft>
type Correction = ReturnType<typeof useWritingSession>
type WorkspaceProps = {
  draft: Draft
  correction: Correction
  onNew: () => void
  isBusy: boolean
}
const MIN_SWIPE_DISTANCE_PX = 48
const MOBILE_LAYOUT_QUERY = '(max-width: 720px)'

function ModeControl({ correction }: { correction: Correction }) {
  return (
    <div className="model-control">
      <fieldset className="mode-switch">
        <legend className="sr-only">Correction mode</legend>
        {CorrectionMode.options.map((mode) => (
          <label key={mode}>
            <input
              type="radio"
              name="correction-mode"
              value={mode}
              checked={correction.mode === mode}
              disabled={correction.pending}
              onChange={() => correction.selectMode(mode)}
            />
            {modeLabels[mode]}
          </label>
        ))}
      </fieldset>
      {correction.configFailed && (
        <Button type="button" variant="secondary" onClick={correction.reloadConfig}>
          Retry connection
        </Button>
      )}
    </div>
  )
}

function OriginalEditor({ draft, correction, onNew, isBusy }: WorkspaceProps) {
  const { text, edit, paste, pending, inputRef } = draft
  const [manualSelection, setManualSelection] = useState<ExpressionExplanationInput | null>(null)
  const result =
    !correction.draftChanged && correction.visibleResult?.originalText === text
      ? correction.visibleResult
      : null

  useEffect(() => {
    // The selection belongs to the current correction mode and request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setManualSelection(null)
  }, [correction.mode, result?.requestId])

  function selectOriginal(start: number, end: number) {
    if (!result || start === end || start < 0 || end > text.length) {
      setManualSelection(null)
      return
    }
    const range = start < end ? { start, end } : { start: end, end: start }
    const value = text.slice(range.start, range.end)
    if (!value) {
      setManualSelection(null)
      return
    }
    setManualSelection({
      version: 3,
      requestId: result.requestId,
      kind: 'expression',
      mode: result.mode,
      source: 'original',
      originalRange: range,
      value,
    })
  }

  useLayoutEffect(() => {
    const input = inputRef.current
    if (!input) return
    const resize = () => {
      input.style.height = 'auto'
      input.style.height = `${input.scrollHeight}px`
    }
    resize()
    window.addEventListener('resize', resize)
    document.fonts.addEventListener('loadingdone', resize)
    return () => {
      window.removeEventListener('resize', resize)
      document.fonts.removeEventListener('loadingdone', resize)
    }
  }, [text, inputRef])

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [inputRef])
  return (
    <section className="editor original-editor" aria-labelledby="original-title">
      <div className="editor-heading">
        <h2 id="original-title" className="sr-only">
          <label htmlFor="original">Original</label>
        </h2>
        <Button
          type="button"
          variant="ghost"
          onClick={onNew}
          disabled={isBusy}
          aria-label="New correction"
        >
          <Icon name="plus" /> New
        </Button>
        <Button type="button" variant="secondary" onClick={paste} disabled={pending}>
          <Icon name="paste" />
          {pending ? 'Pasting...' : 'Paste'}
        </Button>
      </div>
      <Textarea
        id="original"
        className="editor-input"
        value={text}
        onChange={(event) => {
          setManualSelection(null)
          edit(event.target.value)
        }}
        ref={inputRef}
        placeholder="Type or paste your text"
        aria-describedby="input-feedback character-count"
        aria-invalid={Boolean(correction.validationMessage)}
        lang="ru"
        spellCheck={false}
        onSelect={(event) =>
          selectOriginal(event.currentTarget.selectionStart, event.currentTarget.selectionEnd)
        }
        onKeyDown={(event) => {
          if (
            (event.ctrlKey || event.metaKey) &&
            event.key === 'Enter' &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault()
            if (correction.canCorrect && !pending) void correction.correct()
          }
        }}
      />
      {manualSelection && result && (
        <ExpressionExplanationPanel
          key={JSON.stringify(manualSelection)}
          selection={manualSelection}
        />
      )}
      <p id="input-feedback" className="clipboard-feedback" role="status">
        {correction.validationMessage}
      </p>
      <div className="editor-actions">
        <ModeControl correction={correction} />
        <span id="character-count" className="character-count">
          {Array.from(text.trim()).length.toLocaleString('en-US')} /{' '}
          {MAX_INPUT_CHARACTERS.toLocaleString('en-US')} characters
        </span>
        <Button
          type="button"
          disabled={!correction.canCorrect}
          onClick={correction.correct}
          aria-describedby="correction-status"
        >
          {correction.pending && !correction.isOpinionPending ? 'Correcting...' : 'Correct'}
        </Button>
      </div>
    </section>
  )
}

function ResultHeading({ correction }: { correction: Correction }) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const activeIndex = correction.results.findIndex(
    ({ result }) => result.requestId === correction.activeRequestId,
  )
  const hasPrevious = activeIndex > 0
  const hasNext = activeIndex >= 0 && activeIndex < correction.results.length - 1
  const activeLabel = correction.visibleResult
    ? correction.visibleResult.modelId === DEFAULT_MODEL_ID
      ? 'Gemma 4'
      : correction.opinionModelName
    : 'Result'
  const visibleRequestId = correction.visibleResult?.requestId
  const previousRequestId = useRef<string | null>(null)

  useEffect(() => {
    if (!visibleRequestId || previousRequestId.current === visibleRequestId) return
    previousRequestId.current = visibleRequestId
    if (!window.matchMedia(MOBILE_LAYOUT_QUERY).matches || !headingRef.current) return
    const bounds = headingRef.current.getBoundingClientRect()
    if (bounds.top >= 0 && bounds.bottom <= window.innerHeight) return
    headingRef.current.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    })
  }, [visibleRequestId])

  function switchResult(isNext: boolean) {
    const target = correction.results[isNext ? activeIndex + 1 : activeIndex - 1]
    if (!target) return
    correction.selectResult(target.result.requestId)
    headingRef.current?.focus({ preventScroll: true })
  }

  function startSwipe(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.button !== 0 || (event.target as Element).closest('button'))
      return
    swipeStart.current = { x: event.clientX, y: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    if (!swipeStart.current) return
    const dx = event.clientX - swipeStart.current.x
    const dy = event.clientY - swipeStart.current.y
    swipeStart.current = null
    if (Math.abs(dx) > MIN_SWIPE_DISTANCE_PX && Math.abs(dx) > Math.abs(dy)) switchResult(dx < 0)
  }

  return (
    <div
      className="result-heading"
      onPointerDown={startSwipe}
      onPointerUp={finishSwipe}
      onPointerCancel={() => {
        swipeStart.current = null
      }}
    >
      {hasPrevious && (
        <Button
          className="previous-model"
          variant="secondary"
          aria-label="Show previous result"
          onClick={() => switchResult(false)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m15 6-6 6 6 6" />
          </svg>
        </Button>
      )}
      <h2 id="result-title" tabIndex={-1} ref={headingRef} aria-live="polite">
        Result {activeIndex >= 0 ? `${activeIndex + 1} of ${correction.results.length}` : ''}
        <span className="result-model">{activeLabel}</span>
      </h2>
      {hasNext && (
        <Button
          className="next-model"
          variant="secondary"
          aria-label="Show next result"
          onClick={() => switchResult(true)}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
          >
            <path d="m9 6 6 6-6 6" />
          </svg>
        </Button>
      )}
    </div>
  )
}

function OpinionAction({ correction }: { correction: Correction }) {
  if (
    !correction.results.length ||
    correction.results.some(({ result }) => result.modelId !== DEFAULT_MODEL_ID)
  )
    return null
  return (
    <div className="opinion-action">
      <Button
        type="button"
        variant="secondary"
        disabled={!correction.canRequestOpinion}
        onClick={correction.requestOpinion}
        aria-describedby="opinion-cost"
      >
        <span>
          {correction.isOpinionPending
            ? 'Requesting second opinion...'
            : correction.opinionError
              ? 'Retry second opinion'
              : 'Second opinion'}
        </span>
        <span id="opinion-cost" className="opinion-button-cost" aria-hidden="true">
          Higher cost if generated
        </span>
      </Button>
      {correction.isModeChanged ? (
        <p className="clipboard-feedback">
          Correct in {modeLabels[correction.mode]} before requesting another opinion.
        </p>
      ) : (
        <>
          {correction.isOpinionPending && (
            <p role="status">Getting another opinion. Your Gemma result is still available.</p>
          )}
          {correction.opinionError && (
            <p role="alert">{correction.opinionError} Your Gemma result is still available.</p>
          )}
        </>
      )}
    </div>
  )
}

function MobileRegenerateAction({ correction }: { correction: Correction }) {
  const result = correction.visibleResult
  if (!result || !correction.canRegenerate(result.modelId)) return null
  return (
    <Button
      className="mobile-regenerate-action"
      type="button"
      variant="secondary"
      disabled={false}
      onClick={() => correction.regenerate(result.modelId)}
      aria-label={`Generate ${result.modelId === DEFAULT_MODEL_ID ? 'Gemma' : 'Gemini'} again. New paid request`}
    >
      <Icon name="sparkles" />
      {correction.pendingModel === result.modelId ? 'Generating...' : 'Generate again'}
    </Button>
  )
}

export function CorrectionWorkspace({ draft, correction, onNew, isBusy }: WorkspaceProps) {
  return (
    <>
      <div className="workspace-intro">
        <h1 className="sr-only">Correction</h1>
        <p>Write with confidence.</p>
      </div>
      <div className="editors correction-workspace">
        <OriginalEditor draft={draft} correction={correction} onNew={onNew} isBusy={isBusy} />
        <section className="editor result-editor" aria-labelledby="result-title">
          <ResultHeading correction={correction} />
          {correction.results.map(({ result, view }) => (
            <div
              className="workspace-result"
              key={result.requestId}
              hidden={result.requestId !== correction.activeRequestId}
            >
              {result.isCached && (
                <p className="clipboard-feedback" role="status">
                  Saved result · no new model request
                </p>
              )}
              <ResultView
                result={result}
                view={view}
                  onViewChange={(next) =>
                  correction.setResultView(result.requestId, next)
                }
                labelId={`result-${result.requestId}`}
                title={`${result.modelId === DEFAULT_MODEL_ID ? 'Gemma 4' : correction.opinionModelName} · ${modeLabels[result.mode]}`}
                compact
                actions={
                  <>
                    <Button
                      type="button"
                      className="workspace-copy-action"
                      variant="secondary"
                      disabled={correction.copying}
                      onClick={correction.copy}
                      aria-label={`Copy ${result.modelId === DEFAULT_MODEL_ID ? 'Gemma' : 'Gemini'} result`}
                    >
                      <Icon name="copy" />
                      {correction.copying ? 'Copying...' : 'Copy'}
                    </Button>
                    {correction.canRegenerate(result.modelId) && (
                      <Button
                        type="button"
                        className="regenerate-action desktop-regenerate-action"
                        title="New paid request"
                        variant="secondary"
                        disabled={correction.pendingModel === result.modelId}
                        onClick={() => correction.regenerate(result.modelId)}
                        aria-label={`Generate ${result.modelId === DEFAULT_MODEL_ID ? 'Gemma' : 'Gemini'} again. New paid request`}
                      >
                        <Icon name="sparkles" />
                        {correction.pendingModel === result.modelId
                          ? 'Generating...'
                          : 'Generate again'}
                      </Button>
                    )}
                  </>
                }
              />
            </div>
          ))}
          {!correction.visibleResult && (
            <div className="result-box">
              <p>
                {correction.pending
                  ? 'Correcting...'
                  : correction.draftChanged
                    ? 'Your original has changed. Correct it to get a new result.'
                    : 'No result yet.'}
              </p>
            </div>
          )}
          <p id="correction-status" className="clipboard-feedback" role="status" aria-atomic="true">
            {correction.availability ||
              (correction.pending && !correction.isOpinionPending
                ? 'Correcting with Gemma...'
                : '')}
          </p>
          {correction.error && (
            <p className="clipboard-feedback" role="alert">
              {correction.error}
            </p>
          )}
        </section>
        <div className="workspace-opinion">
          <MobileRegenerateAction correction={correction} />
          <OpinionAction correction={correction} />
        </div>
      </div>
      {correction.visibleResult && (
        <>
          {correction.results.length === 2 && correction.opinionError && (
            <p role="alert">
              {correction.opinionError} Your previous Gemini result is still available.
            </p>
          )}
          <div className="mobile-copy-bar">
            <Button type="button" disabled={correction.copying} onClick={correction.copy}>
              <Icon name="copy" /> {correction.copying ? 'Copying...' : 'Copy result'}
            </Button>
          </div>
        </>
      )}
    </>
  )
}
