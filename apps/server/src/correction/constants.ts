import { DEFAULT_MODEL_ID } from '@gramota/contracts'

export const STRICT_PROMPT_VERSION = 'strict-v3'

export const REWRITE_PROMPT_VERSION = 'rewrite-v1'

export const OPENROUTER_REQUEST_DEFAULTS = {
  model: DEFAULT_MODEL_ID,
  stream: false,
  reasoning: { enabled: false },
  max_tokens: 8192,
  provider: {
    require_parameters: true,
    allow_fallbacks: false,
  },
}
