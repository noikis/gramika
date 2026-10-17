# Feature: Model selection and repeated corrections

**From build-plan:** feature 5
**Build attempt:** 1
**Status:** verified
**Branch:** feature/model-selection-and-repeated-corrections

## Goal

Choose a model in Correction and explicitly repeat an unchanged original, retaining each attempt and its reported metrics in History.

## Design reference

Use the approved `prototypes/correction.html`, `prototypes/history.html` and `prototypes/theme.css`. Preserve English UI, local Roboto, compact selector above Original, blue-black surfaces, emerald actions and mobile layout. Keep metrics in History.

## In scope

- Fixed shortlist: Qwen 3.7 Flash (`qwen/qwen3.7-flash`), Gemma 4 26B A4B (`google/gemma-4-26b-a4b-it`), Qwen 3.5 Flash (`qwen/qwen3.5-flash-02-23`), DeepSeek V3.2 (`deepseek/deepseek-v3.2`), Qwen 3.8 27B (`qwen/qwen3.8-27b`, added at user request).
- Persist the selected model in SQLite. Initial default remains Qwen 3.5 Flash.
- Reasoning always disabled, with no reasoning control or automatic fallback. GPT-5 Nano excluded by explicit user decision.
- Repeats only in Correction, with the same or another model. Each run requires an explicit Correct click and creates a new request record.
- Unchanged original in the current editor session reuses its known correction ID. Submitting changed text creates a new correction. Preserve every previous result and metric.

## Out of scope

History rerun actions, catalog discovery, pricing, recommendation labels, benchmark screens, automatic evaluation, streaming, retries, caching, Cancel, prompt changes, deployment and authentication. No new dependencies expected.

## Build loop

Approve this spec before `/implement`. Use the recorded branch, small implementation steps and one feature-level review packet. Checkpoint commits disabled. Reviews and live UI checks are manual; no reviewer sub-agents. `/complete` creates the final commit/archive after acceptance; never push.

## Build steps

- [x] **1. Model contracts and persisted preference.** Replace fixed-model literals with a shared shortlist for new writes, keeping historical model strings readable. Add a versioned SQLite migration for one selected-model setting, initialized to the baseline. Extend config and add a validated preference update route.
  **Done when:** isolated database/API tests prove initial default, persistence after reopen, unknown-ID rejection without changing the preference, safe save failures, and preservation of existing history. Preference/config operations never invoke transport.

- [x] **2. Model-specific attempts and repeat grouping.** Accept selected model and optional correction ID. Validate before paid work. Append a new request only when the referenced correction exists and its original exactly matches; otherwise create a new correction and first request atomically. Snapshot model/parameters per attempt and preserve existing reasoning checks, timeout, metadata and terminal handling.
  **Done when:** mocked transport/temporary SQLite tests prove separate same/different-model attempts on one correction, retained earlier results after failures, new corrections for changed originals, no upstream calls for invalid IDs/models or mismatched originals, and disabled reasoning for every model. Existing server tests pass.

- [x] **3. Editor selector and explicit repeat action.** Load/save preference with loading/error feedback. Disable selector during saving/submission while retaining draft editing during a correction. Enable Correct for an unchanged successful original. Track the latest known original/correction ID, including IDs returned on failed attempts. Prevent overlapping submissions; identify the actual model of the visible result so changing selection cannot relabel an old result. Use shared model labels in History, retaining unknown historical IDs verbatim.
  **Done when:** web build/lint pass. User review covers model selection/reload persistence, same/different-model repeats, save/request failures, changed originals and multiple requests in History. Changes remains default and Copy always copies clean text. Desktop/mobile and keyboard checks remain explicitly pending until observed by the user.

## Files / areas

- `packages/contracts/src/index.ts`: shortlist, config, preference and correction contracts.
- `apps/server/src/database.ts`: migration, preference and append-request operation; existing database tests.
- `apps/server/src/correction-api.ts`, `correction-service.ts`: validated routes, per-request snapshots and repeat grouping; API/service tests.
- `apps/web/src/use-correction.ts`, `components/correction-workspace.tsx`: selection, feedback and repeat association.
- `apps/web/src/lib/history-format.ts` and relevant History rendering: model labels. Preserve existing local diff and clipboard code.

## Data / contracts

