import { useEffect, useLayoutEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import { CorrectionMode, DEFAULT_MODEL_ID, MAX_INPUT_CHARACTERS } from '@gramota/contracts'
import type { useDraft } from '../hooks/use-draft'
import type { useWritingSession } from '../hooks/use-writing-session'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
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
        onChange={(event) => edit(event.target.value)}
        ref={inputRef}
        placeholder="Type or paste your text"
        aria-describedby="input-feedback character-count"
        aria-invalid={Boolean(correction.validationMessage)}
        lang="ru"
        spellCheck={false}
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
  const isGemma = correction.activeModel === DEFAULT_MODEL_ID || !correction.visibleResult
  const hasBoth = correction.results.length === 2
  const activeLabel = isGemma ? 'Gemma 4' : correction.opinionModelName
  const visibleRequestId = correction.visibleResult?.requestId

  useEffect(() => {
    if (!visibleRequestId) return
    headingRef.current?.focus({ preventScroll: true })
    if (window.matchMedia(MOBILE_LAYOUT_QUERY).matches) {
      headingRef.current?.scrollIntoView({
        block: 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'instant'
          : 'smooth',
      })
    }
  }, [visibleRequestId])

  function switchResult(isNext: boolean) {
    if (!hasBoth) return
    const target = correction.results[isNext ? 1 : 0].result.modelId
    correction.selectResult(target)
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
      {hasBoth && !isGemma && (
        <Button
          className="previous-model"
          variant="secondary"
          aria-label="Show Gemma result"
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
        Result<span className="result-model">{activeLabel}</span>
      </h2>
      {hasBoth && isGemma && (
        <Button
          className="next-model"
          variant="secondary"
          aria-label="Show Gemini result"
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
  if (!correction.results.length || correction.results.length === 2) return null
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
              hidden={result.modelId !== correction.activeModel}
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
                  correction.setResultView(result.modelId, next, result.requestId)
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
                    <Button
                      type="button"
                      className="regenerate-action"
                      title="New paid request"
                      variant="secondary"
                      disabled={!correction.canRegenerate}
                      onClick={() => correction.regenerate(result.modelId)}
                      aria-label={`Generate ${result.modelId === DEFAULT_MODEL_ID ? 'Gemma' : 'Gemini'} again. New paid request`}
                    >
                      <Icon name="sparkles" />
                      {correction.pendingModel === result.modelId
                        ? 'Generating...'
                        : 'Generate again'}
                    </Button>
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
