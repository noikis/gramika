import { randomUUID } from 'node:crypto'
import {
  CorrectionInput,
  CorrectionMode,
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
import {
  OPENROUTER_REQUEST_DEFAULTS,
  STRICT_PROMPT_VERSION,
  REWRITE_PROMPT_VERSION,
} from './constants'
import { STRICT_PROMPT } from './prompts/strict'
import { REWRITE_PROMPT } from './prompts/rewrite'

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
  onReasoningViolation?: (requestId: string, modelId: string) => void
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
    onRepositoryFailure = deps.onRepositoryFailure,
    mode: CorrectionMode = CorrectionMode.enum.strict,
  ) {
    const input = CorrectionInput.safeParse({ text, modelId, correctionId, mode })
    if (!input.success) throw new AttemptError(ErrorCode.enum.INVALID_INPUT, null)
    if (!deps.isAvailable || !deps.transport)
      throw new AttemptError(ErrorCode.enum.NOT_CONFIGURED, null)
    if (!deps.repository) throw new AttemptError(ErrorCode.enum.STORAGE_ERROR, null)

    const isRewrite = input.data.mode === CorrectionMode.enum['gentle-rewrite']
    const promptVersion = isRewrite ? REWRITE_PROMPT_VERSION : STRICT_PROMPT_VERSION
    const prompt = isRewrite ? REWRITE_PROMPT : STRICT_PROMPT

    const ids = { correctionId: correctionId ?? uuid(), requestId: uuid() }
    const requestParameters = {
      ...OPENROUTER_REQUEST_DEFAULTS,
      model: input.data.modelId,
      reasoning: { ...OPENROUTER_REQUEST_DEFAULTS.reasoning },
      provider: { ...OPENROUTER_REQUEST_DEFAULTS.provider },
    }

    const startedAtMs = clock()

    // Record the start of the correction attempt
    try {
      deps.repository.beginAttempt({
        ids,
        originalText: text,
        modelId,
        mode: input.data.mode,
        promptVersion,
        parameters: requestParameters,
        startedAt: now(),
        isRepeat: correctionId !== undefined,
      })
    } catch (error) {
      if (error instanceof InvalidCorrectionReference)
        throw new AttemptError(ErrorCode.enum.INVALID_INPUT, null)
      onRepositoryFailure?.(error, 'begin')
      throw new AttemptError(ErrorCode.enum.STORAGE_ERROR, null)
    }

    // Prepare to send the correction request and handle timeout
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    let responseDetails: Partial<Outcome> = {}
    let correctedText: string | null = null
    let isReasoningViolation = false
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
            { role: MessageRole.enum.system, content: prompt },
            { role: MessageRole.enum.user, content: text },
          ],
        },
        controller.signal,
        deps.isRejectReasoning,
      )

      // Wait for either the correction response or the timeout to occur
      const response = await Promise.race([correctionPromise, timeoutPromise])
      responseDetails = response.details
      isReasoningViolation =
        response.errorCode === ErrorCode.enum.REASONING_NOT_DISABLED &&
        response.correctedText !== null
      if (response.errorCode && !isReasoningViolation) throw new CorrectionError(response.errorCode)

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
      onRepositoryFailure?.(error, 'finish')
      throw new AttemptError(ErrorCode.enum.STORAGE_ERROR, ids)
    }

    if (errorCode) throw new AttemptError(errorCode, ids)

    if (isReasoningViolation) deps.onReasoningViolation?.(ids.requestId, input.data.modelId)

    return {
      ...ids,
      originalText: text,
      correctedText: correctedText!,
      modelId: input.data.modelId,
      mode: input.data.mode,
    }
  }
}
