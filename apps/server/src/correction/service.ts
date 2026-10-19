import { randomUUID } from 'node:crypto'
import {
  CorrectionInput,
  DEFAULT_MODEL_ID,
  TIMEOUT_MS,
  ERROR_MESSAGES,
  ErrorCode,
} from '@gramota/contracts'
import {
  CorrectionError,
  InvalidCorrectionReference,
  MessageRole,
  type CorrectionRepository,
  type CorrectionTransport,
  type Attempt,
  type Outcome,
} from './types'
import { PARAMETERS, PROMPT_VERSION, STRICT_PROMPT } from './prompt'

export class AttemptError extends CorrectionError {
  constructor(
    code: ErrorCode,
    readonly ids: Attempt | null,
  ) {
    super(code)
  }
}

type Dependencies = {
  repository: CorrectionRepository | null
  transport: CorrectionTransport | null
  isAvailable: boolean
  now?: () => string
  clock?: () => number
  uuid?: () => string
  timeoutMs?: number
  onRepositoryFailure?: (error: unknown, stage: 'begin' | 'finish') => void
  isRejectReasoning?: boolean
}

export function createCorrectionService(deps: Dependencies) {
  const now = deps.now ?? (() => new Date().toISOString())
  const clock = deps.clock ?? (() => performance.now())
  const uuid = deps.uuid ?? randomUUID

  return async function correct(
    text: string,
    modelId: string = DEFAULT_MODEL_ID,
    correctionId?: string,
  ) {
    const input = CorrectionInput.safeParse({ text, modelId, correctionId })
    if (!input.success) throw new AttemptError(ErrorCode.enum.INVALID_INPUT, null)
    if (!deps.isAvailable || !deps.transport)
      throw new AttemptError(ErrorCode.enum.NOT_CONFIGURED, null)
    if (!deps.repository) throw new AttemptError(ErrorCode.enum.STORAGE_ERROR, null)

    const ids = { correctionId: correctionId ?? uuid(), requestId: uuid() }
    const requestParameters = {
      ...PARAMETERS,
      model: input.data.modelId,
      reasoning: { ...PARAMETERS.reasoning },
      provider: { ...PARAMETERS.provider },
    }

    const startedAtMs = clock()

    // Record the start of the correction attempt
    try {
      deps.repository.beginAttempt({
        ids,
        originalText: text,
        modelId,
        promptVersion: PROMPT_VERSION,
        parameters: requestParameters,
        startedAt: now(),
        isRepeat: correctionId !== undefined,
      })
    } catch (error) {
      if (error instanceof InvalidCorrectionReference)
        throw new AttemptError(ErrorCode.enum.INVALID_INPUT, null)
      deps.onRepositoryFailure?.(error, 'begin')
      throw new AttemptError(ErrorCode.enum.STORAGE_ERROR, null)
    }

    // Prepare to send the correction request and handle timeout
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let responseDetails: Partial<Outcome> = {}
    let correctedText: string | null = null
    let errorCode: ErrorCode | null = null

    try {
      // Set up a timeout for the correction request
      const timeoutPromise = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          controller.abort()
          reject(new CorrectionError(ErrorCode.enum.TIMEOUT))
        }, deps.timeoutMs ?? TIMEOUT_MS)
      })

      // Send the correction request to openrouter and wait for the response or timeout
      const correctionPromise = deps.transport.send(
        {
          ...requestParameters,
          messages: [
            { role: MessageRole.enum.system, content: STRICT_PROMPT },
            { role: MessageRole.enum.user, content: text },
          ],
        },
        controller.signal,
        deps.isRejectReasoning,
      )

      // Wait for either the correction response or the timeout to occur
      const response = await Promise.race([correctionPromise, timeoutPromise])
      responseDetails = response.details
      if (response.errorCode) throw new CorrectionError(response.errorCode)

      correctedText = response.correctedText
    } catch (error) {
      errorCode = controller.signal.aborted
        ? ErrorCode.enum.TIMEOUT
        : error instanceof CorrectionError
          ? error.code
          : ErrorCode.enum.UPSTREAM_ERROR
    } finally {
      clearTimeout(timer)
    }

    try {
      // Record the outcome of the correction attempt
      deps.repository.finishAttempt(ids.requestId, {
        ...responseDetails,
        status: errorCode ? 'failed' : 'succeeded',
        correctedText,
        endedAt: now(),
        durationMs: Math.max(0, Math.round(clock() - startedAtMs)),
        errorCode,
        errorMessage: errorCode ? ERROR_MESSAGES[errorCode] : null,
      })
    } catch (error) {
      deps.onRepositoryFailure?.(error, 'finish')
      throw new AttemptError(ErrorCode.enum.STORAGE_ERROR, ids)
    }

    if (errorCode) throw new AttemptError(errorCode, ids)

    return {
      ...ids,
      originalText: text,
      correctedText: correctedText!,
      modelId: input.data.modelId,
    }
  }
}
