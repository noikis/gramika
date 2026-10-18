import type { useCorrectionDraft } from '../use-correction-draft'
import type { useCorrection } from '../use-correction'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { ResultView } from './result-view'

type Draft = ReturnType<typeof useCorrectionDraft>
type Correction = ReturnType<typeof useCorrection>

const modelLabels: Record<string, string> = {
  'google/gemma-4-26b-a4b-it': 'Gemma 4 · Standard',
  'google/gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite · Higher cost',
}

function OriginalEditor({ draft, correction }: { draft: Draft; correction: Correction }) {
  const { text, edit, paste, pending, inputRef } = draft
  return (
    <section className="editor" aria-labelledby="original-title">
      <div className="editor-heading">
        <h2 id="original-title">
          <label htmlFor="original">Original</label>
        </h2>
        <Button type="button" variant="secondary" onClick={paste} disabled={pending}>
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
        aria-describedby="input-feedback"
        aria-invalid={Boolean(correction.validationMessage)}
        lang="ru"
        spellCheck={false}
      />
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
          aria-describedby={
            correction.config?.modelId === 'google/gemini-3.1-flash-lite'
              ? 'model-description model-availability'
              : 'model-availability'
          }
        >
          {!correction.config?.modelId && (
            <option value="" disabled>
              {correction.config ? 'Choose a model' : 'Unavailable'}
            </option>
          )}
          {correction.config?.models.map((model) => (
            <option key={model.id} value={model.id}>
              {modelLabels[model.id] ?? model.name}
            </option>
          ))}
        </select>
        {correction.config?.modelId === 'google/gemini-3.1-flash-lite' && (
          <p id="model-description" className="model-description">
            Gemini is an alternative; better correction quality hasn’t been established.
          </p>
        )}
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
            {correction.availability || (correction.pending ? 'Correcting...' : '')}
          </p>
          {correction.error && (
            <p className="clipboard-feedback" role="alert">
              {correction.error}
            </p>
          )}
          <div className="editor-actions">
            <Button
              type="button"
              disabled={!correction.visibleResult || correction.copying}
              onClick={correction.copy}
            >
              {correction.copying ? 'Copying...' : 'Copy'}
            </Button>
          </div>
        </section>
      </div>
    </>
  )
}
