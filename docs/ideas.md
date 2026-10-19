# Gramota ideas

A discussion backlog for improving everyday use. This is not the implementation
roadmap. Items come from another LLM's original suggestions and subsequent
conversation with the user. No item is authorized for implementation merely by
appearing here. Section order and IDs do not indicate priority.

## Contents

- [Direction and status](#direction-and-status)
- [Current baseline](#current-baseline)
- [Everyday workflow](#everyday-workflow)
- [Reviewing and controlling corrections](#reviewing-and-controlling-corrections)
- [Optional explanations and learning](#optional-explanations-and-learning)
- [Privacy and possible sharing](#privacy-and-possible-sharing)
- [Quality observations and future evaluation](#quality-observations-and-future-evaluation)
- [Ideas to leave aside for now](#ideas-to-leave-aside-for-now)
- [How to review this backlog](#how-to-review-this-backlog)

## Direction and status

The app is for personal use first. It may later be shared with relatives, friends
and a small invited circle with similar needs. Do not assume a public service,
commercial product or large user base.

The user's focus is the experience of the complete everyday task, not just visual
UI polish: bring text into Gramota, correct it, review it, copy it, and return to
the original conversation or app with as little friction as possible.

Finish deployment and learn from daily use before committing to a large feature
set. The remaining approved deployment work is recorded in the
[build plan](../blueprint/build-plan.md); it is not a new idea in this backlog.

| Status | Meaning |
| --- | --- |
| User-supported direction | The user expressed interest; details and implementation are not approved |
| Suggestion | Proposed by an agent; the user has not decided whether to build it |
| Conditional | Relevant only if the stated need appears |
| Available foundation | Some underlying behavior already exists; the proposed convenience may not |

The original LLM ranked explanations first. That ranking has not been adopted.
The user explicitly said these ideas have no concrete order of importance.

## Current baseline

Already implemented: paste/copy actions, Strict correction, local Text/Changes
diff, persistent history, phrase search, filters, sorting, pagination, transient
Sonner notifications, model switching and retained attempts for repeated input.

Gemma 4 is the default and Gemini 3.1 Flash Lite the alternative. The user considers
Gemini more expensive but has not established that it is substantially better.
The current UI still uses a model selector; replacing it is an idea below.

The user tested multiple phrases and styles and accepted the correction quality.
Keep the common strict-v3 prompt; separate style prompts have no demonstrated need.

## Everyday workflow

### UX-01: Preserve unfinished work

**Status:** Suggestion.

Switching apps, refreshing or reopening Gramota should not unnecessarily lose a
draft. First check what the current draft behavior already covers. Consider
retention across reopening only if useful, with a clear way to discard locally
retained text. Decide whether a result or only the original needs restoration.

### UX-02: Recover from accidental changes

**Status:** Suggestion.

Offer a simple way to undo accidental clearing or replacement of the original.
Make pasting over an existing draft predictable. Decide which actions need Undo
from observed mistakes rather than adding confirmation dialogs everywhere.

### UX-03: Start the next correction easily

**Status:** Suggestion.

After copying, a New correction action could clear the workspace and focus the
input. Keep it separate from Copy so copying does not unexpectedly erase work.
Coordinate with draft retention and Undo.

### UX-04: Reach the result and Copy comfortably on mobile

**Status:** Suggestion.

After a correction completes, make the result easy to reach without a jarring
scroll jump. Keep Copy accessible for longer results. Observe the real phone
workflow, including the on-screen keyboard, before choosing sticky controls or
automatic scrolling.

### UX-05: Make unchanged results unmistakable

**Status:** Suggestion; verify current behavior before changing it.

Clearly communicate No changes needed while keeping Copy available. A user should
not need to inspect the diff to distinguish an unchanged result from a request
that has not finished.

### UX-06: Light and dark themes

**Status:** User-supported direction.

Support comfortable use in different lighting conditions. A suggested approach
is to follow the device preference initially and remember a manual override.
The exact control and behavior remain to be designed.

### UX-07: Make the app quick to open

**Status:** Suggestion, after deployment.

Consider a phone home-screen shortcut so opening Gramota takes little effort.
Choose the smallest approach that works on the user's device; this does not
implicitly require offline correction, notifications or a full PWA feature set.

### UX-08: Desktop keyboard shortcut

**Status:** Suggestion.

Consider Ctrl+Enter to correct, retaining the visible button. Resolve platform
conventions and text-entry behavior when designing it.

### UX-09: Keep automation predictable

**Status:** Suggested design principle, not a new feature.

Keep copying and paid correction explicit. Do not automatically read the
clipboard, submit pasted text, or copy results without a deliberate user decision.
Saving a click is useful only when it does not introduce surprises.

## Reviewing and controlling corrections

### REVIEW-01: Ask for another opinion

**Status:** User-supported direction; available foundation.

Replace the model selector with Gemma as the normal Correct action. After a
result, offer Ask for another opinion using Gemini 3.1 Flash Lite when needed.
The user expects Gemma to handle most everyday requests because of its lower cost.

Suggested behavior to discuss:

- Send the identical original text to Gemini only after an explicit action.
- Keep both outputs and their recorded attempts; do not overwrite Gemma's result.
- Make it clear which result is being viewed and copied.
- Indicate the higher cost without implying higher quality.
- Asking Gemini once should not change the next message's default model.

Model switching and grouped attempts already exist. The new work would concern
the action, presentation and predictable default behavior, not a new model service.

### REVIEW-02: Edit the corrected result

**Status:** Suggestion.

Allow a small final adjustment before copying instead of forcing the user to
repair the text in another app. Preserve the original model output and distinguish
it from the edited final text. Decide whether edited text needs persistence.
This may be a smaller first step than per-change accept/reject controls.

### REVIEW-03: Group related diff changes

**Status:** Suggestion; use concrete examples to establish need.

Word-level or grouped changes may be easier to understand than separate character
and space edits, especially around punctuation and date formatting. Improve
readability without hiding actual differences or changing the copied text.
Meaningful spans may also help future explanation or accept/reject interactions.

### REVIEW-04: Accept or reject individual corrections

**Status:** Conditional on repeated need for finer control.

Rejecting one change could restore the original wording while retaining other
corrections. Related grammatical edits can depend on each other, so independent
accept/reject behavior needs careful definition. Consider editable output first.
Do not add stable edit IDs or a generalized edit system until the chosen behavior
actually needs them.

## Optional explanations and learning

### LEARN-01: Explain a correction on demand

**Status:** Suggestion. Valuable if understanding mistakes becomes a recurring goal.

A user explicitly asks why a correction was made. Ordinary correction remains a
single proofreading request with no automatic explanations or extra model calls.

Possible starting scope: explain one complete correction, then support a selected
passage if useful. A proposed request would receive the original, model output
and relevant passage, and explain rather than rewrite the message.

The explanation must be allowed to identify a questionable or unnecessary change,
rather than inventing a rule to defend every model correction. Explanation
quality must be evaluated separately from proofreading quality.

The original suggestion was to try Gemma first and compare Gemini only if needed.
That model choice is not yet decided or benchmarked for explanations.

### LEARN-02: Explanation depth

**Status:** Open design choice, dependent on LEARN-01.

Options discussed: one or two sentences, a more detailed explanation with examples,
or brief by default with an explicit Explain more action. The last option was
suggested by the other LLM; the user has not selected one.

### LEARN-03: Save requested explanations

**Status:** Conditional design note, dependent on LEARN-01.

Retrieve a saved explanation when reopened rather than paying for the same
request again. The original proposal linked explanations to existing correction
records instead of introducing a separate service.

Candidate metadata, not an approved schema: correction/request reference,
original and corrected passage, explanation, optional category, explanation
model, prompt version, usage and reported cost. Whole-result explanations may
not need passage identifiers. Define storage only after the user chooses scope.

### LEARN-04: Classify correction types

**Status:** Conditional on useful explanations or mistake review.

Possible categories: grammar, spelling, punctuation, awkward construction and
formatting. Consider generating categories alongside an explicitly requested
explanation, without an extra classification call for every ordinary correction.

### LEARN-05: Saved-mistakes notebook

**Status:** Conditional on a desire to revisit corrections.

Start with manually saved corrections or bookmarks, optionally with explanations.
Only consider recurring-mistake profiles, statistics or exercises if this simpler
review habit proves useful. No automatic learning profile is approved.

## Privacy and possible sharing

### SHARE-01: Delete saved messages

**Status:** Suggestion for personal use; important before sharing private histories.

Allow deliberate removal of sensitive history. Deletion scope and confirmation
need design: one attempt, a whole correction, or all history are different actions.
Do not assume automatic retention limits without a user decision.

### SHARE-02: Private access and separate histories

**Status:** Conditional on inviting other people.

Before relatives or friends use the same instance, decide how access works and
ensure one person's messages cannot be read by another. Keep OpenRouter keys
server-side. Choose a proportionate solution for a small invited circle; public
registration and account administration are not current requirements.

### SHARE-03: Spending safeguards

**Status:** Conditional on sharing or observed accidental spending.

Consider simple request limits or budgets so additional users cannot unexpectedly
consume the owner's API budget. The appropriate control depends on actual usage.
Do not introduce billing, subscriptions or a quota service for hypothetical scale.

## Quality observations and future evaluation

**Status:** Suggested observation areas, not an authorized benchmark run.

- Collect examples of wrong, excessive or difficult-to-review corrections.
- Check conversational fragments, colloquial vocabulary, profanity and incomplete
  sentences: correction should preserve the speaker's tone and intent.
- Inspect ambiguous dates and related word/space/punctuation changes for diff
  readability; avoid assuming an ambiguity can always be resolved automatically.
- Reconsider prompts or models when concrete examples justify another comparison.
- Keep personal example texts in ignored local cases, not in this tracked backlog.

Only the human may invoke benchmark commands, including preview. No agent-run
paid calls, automatic judge or reference-answer requirement is implied here.
See [manual benchmark instructions](benchmark.md).

## Ideas to leave aside for now

These were mentioned as possible later directions, not approved work:

- Chatbot interactions, automatic essays and broad rewriting modes.
- More model choices or different prompts for every style without evidence.
- Automatic explanations/classifications on every correction.
- Exercises, vocabulary lessons, automatic learning profiles and elaborate dashboards.
- Public signup, commercial features and infrastructure for hypothetical scale.

The useful distinction is between helping send a correct message and helping
study language. Both can be valuable, but the second is an optional product goal.

## How to review this backlog

Use the deployed app and record actual friction. When reviewing an item, ask:

1. What recurring inconvenience or need does it address?
2. Is current behavior already sufficient, or is there a smaller improvement?
3. Does it add actions, visual noise, model cost or persistent personal data?
4. What is the smallest behavior worth implementing and checking?

Record the user's decision and unresolved details before promoting an item into
[the project plan](../blueprint/project-plan.md),
[the roadmap](../blueprint/build-plan.md), or a feature/fix specification.
There is no scheduled implementation order in this file.
