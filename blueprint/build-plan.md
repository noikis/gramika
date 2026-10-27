# Build Plan

This file is the concise roadmap and status index for Gramika. It records what
is active, deferred, rejected or completed. Detailed requirements belong in the
project plan, feature specifications and completion history.

## Current active roadmap: V4

This is a proposed order based on implementation autonomy, not a final delivery
commitment. Research and bounded technical investigations come first; work that
needs product, architecture or UX decisions from the user comes later. Each
item needs its own feature specification and acceptance criteria before
implementation.

- [x] **V4.1 — Meaningful text-diff grouping research** — Research deliverable identified and accepted by the user: [`docs/text-diff-improvement-spec.md`](../docs/text-diff-improvement-spec.md), resulting from the [research brief](../docs/gramika_diff_grouping_research_brief.md). Implementation is tracked separately under V4.2.
- [ ] **V4.2 — Text-diff improvements** — Implement only Steps 1–5 of the [improvement specification](../docs/text-diff-improvement-spec.md), as five separate improvements under the delivery contract below. Steps 6 and 7 are excluded from this workflow.
- [ ] **V4.3 — Translation** — Integrate the self-hosted LibreTranslate service and support translating selected text or the whole text. Define source/result scope and target-language behavior in the feature specification.
- [ ] **V4.4 — Russian dictionary definitions** — Add dictionary lookup for one selected word. Keep dictionary definitions separate from LLM-based Explain and define behavior for inflected or unsupported words.
- [ ] **V4.5 — Read aloud** — Add text-to-speech for the selected text surfaces, with playback controls, browser limitations and localized labels defined before implementation.
- [ ] **V4.6 — Multilingual interface** — Add French, Russian and English catalogs; detect the browser/device language on first launch; fall back to English; allow and remember an explicit language choice; keep interface language separate from correction language.
- [ ] **V4.7 — Separate user workspaces and histories** — Prevent relatives from sharing one workspace or history. Authentication, invitations, account creation, session handling and migration of existing data are intentionally deferred until this feature is planned.
- [ ] **V4.8 — Installation UX** — Improve mobile PWA discoverability and guidance with localized copy, clear install affordances, native prompts where available and understandable manual instructions where they are not. APK and React Native are out of scope.
- [ ] **V4.9 — History UX redesign** — Make History clear and usable while preserving its working search, filters, sorting, pagination, deletion, result inspection, explanations, copy actions and request metrics.
- [ ] **V4.10 — General UX improvement** — Improve the main correction flow, mobile navigation, copy/result feedback, empty/loading/error states and first-use comprehension while preserving working correction behavior.

### V4.2 delivery contract — one improvement at a time

User decision (2026-10-27): each numbered step is a separate work item, not
an implementation subtask to batch into one feature. Use the specification's
matching section for detailed requirements and acceptance criteria.

- [x] **V4.2.1 — Regression and evaluation framework** (spec Step 1): extend the existing `node:test` suite, add synthetic fixtures and structural checks, and save baseline/comparison JSON and Markdown reports. Do not change product behavior.
- [ ] **V4.2.2 — Visible whitespace in comparison cards** (spec Step 2): distinguish changed whitespace, unchanged context and empty sides without changing source text or diff behavior.
- [ ] **V4.2.3 — Separator replacement normalization** (spec Step 3): represent supported space/hyphen replacements as one coherent change while preserving exact spans and unrelated corrections.
- [ ] **V4.2.4 — Punctuation and token-replacement cleanup** (spec Step 4): apply narrow local rules for punctuation replacements and associated spacing, preserving independent corrections and movements.
- [ ] **V4.2.5 — Rewrite alignment confidence** (spec Step 5): evaluate conservative phrase fallback behind an internal flag; preserve clear local corrections and enable only after reviewed baseline comparisons demonstrate improvement.

For every item, prepare its own `current-feature.md` and obtain the user's
spec approval before implementation. Implement and test only that item, then
present the results for manual user review. Do not start the next item until
the previous item has been tested and explicitly approved by the user.
Passing automated tests alone is not approval. Archive and complete each
approved item separately using the project's lightweight completion policy;
mark V4.2 complete only after all five items are accepted.

After V4.2.4, explicitly review the accumulated results with the user before
starting V4.2.5. Spec Step 6 (selective meaningful grouping) and Step 7
(LLM-assisted grouping) are excluded, not automatic follow-up work. They
require a separate future roadmap decision.

