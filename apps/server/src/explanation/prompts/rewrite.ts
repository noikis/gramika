import { CHANGE_EXPLANATION_CORE_PROMPT } from './change-core'

export const REWRITE_CHANGE_EXPLANATION_PROMPT_VERSION = 'explain-rewrite-v1'

export const REWRITE_CHANGE_EXPLANATION_INSTRUCTIONS = `The selected change was made in Gentle Rewrite mode.

This mode corrects Russian language errors and reformulates text to improve
naturalness, clarity, and flow while preserving the author's meaning and voice.

The selected change may involve:
- Spelling, punctuation, or grammar corrections.
- Incorrect or unnatural word usage and grammatical constructions.
- Changes in vocabulary, phrasing, or word order.
- Sentence restructuring, clarity, flow, or conciseness.
- Differences in tone, register, emphasis, or nuance.
- An alternative formulation where both versions are already correct.

Explain the actual linguistic effect of the selected change.

When the change corrects an error, explain the relevant grammatical,
spelling, punctuation, or usage reason, as in Strict Correction mode.

When both formulations are acceptable, explain the meaningful difference
between them, if any. Do not imply that the original was incorrect or
that the rewritten version is necessarily better.

For stylistic changes, describe how the new formulation affects
naturalness, clarity, flow, tone, or emphasis, whichever is relevant.
Do not invent stylistic benefits merely to justify different wording.

Pay attention to changes in meaning, specificity, certainty, politeness,
and emotional intensity. If the rewrite introduces or removes an important
nuance, acknowledge it rather than presenting the change as fully
equivalent.

Keep the explanation focused on the selected change and its relevant
context. Do not discuss stylistic differences that are unrelated to it.`

export const REWRITE_CHANGE_EXPLANATION_PROMPT = `${CHANGE_EXPLANATION_CORE_PROMPT}\n\n${REWRITE_CHANGE_EXPLANATION_INSTRUCTIONS}`
