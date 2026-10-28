import {
  ExplanationFailure,
  ExplanationLookup,
  ExplanationMetrics,
  ExplanationSuccess,
  type ExplanationInput,
  type ExplanationMetrics as ExplanationMetricsType,
  type ExpressionExplanationInput,
} from '@gramota/contracts'

export async function fetchExplanation(
  selection: ExplanationInput,
  isGenerate: boolean,
  signal: AbortSignal,
) {
  const body = JSON.stringify(selection)
  const response = await fetch(isGenerate ? '/api/explanations' : '/api/explanations/lookup', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    signal,
  })
  const payload: unknown = await response.json()
  if (!response.ok) {
    const failure = ExplanationFailure.safeParse(payload)
    throw Error(
      failure.success
        ? failure.data.error.message
        : 'Could not load the explanation. Please try again.',
    )
  }
  const result = isGenerate
    ? ExplanationSuccess.parse(payload)
    : ExplanationLookup.parse(payload).result
  if (result && JSON.stringify(result.selection) !== body)
    throw Error('The explanation did not match this correction.')
  return result?.explanation ?? null
}

export async function generateExpressionExplanation(selection: ExpressionExplanationInput) {
  const body = JSON.stringify(selection)
  const response = await fetch('/api/explanations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  })
  const payload: unknown = await response.json()
  if (!response.ok) {
    const failure = ExplanationFailure.safeParse(payload)
    throw Error(failure.success ? failure.data.error.message : 'Could not explain the selection.')
  }
  const result = ExplanationSuccess.parse(payload)
  if (JSON.stringify(result.selection) !== body) throw Error('Mismatched explanation.')
  return result.explanation
}

export async function fetchExplanationMetrics(
  requestId: string,
  signal: AbortSignal,
): Promise<ExplanationMetricsType> {
  const response = await fetch('/api/explanations/metrics', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ requestId }),
    signal,
  })
  if (!response.ok) throw Error('Metrics unavailable')
  const value = ExplanationMetrics.parse(await response.json())
  if (
    value.attempts.some((attempt) => attempt.selection.requestId !== requestId) ||
    value.legacySelections.some((selection) => selection.requestId !== requestId)
  )
    throw Error('Mismatched request metrics')
  return value
}
