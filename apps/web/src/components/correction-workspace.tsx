import type { useCorrectionDraft } from '../use-correction-draft'
import type { useCorrection } from '../use-correction'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { ResultView } from './result-view'
import { modelName } from '../lib/history-format'

type Draft = ReturnType<typeof useCorrectionDraft>
type Correction = ReturnType<typeof useCorrection>

function OriginalEditor({ draft, correction }: { draft: Draft; correction: Correction }) {
  const { text, edit, paste, pending, feedback, inputRef } = draft
  return (
    <section className="editor" aria-labelledby="original-title">
      <div className="editor-heading">
        <h2 id="original-title">
          <label htmlFor="original">Original</label>
        </h2>
        <Button
          type="button"
          variant="secondary"
          onClick={paste}
          disabled={pending}
          aria-describedby="clipboard-feedback"
        >
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
        aria-describedby="clipboard-feedback input-feedback"
        aria-invalid={Boolean(correction.validationMessage)}
        lang="ru"
        spellCheck={false}
      />
      <p id="clipboard-feedback" className="clipboard-feedback" role="status" aria-atomic="true">
        {feedback}
      </p>
      <p id="input-feedback" className="clipboard-feedback" role="status">
        {correction.validationMessage}
      </p>
      <div className="editor-actions">
        <Button
          type="button"
          disabled={!correction.canCorrect}
          onClick={correction.correct}
          aria-describedby="correction-status"
        >
          {correction.pending ? 'Correcting...' : 'Correct'}
        </Button>
      </div>
    </section>
  )
}

export function CorrectionWorkspace({
  draft,
  correction,
}: {
  draft: Draft
  correction: Correction
}) {
  return (
    <>
      <h1 className="sr-only">Correction</h1>
      <div className="model-control">
        <label htmlFor="model">Model</label>
        <select
          id="model"
          value={correction.config?.modelId ?? ''}
          disabled={!correction.config || correction.pending || correction.savingModel}
          onChange={(event) => correction.selectModel(event.target.value)}
          aria-describedby="model-availability"
        >
          {!correction.config?.modelId && (
            <option value="" disabled>
              {correction.config ? 'Choose a model' : 'Unavailable'}
            </option>
          )}
          {correction.config?.models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name}
            </option>
          ))}
        </select>
        {correction.configFailed && (
          <Button type="button" variant="secondary" onClick={correction.reloadConfig}>
            Retry
          </Button>
        )}
        {correction.retryModel && (
          <Button
            type="button"
            variant="secondary"
            disabled={correction.pending || correction.savingModel}
            onClick={() => correction.selectModel(correction.retryModel!)}
          >
            Retry save
          </Button>
        )}
        <span id="model-availability" className="model-feedback" role="status" aria-atomic="true">
          {correction.savingModel
            ? 'Saving...'
            : correction.modelError ||
              (correction.config && !correction.config.modelId
                ? 'The saved model is unavailable. Choose a model.'
                : '')}
        </span>
      </div>
      <div className="editors">
        <OriginalEditor draft={draft} correction={correction} />
        <section className="editor" aria-labelledby="result-title" aria-busy={correction.pending}>
          {correction.visibleResult ? (
            <ResultView
              result={correction.visibleResult}
              view={correction.resultView}
              onViewChange={correction.setResultView}
              labelId="result-title"
            />
          ) : (
            <>
              <div className="editor-heading">
                <h2 id="result-title">Result</h2>
              </div>
              <div className="result-box">
                <p>
                  {correction.pending
                    ? 'Correcting...'
                    : correction.draftChanged
                      ? 'Your original has changed. Correct it to get a new result.'
                      : 'No result yet.'}
                </p>
              </div>
            </>
          )}
          <p id="correction-status" className="clipboard-feedback" role="status" aria-atomic="true">
            {correction.availability ||
              (correction.pending
                ? 'Correcting...'
                : correction.visibleResult
                  ? `${modelName(correction.visibleResult.modelId)}: ${
                      correction.visibleResult.originalText ===
                      correction.visibleResult.correctedText
                        ? 'No changes.'
                        : 'Correction ready.'
                    }`
                  : '')}
          </p>
          {correction.error && (
            <p className="clipboard-feedback" role="alert">
              {correction.error}
            </p>
          )}
          <p id="copy-feedback" className="clipboard-feedback" role="status" aria-atomic="true">
            {correction.copyFeedback}
          </p>
          <div className="editor-actions">
            <Button
              type="button"
              disabled={!correction.visibleResult || correction.copying}
              onClick={correction.copy}
              aria-describedby="copy-feedback"
            >
              {correction.copying ? 'Copying...' : 'Copy'}
            </Button>
          </div>
        </section>
      </div>
    </>
  )
}
