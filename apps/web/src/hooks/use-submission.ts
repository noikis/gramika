import { useLayoutEffect, useRef, useState } from 'react'
import {
  DEFAULT_MODEL_ID,
  ERROR_MESSAGES,
  type CorrectionMode,
  type CorrectionResult,
  type ModelId,
} from '@gramota/contracts'
import { requestCorrection } from '../lib/correction-api'
import { modelName } from '../lib/history-format'
import { notify } from '../lib/notifications'
import type { CorrectionWorkspaceState } from '../lib/workspace-storage'

type Feedback = { revision: number; mode: CorrectionMode; modelId: ModelId; message: string }

export function useSubmission(
  draftRevision: number,
  initial: CorrectionWorkspaceState | null | undefined,
  onSuccess: (result: CorrectionResult, revision: number) => void,
) {
  const [pendingModel, setPendingModel] = useState<ModelId | null>(null)
  const [interrupted, setInterrupted] = useState(initial?.isRequestPending ?? false)
  const [error, setError] = useState<Feedback | null>(null)
  const [hasCompletedCorrection, setHasCompletedCorrection] = useState(false)
  const sending = useRef(false)
  const latestRevision = useRef(draftRevision)
  const generation = useRef(0)
  const association = useRef<{ revision: number; correctionId: string } | null>(
    initial?.results[0]
      ? { revision: 0, correctionId: initial.results[0].result.correctionId }
      : null,
  )

  useLayoutEffect(() => {
    latestRevision.current = draftRevision
  }, [draftRevision])

  async function submit(input: Parameters<typeof requestCorrection>[0]) {
    if (sending.current) return
    const revision = draftRevision
    const submittedGeneration = generation.current
    const correctionId =
      input.correctionId ??
      (association.current?.revision === revision ? association.current.correctionId : undefined)
    const isCurrent = () =>
      latestRevision.current === revision && generation.current === submittedGeneration
    const feedback = { revision, mode: input.mode, modelId: input.modelId }
    sending.current = true
    setInterrupted(false)
    setPendingModel(input.modelId)
    setError(null)
    try {
      const response = await requestCorrection({ ...input, correctionId })
      if (!isCurrent()) return
      if (response.success === false) {
        const { failure } = response
        if (failure.error.code === 'INVALID_INPUT') association.current = null
        else if (failure.correctionId)
          association.current = { revision, correctionId: failure.correctionId }
        setError({ ...feedback, message: ERROR_MESSAGES[failure.error.code] })
        return
      }
      const result = response.result
      association.current = { revision, correctionId: result.correctionId }
      onSuccess(result, revision)
      setHasCompletedCorrection(true)
      notify(
        result.isCached
          ? 'Saved result · no new model request'
          : `${modelName(result.modelId)}: ${result.originalText === result.correctedText ? 'No changes.' : 'Correction ready.'}`,
        true,
      )
    } catch {
      if (isCurrent())
        setError({
          ...feedback,
          message:
            input.modelId !== DEFAULT_MODEL_ID
              ? 'Could not get another opinion. You can try again.'
              : 'Could not complete correction. Your text and previous results were kept. You can try again.',
        })
    } finally {
      sending.current = false
      setPendingModel(null)
    }
  }

  function invalidate() {
    generation.current += 1
    association.current = null
  }

  function reset() {
    if (sending.current) return false
    invalidate()
    setError(null)
    setInterrupted(false)
    return true
  }

  return {
    submit,
    reset,
    invalidate,
    pendingModel,
    interrupted,
    error,
    hasCompletedCorrection,
    dismissInterrupted: () => setInterrupted(false),
    isSending: () => sending.current,
    isAssociated: (id: string) => association.current?.correctionId === id,
  }
}