Preserve synchronous deterministic `diffText()`, UTF-16 offsets, exact spans,
movement markers, manual selection and browser/server Explain compatibility.
Use mocked transports for integration tests; do not run model benchmarks or
paid calls. Keep prompts unchanged. Playwright MCP requires explicit permission.

Agent handoff: start with V4.2.1, inspect the current code and tests, and use the
linked specification as the detailed source. Do not overwrite another active
work item's spec: reconcile the existing checkout's active work with the user
before replacing it. This roadmap authorizes planning scope, not a batch run
of all five improvements or Git landing operations.

## Deferred or rejected work

These items are recorded so their status is not confused with completed work.
They are not part of the active V4 implementation queue unless the user
reopens them.

- **V1 6c — Backup and restore:** deferred by the user on 2026-10-20; not implemented because the current data did not justify it.
- **Application explanation metrics/cost reporting:** deferred; not implemented.
- **V3.2 — Export:** rejected/deferred by the user on 2026-10-26; not implemented. Earlier checked status was corrected here so it is not presented as delivered.
- **V3.5 — Contextual original-versus-edited comparison:** cancelled/deferred by the user on 2026-10-26; not implemented. Existing Explain and manual selection remain the supported behavior.

## Completed delivery history

The following work is implemented and accepted. Completion archives contain
the detailed specifications and verification evidence.

### V1 — completed 2026-10-20

- **1 — Responsive correction workspace**
- **2 — Strict correction and request recording**
- **3 — Local change inspection and clean-result copying**
- **4 — Expandable correction history and request details**
- **5 — Model selection and repeated corrections**
- **6a — Diagnostic logging and health**
- **6b — Single-container packaging and persistent SQLite**

### V2 — completed except for deferred items above

- **V2.1 — Improve diff readability** — completed and approved 2026-10-21.
- **V2.1a — History costs in Russian kopecks** — implemented in commit `d6d8de0`; kopeck formatting, rate conversion and USD fallback are included.
- **V2.2 — Gentle rewrite mode** — [completion archive](history/features/V2.2-rewrite-mode.md).
- **V2.3 — Another opinion** — completed.
- **V2.4 — Selected-correction explanations** — [completion record](history/features/V2.4-selected-correction-explanations.md).
- **V2.4a — Rewrite Explain V1** — [completion archive](history/features/V2.4a-rewrite-explain-v1.md).
- **V2.5 — Soft-delete history** — [completion archive](history/features/V2.5-soft-delete-history.md).
- **V2.6 — Choose the UI direction** — [completion archive](history/features/V2.6-choose-the-ui-direction.md).
- **V2.7 — Implement the UI redesign** — [completion archive](history/features/V2.7-implement-the-ui-redesign.md).
- **V2.8 — Minimal installable PWA** — [completion archive](history/features/V2.8-minimal-installable-pwa.md); real OS installation remains unverified.
- **V2.9 — History filter correctness** — [completion archive](history/features/V2.9-fix-history-filter-correctness.md).
- **V2.10 — Failed requests and usable output** — [completion archive](history/features/V2.10-fix-failed-requests-and-recover-usable-output.md).
- **V2.11a — Correction caching** — [completion archive](history/features/V2.11a-correction-caching.md).
- **V2.11b — Browser persistence** — [completion archive](history/features/V2.11b-browser-persistence.md).

### V3 — completed items

- **V3.0 — UI fixes** — completed.
- **V3.1 — Text-diff stabilization** — completed.
- **V3.3 — Manual selection in edited text** — completed.
- **V3.4 — Manual selection in original text** — completed.

## Project references

- [Project plan](project-plan.md) — product requirements, constraints and architecture.
- [Project overview](context/project-overview.md) — generated working context.
- [Completion history](history/) — detailed feature specifications and evidence.
- [Container operations](../docs/container.md) — local production packaging and storage.
- [PWA scope](../docs/pwa.md) — current installation and branding contract.

## Workflow and verification boundaries

Start one feature or fix at a time with a current specification. Run relevant
local checks during implementation and preserve existing evidence when the code
is unchanged. Manual benchmarks and paid model calls remain human-only. Browser
work through Playwright MCP requires explicit user permission. This roadmap
does not authorize commits, merges, pushes, deployment, SSH connections or
destructive data operations.
