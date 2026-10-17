import type { useCorrectionDraft } from '../use-correction-draft'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'

type Draft = ReturnType<typeof useCorrectionDraft>

function OriginalEditor({ draft }: { draft: Draft }) {
  const { text, edit, paste, pending, feedback, inputRef } = draft
  return (
    <section className="editor" aria-labelledby="original-title">
      <div className="editor-heading">
        <h2 id="original-title"><label htmlFor="original">Original</label></h2>
        <Button type="button" variant="secondary" onClick={paste} disabled={pending} aria-describedby="clipboard-feedback">
          {pending ? 'Pasting...' : 'Paste'}
        </Button>
      </div>
      <Textarea
        id="original"
        className="editor-input"
        value={text}
        onChange={event => edit(event.target.value)}
        ref={inputRef}
        placeholder="Type or paste your text"
        aria-describedby="clipboard-feedback"
        lang="ru"
        spellCheck={false}
      />
      <p id="clipboard-feedback" className="clipboard-feedback" role="status" aria-atomic="true">{feedback}</p>
      <div className="editor-actions">
        <Button type="button" disabled aria-describedby="correction-availability">Correct</Button>
      </div>
    </section>
  )
}

export function CorrectionWorkspace({ draft }: { draft: Draft }) {
  return (
    <>
      <h1 className="sr-only">Correction</h1>
      <div className="model-control">
        <label htmlFor="model">Model</label>
        <select id="model" disabled aria-describedby="model-availability"><option>Not configured</option></select>
        <span id="model-availability" className="sr-only">Model selection is not available yet.</span>
      </div>
      <div className="editors">
        <OriginalEditor draft={draft} />
        <section className="editor" aria-labelledby="result-title">
          <div className="editor-heading"><h2 id="result-title">Result</h2></div>
          <div className="result-box">
            <p>No result yet.</p>
            <p id="correction-availability">Correction is not available yet.</p>
          </div>
          <div className="editor-actions"><Button type="button" disabled aria-describedby="correction-availability">Copy</Button></div>
        </section>
      </div>
    </>
  )
}