- Closed model enum for new submissions/preferences; historical requested/returned model fields remain strings. Preserve existing UUIDs, exact originals, timestamps, outcomes and nullable provider-reported metrics. Never calculate token totals, costs or provider generation time.
- Config returns allowed `{id, name}` choices and persisted selected model. `PUT /api/model-preference` accepts strict `{modelId}` and returns saved `{modelId}`. Invalid input: 400; storage unavailable: 503 with safe error. Save failure retains the previous confirmed selection and offers retry. An unsupported stored value requires an explicit valid choice, never silent substitution.
- `POST /api/corrections` accepts strict `{text, modelId, correctionId?}`. Optional correction ID must be a UUID referencing an existing correction with exactly equal original text. Invalid/missing/mismatched references or unsupported models return the existing safe INVALID_INPUT shape before recording an attempt or calling upstream. Preserve STORAGE_ERROR handling.
- Each accepted run gets a new request UUID and immutable requested-model, prompt-version and parameter snapshot. Never overwrite an original or previous request. New correction plus first request is atomic. Preference is one local application setting; an explicit submitted model cannot be changed by another preference save while running.
- Editor association is the latest known submitted original/correction pair. Editing and restoring before submission retains that association; submitting different text replaces it. Reload starts a new session without searching History for matching text. If a network failure hides IDs, do not guess an association, reconcile automatically or retry.
- Previous attempts remain readable in History during/after a repeat. Main editor retains existing submitted-original/result association when the draft changes; a completed request never overwrites draft edits. Unknown preference, save failure and request failure have concise associated accessible feedback and retry paths; selector remains disabled until config loads. Model selection never starts inference.

## Testing

Use mocked transport and temporary fictional SQLite databases with `npm test -w apps/server`. Include migration/reopen, invalid/save-failed preferences, exact-original validation, distinct outcomes, model snapshots and reasoning-disabled cases. Config/history/preference operations must make no transport calls. Every model sends only the prompt and current original, never History.

Run `npm run build -w apps/web` and `npm run lint -w apps/web` once after implementation. No root Verify or browser test command exists. Reuse unchanged passing evidence at completion. User performs live UI/model acceptance; do not claim unobserved visual or provider behavior.

## Notes for the AI

Use the user's exact strict-v3 prompt (updated at user request), 5,000-character limit, 60-second timeout for all models (increased at user request), 8,192 output-token cap, no retries and completion after browser disconnect. Keep the existing Undici transport and OpenRouter metadata header. OpenRouter stays server-only; Home Lab requires its configured proxy with no direct fallback.

Never read private env files, keys or personal saved records. Never make OpenRouter API requests, install dependencies or start dev servers. Ask explicit target/action permission before any future Playwright call. Reviews remain user-controlled.

Public documentation reviewed during planning, without inference requests:

- [Qwen 3.8 27B on OpenRouter](https://openrouter.ai/qwen/qwen3.8-27b): flexible thinking can be enabled or disabled. Uses the same reasoning-disabled settings and rejection checks as the other models.

- [Alibaba thinking guide](https://www.alibabacloud.com/help/en/model-studio/deep-thinking): Qwen hybrid models support disabling thinking.
- [Gemma 4 prompt format](https://ai.google.dev/gemma/docs/core/prompt-formatting-gemma4): thinking can be disabled; Google warns larger models may occasionally emit a thought channel anyway. Preserve rejection of reported reasoning text/nonzero reasoning tokens. Do not promise an upstream violation cannot incur cost or alter the correction prompt to compensate.
- [DeepSeek V3.2 release](https://api-docs.deepseek.com/news/news251201/): thinking and non-thinking modes.
- [GPT-5 reasoning documentation](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5_new_params_and_tools#4-minimal-reasoning): minimal can consume reasoning tokens; user chose to exclude GPT-5 Nano.

Provider rejection/unavailability becomes a saved failed attempt, never an automatic model/settings change or another paid request. Public documentation establishes intended settings; the user's live testing confirms current OpenRouter/provider behavior.

## Verification

Implementation verified by automated checks. User accepted Feature 5 as complete; comparative model benchmarking remains a separate manual task. No comprehensive browser acceptance is claimed.

- `node --test -r ts-node/register test/model-selection.test.ts` from apps/server: 6 focused tests passed.
- `npm test -w apps/server`: 41 tests passed, including migration/reopen, saved preference, safe failures, repeat association and independent model snapshots.
- `npm run build -w apps/web`: passed.
- `npm run lint -w apps/web`: passed.
- No private env contents, personal database records or keys inspected. No OpenRouter inference/API calls, dev servers, browser checks or dependency installation performed.
- Audit, independent review and agent live check are manual and were not run. Findings and review ledgers have no active entries. Preference selection/reload provides a safe manual demonstration without inference; paid model acceptance remains user-controlled.
- Unrelated transport formatting changes appeared during implementation and were preserved.
- No commit, merge or push performed. Next: user review, then `/complete`.

User-requested shortlist update: added Qwen 3.8 27B. Contracts build and all 6 focused model-selection tests passed again with five models; other earlier checks were not repeated. No OpenRouter requests made.

User-requested timeout update: 60 seconds for every model. Contracts build and two focused timeout tests passed, including simulated 59,999 ms / 60,000 ms checks for every model. No upstream requests made.

## Completion

Accepted by the user on 2026-10-18. Five model choices, persisted selection, editor-only repeats, 60-second timeout and the user's exact strict-v3 prompt are included. The focused mocked request test passed after the prompt update. Earlier automated evidence is retained without rerunning builds, tests or lint during completion.

Model benchmarking remains user-owned and is not a blocker for Feature 5. No automatic review or live OpenRouter request was performed. User formatting edits to history-api.ts and openrouter.ts and the untracked env example are excluded from the feature commit and preserved locally. Prototypes are retained as references; this feature did not port shared theme tokens.
