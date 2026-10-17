import { useId, useMemo } from 'react'
import type { CorrectionResult } from '@gramota/contracts'
import { diffText } from '../lib/text-diff'
import { Textarea } from './ui/textarea'

export type ResultViewMode = 'text' | 'changes'

type Props = {
  result: Pick<CorrectionResult, 'originalText' | 'correctedText'>
  view: ResultViewMode
  onViewChange: (view: ResultViewMode) => void
  labelId: string
  feedbackId?: string
  title?: string
}

export function ResultView({ result, view, onViewChange, labelId, feedbackId = 'copy-feedback', title = 'Result' }: Props) {
  const groupName = useId()
  const segments = useMemo(() => diffText(result.originalText, result.correctedText), [result.originalText, result.correctedText])

  return (
    <>
      <div className="editor-heading">
        <h2 id={labelId}>{title}</h2>
        <fieldset className="result-toggle">
          <legend className="sr-only">{title === 'Result' ? 'Result view' : `${title} result view`}</legend>
          {(['text', 'changes'] as const).map(mode => (
            <label key={mode}>
              <input type="radio" name={groupName} value={mode} checked={view === mode}
                onChange={() => onViewChange(mode)} />
              {mode === 'text' ? 'Text' : 'Changes'}
            </label>
          ))}
        </fieldset>
      </div>
      {view === 'text' ? (
        <Textarea className="editor-input result-text" readOnly aria-labelledby={labelId}
          aria-describedby={feedbackId} value={result.correctedText} lang="ru" spellCheck={false} />
      ) : (
        <div className="result-box result-changes" role="region" aria-labelledby={labelId} tabIndex={0} lang="ru">
          {segments.map((segment, index) => segment.kind === 'equal' ? segment.text
            : segment.kind === 'removed' ? (
              <del key={index}><span className="sr-only">Deletion: </span>{segment.text}<span className="sr-only"> End deletion.</span></del>
            ) : (
              <ins key={index}><span className="sr-only">Insertion: </span>{segment.text}<span className="sr-only"> End insertion.</span></ins>
            ))}
        </div>
      )}
    </>
  )
}
