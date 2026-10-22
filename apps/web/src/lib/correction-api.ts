import { CorrectionFailure, CorrectionInput, CorrectionSuccess, MODELS } from '@gramota/contracts'

type CorrectionRequest = ReturnType<typeof CorrectionInput.parse>

export async function requestCorrection(input: CorrectionRequest) {
  const submitted = CorrectionInput.parse(input)
  const response = await fetch('/api/corrections', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(submitted),
  })
  const payload: unknown = await response.json()
  if (!response.ok) {
    const failure = CorrectionFailure.parse(payload)
    if (
      submitted.correctionId &&
      failure.correctionId &&
      failure.correctionId !== submitted.correctionId
    )
      throw Error('Mismatched correction failure')
    return { success: false as const, failure }
  }

  const result = CorrectionSuccess.parse(payload)
  const isOpinion = submitted.modelId === MODELS[1].id
  if (
    result.originalText !== submitted.text ||
    result.modelId !== submitted.modelId ||
    result.mode !== submitted.mode ||
    (submitted.correctionId &&
      result.correctionId !== submitted.correctionId &&
      (isOpinion || !result.isCached))
  )
    throw Error('Mismatched correction')
  return { success: true as const, result }
}
