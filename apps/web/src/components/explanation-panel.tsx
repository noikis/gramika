import { useEffect, useState } from 'react'
import {
  ExplanationFailure,
  ExplanationLookup,
  ExplanationSuccess,
  type ExplanationInput,
} from '@gramota/contracts'
import { Button } from './ui/button'

type Outcome = { explanation: string | null; error: string | null }

export function ExplanationPanel({ selection }: { selection: ExplanationInput }) {
  const [attempt, setAttempt] = useState({ number: 0, isGenerate: false })
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const body = JSON.stringify(selection)

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(
          attempt.isGenerate ? '/api/explanations' : '/api/explanations/lookup',
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
            signal: controller.signal,
          },
        )
        const payload: unknown = await response.json()
        if (!response.ok) {
          const failure = ExplanationFailure.safeParse(payload)
          if (!controller.signal.aborted)
            setOutcome({
              explanation: null,
              error: failure.success
                ? failure.data.error.message
                : 'Could not load the explanation. Please try again.',
            })
          return
        }
        const result = attempt.isGenerate
          ? ExplanationSuccess.parse(payload)
          : ExplanationLookup.parse(payload).result
        if (result && JSON.stringify(result.selection) !== body)
          throw new Error('The explanation did not match this correction.')
        if (!controller.signal.aborted)
          setOutcome({ explanation: result?.explanation ?? null, error: null })
      } catch {
        if (!controller.signal.aborted)
          setOutcome({
            explanation: null,
            error: 'Could not load the explanation. Please try again.',
          })
      }
    }
    void load()
    return () => controller.abort()
  }, [body, attempt])

  function request(isGenerate: boolean) {
    setOutcome(null)
    setAttempt((current) => ({ number: current.number + 1, isGenerate }))
  }

  return (
    <div className="explanation-panel" aria-busy={outcome === null}>
      {outcome?.explanation ? (
        <p className="explanation-text" lang="ru" role="status">
          {outcome.explanation}
        </p>
      ) : (
        <>
          <Button
            type="button"
            variant="secondary"
            disabled={outcome === null}
            onClick={() => request(outcome?.error ? attempt.isGenerate : true)}
          >
            {outcome === null
              ? attempt.isGenerate
                ? 'Explaining...'
                : 'Loading explanation...'
              : outcome.error
                ? 'Retry explanation'
                : 'Explain'}
          </Button>
          {outcome?.error && (
            <p role="alert" className="history-error">
              {outcome.error}
            </p>
          )}
        </>
      )}
    </div>
  )
}
