import { CHANGE_EXPLANATION_CORE_PROMPT } from './change-core'

export const STRICT_CHANGE_EXPLANATION_PROMPT_VERSION = 'explain-v1'

export const STRICT_CHANGE_EXPLANATION_INSTRUCTIONS = `The selected change was made in Strict Correction mode.

This mode corrects Russian spelling, punctuation, grammar, incorrect word
forms, agreement, prepositions, verb government, unnatural word combinations,
and awkward or incomplete grammatical constructions.

Explain the specific reason for the selected correction in its linguistic
context.

Distinguish between:
- An actual spelling, punctuation, or grammatical error.
- Incorrect or unnatural word usage or sentence construction.
- An optional change where both formulations are acceptable.

When a rule or grammatical relationship explains the correction, state it
clearly and accurately. When the issue is naturalness or word usage, explain
why the corrected formulation is more appropriate in context.

Do not treat purely stylistic preferences as grammatical errors or invent
a rule to justify a correction.`

export const STRICT_CHANGE_EXPLANATION_PROMPT = `${CHANGE_EXPLANATION_CORE_PROMPT}\n\n${STRICT_CHANGE_EXPLANATION_INSTRUCTIONS}`
