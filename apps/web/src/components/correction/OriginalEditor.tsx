import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ExpressionExplanationInput } from '@gramota/contracts'
import { CorrectionMode } from '@gramota/contracts'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { ExpressionExplanationPanel } from '../explanations/ExplanationPanel'
import { Icon } from '../ui/icon'
import { useLocale } from '../../i18n/use-locale'
import { SpeechButton } from '../ui/speech-button'
import type { Correction, WorkspaceProps } from './types'

function ModeControl({ correction }: { correction: Correction }) {
  const { t } = useLocale()
  return (
    <div className="model-control">
      <fieldset className="mode-switch">
        <legend className="sr-only">{t('correctionMode')}</legend>
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
            {mode === 'strict' ? t('strictMode') : t('rewriteMode')}
          </label>
        ))}
      </fieldset>
      {correction.configFailed && (
        <Button type="button" variant="secondary" onClick={correction.reloadConfig}>
          {t('retryConnection')}
        </Button>
      )}
    </div>
  )
}

export function OriginalEditor({ draft, correction, onNew, isBusy }: WorkspaceProps) {
  const { t } = useLocale()
  const { text, edit, paste, pending, inputRef } = draft
  const [manualSelection, setManualSelection] = useState<ExpressionExplanationInput | null>(null)
  const [speechSelection, setSpeechSelection] = useState('')
  const selectionRef = useRef<{ start: number; end: number } | null>(null)
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
          aria-label={t('newCorrection')}
        >
          <Icon name="plus" /> {t('newCorrection')}
        </Button>
        <Button type="button" variant="secondary" onClick={paste} disabled={pending}>
          <Icon name="paste" />
          {pending ? t('pasting') : t('paste')}
        </Button>
      </div>
      <Textarea
        id="original"
        className="editor-input"
        value={text}
        onChange={(event) => {
          setManualSelection(null)
          setSpeechSelection('')
          selectionRef.current = null
          edit(event.target.value)
        }}
        ref={inputRef}
        placeholder={t('typeOrPaste')}
        aria-describedby="input-feedback"
        aria-invalid={Boolean(correction.validationMessage)}
        lang="ru"
        spellCheck={false}
        onSelect={(event) => {
          const { selectionStart: start, selectionEnd: end } = event.currentTarget
          selectionRef.current = { start, end }
          setSpeechSelection(
            start !== end ? text.slice(Math.min(start, end), Math.max(start, end)) : '',
          )
          selectOriginal(event.currentTarget.selectionStart, event.currentTarget.selectionEnd)
        }}
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
      <div className="speech-row">
        <SpeechButton
          sourceId="original-editor"
          lang="ru-RU"
          getSelection={() => speechSelection || null}
          getText={() => {
            const selection = selectionRef.current
            return selection && selection.start !== selection.end
              ? text.slice(
                  Math.min(selection.start, selection.end),
                  Math.max(selection.start, selection.end),
                )
              : text
          }}
        />
      </div>
      <div className="editor-actions">
        <ModeControl correction={correction} />
        <Button
          type="button"
          disabled={!correction.canCorrect}
          onClick={correction.correct}
          aria-describedby="correction-status"
        >
          {correction.pending && !correction.isOpinionPending ? t('correcting') : t('correct')}
        </Button>
      </div>
    </section>
  )
}
