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

- [ ] **V4.1 — Meaningful text-diff grouping research** — Complete the research-only investigation in [`docs/gramika_diff_grouping_research_brief.md`](../docs/gramika_diff_grouping_research_brief.md). Deliver the current-state audit, external research, approach comparison, Russian examples, recommendation and validation proposal. Do not implement grouping changes, modify prompts or make paid model calls during this research.
- [ ] **V4.2 — Translation** — Integrate the self-hosted LibreTranslate service and support translating selected text or the whole text. Define source/result scope and target-language behavior in the feature specification.
- [ ] **V4.3 — Russian dictionary definitions** — Add dictionary lookup for one selected word. Keep dictionary definitions separate from LLM-based Explain and define behavior for inflected or unsupported words.
- [ ] **V4.4 — Read aloud** — Add text-to-speech for the selected text surfaces, with playback controls, browser limitations and localized labels defined before implementation.
- [ ] **V4.5 — Multilingual interface** — Add French, Russian and English catalogs; detect the browser/device language on first launch; fall back to English; allow and remember an explicit language choice; keep interface language separate from correction language.
- [ ] **V4.6 — Separate user workspaces and histories** — Prevent relatives from sharing one workspace or history. Authentication, invitations, account creation, session handling and migration of existing data are intentionally deferred until this feature is planned.
- [ ] **V4.7 — Installation UX** — Improve mobile PWA discoverability and guidance with localized copy, clear install affordances, native prompts where available and understandable manual instructions where they are not. APK and React Native are out of scope.
- [ ] **V4.8 — History UX redesign** — Make History clear and usable while preserving its working search, filters, sorting, pagination, deletion, result inspection, explanations, copy actions and request metrics.
- [ ] **V4.9 — General UX improvement** — Improve the main correction flow, mobile navigation, copy/result feedback, empty/loading/error states and first-use comprehension while preserving working correction behavior.

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
