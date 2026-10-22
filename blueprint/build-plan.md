# Build Plan

**V1 finished: 2026-10-20.** All active roadmap features are complete and accepted
by the user. Backup/restore (6c) is deferred, not implemented.

This is the completed V1 roadmap. New scope requires a user decision; suggestions
in `docs/ideas.md` are not active work.

## Design and scope references

- [Project plan](project-plan.md): product requirements and constraints.
- [Prototype handoff](../prototypes/README.md): approved visual references.

## Features

- [x] 1. **Responsive correction workspace** - Implement the approved React editor and navigation with shared theme tokens, Tailwind/shadcn integration, Original/Result labels, text entry and working Paste with manual fallback; support desktop and mobile layouts and honest empty/unavailable states without simulated corrections or fictional history.
- [x] 2. **Strict correction with automatic request recording** - Connect Correct to Fastify and one verified OpenRouter model with reasoning disabled, shared Zod contracts and a versioned prompt; persist originals, results, available usage/cost/timing and failed attempts in SQLite, provide clean-result Copy, preserve input on failure and enforce the environment-specific proxy rules.
- [x] 3. **Inspect changes in correction results** - Compute safe local diffs, enable the approved Text/Changes switch with Changes selected by default, preserve whitespace and Unicode, handle unchanged text, and always copy the clean corrected result regardless of the selected view.
- [x] 4. **Expandable correction history and request details** - Implement the approved History screen using persisted records, with preview/date/model summaries and expanded originals, individual results, Text/Changes views, Copy and request metrics; handle empty history, failed requests and unavailable metrics without fabricated values.
- [x] 5. **Model selection and repeated corrections** - Activate the model selector with Gemma 4 as default and Gemini 3.1 Flash Lite as the alternative, persist the selected preference, and retain separate request results and metrics when the same original is corrected again with the same or another model.
- [x] 6. **Production operation and persistent storage** - Package the API and built frontend for one container with persistent SQLite storage, validated mandatory proxy configuration and health checks; verify restart persistence and absence of direct OpenRouter fallback without introducing authentication or external-access infrastructure.
  - [x] 6a. **Diagnostic logging and health** - Minimal privacy-safe failure logs using the existing Fastify logger and one local GET /health endpoint; no VPN probes or success-request logs.
  - [x] 6b. **Single-container packaging and persistent SQLite** - Serve the built frontend and API together, ship migrations, configure a persistent volume and verify persistence through recreation and the mandatory proxy policy.
  - Deferred by the user on 2026-10-20: **6c. Backup and restore**. Current data does not justify this work; it is outside the active roadmap and was not implemented.

The single local health endpoint belongs to 6a; container log rotation belongs to
6b. Local health does not establish upstream availability. VPN/proxy reachability
monitoring remains outside the delivered scope.

## Verification and future work

Current product contracts live in the project plan and source; implementation
details and evidence remain in `blueprint/history/`. Earlier partial-feature
states and setup decisions are historical, not instructions for the finished app.

Ordinary tests use isolated SQLite and mocked OpenRouter responses. Paid model
evaluation is human-only, including benchmark preview. Browser work requires
explicit Playwright MCP permission and the relevant mobile/clipboard checks.
The user's production confirmation and earlier VPN-off observation are manual
evidence; they do not separately prove proxy routing or secure phone clipboard.

Future work follows AGENTS.md and requires approved scope. This roadmap grants
no permission to commit, push, deploy, connect over SSH or make paid calls.

## Completed follow-up work

Manual V3 benchmark and model selection were completed and merged on 2026-10-19.
History search/filter/sort/pagination and transient Sonner feedback are also
implemented. See `blueprint/history/` for completed specifications. These do not
add unfinished roadmap items. Unreviewed `docs/ideas.md` is outside this roadmap.

## V2 roadmap

The user agreed on these V2 tasks and their order on 2026-10-21. These are
roadmap entries, not implementation specifications. Define acceptance criteria
and unresolved behavior separately when starting each task. Earlier features
use the current UI with necessary adjustments; UI direction is chosen at V2.6.

- [x] **V2.1 — Improve diff readability:** make dense edits and substantial word changes easier to review. Completed and approved by the user on 2026-10-21; Git completion/landing remains separate.
- [ ] **V2.1a — History costs in Russian kopecks:** next small follow-up before V2.2. Convert all displayed history costs from their stored USD values to kopecks in the frontend using a free USD/RUB exchange-rate API; use a Russian kopeck unit label. If the API is unavailable or conversion fails, show the USD amount instead. Planning only; not implemented. See the contract below.
- [x] **V2.2 - Rewrite mode:** explicitly request alternative wording, adapting the extent of rewriting to the text while preserving meaning and voice; retain Strict as the default. Working UI label: Gentle rewrite. Completed 2026-10-21; rewrite-v1 accepted by the user and unchanged. See [archive](history/features/V2.2-rewrite-mode.md).
- [x] **V2.3 — Another opinion:** replace the model selector with Gemma as the normal correction action and an explicit Gemini second opinion; retain both results.
- [x] **V2.4 - Selected-correction explanations:** completed and closed at the user's request on 2026-10-22. Shipped Strict Explain in workspace and History, saved reuse, Explain Run benchmarks, and Gemini minimal reasoning. See [completion record](history/features/V2.4-selected-correction-explanations.md).
  - [x] **Strict Explain and Explain Run:** implemented, tested and pushed by the user. See [implementation archive](history/features/V2.4-phase-1-strict-explain-and-benchmarks.md).
  - Deferred work: Rewrite Explain and application explanation metrics/cost reporting. Rewrite support is not implemented; retain its requirements in the [handoff](context/v2.4-explain-handoff.md).
- [x] **V2.5 — Soft-delete history:** allow history records to be removed from normal views while retaining them in storage. Completed at the user's request on 2026-10-21. See [archive](history/features/V2.5-soft-delete-history.md). Whole-entry deletion, no Trash/restore screen.
- [x] **V2.6 — Choose the UI direction:** explore and approve the visual design and interactions after the preceding features are usable. Completed and approved 2026-10-22; see [archive](history/features/V2.6-choose-the-ui-direction.md).
- [x] **V2.7 — Implement the UI redesign:** include light/dark themes, system preference with manual override, New correction, better mobile access to results and Copy, and Ctrl+Enter submission. Revisit existing feedback presentation. Completed and approved 2026-10-22; see [archive](history/features/V2.7-implement-the-ui-redesign.md).
- [ ] **V2.8 — Minimal installable PWA:** support phone installation and home-screen launch; offline functionality remains deferred. Caching/local persistence is separate V2.11 work.
- [x] **V2.9 - Fix history filter correctness:** supported model choices, matching-request display and consistent combined filters/pagination. Completed and approved 2026-10-22; see [archive](history/features/V2.9-fix-history-filter-correctness.md).
- [x] **V2.10 - Fix failed requests and recover usable output:** show complete valid corrected text normally despite reasoning-setting violations; log the violation only and retain costs. Cover workspace and history. Completed and approved 2026-10-22; see [archive](history/features/V2.10-fix-failed-requests-and-recover-usable-output.md).
- [ ] **V2.11 - Caching and local storage:** implement deliberate cache reuse and browser persistence, with retention, refresh and clearing behavior defined in its spec. Approved 2026-10-22; see contract below.

### V2.1a planning contract — History costs in Russian kopecks

Approved for the roadmap on 2026-10-21; do not implement until separately requested.
Keep V2.2 and later identifiers unchanged. This follow-up may use the current
readable-diff branch if still active when implementation is requested.

- Apply to all four history cost fields: request cost, upstream total, upstream
  input and upstream output cost.
- Fetch the USD-to-RUB rate from a free API directly in the frontend, then display
  `USD amount × RUB per USD × 100` as kopecks. Use a Russian unit word
  (`копейка` / `копейки` / `копеек`, appropriate to the displayed number), including
  fractional kopecks. Keep small nonzero amounts readable rather than rounding
  them to zero.
- If the rate cannot be obtained or used (network/API error, timeout, malformed
  response, missing RUB rate or invalid rate), display the original amount with
  an explicit USD label. Do not invent a rate or show failed conversions as zero.
- Keep stored/provider amounts in USD. No server conversion, backend endpoint,
  database migration, paid API or secret embedded in the frontend. Only a public
  exchange-rate request is needed; never send correction text or history to it.
- Preserve true zero and missing-cost behavior; an unavailable cost remains
  unavailable regardless of exchange-rate availability.
- Select and verify a free browser-compatible API, rounding precision, rate
  freshness/reuse and the loading display when writing the implementation spec.
  Verify both successful conversion and USD fallback with mocked responses.

## Approved V2 follow-ups

V2.9-V2.11 are committed delivery scope, not optional ideas. Define and review
each implementation spec before coding. Their IDs preserve the existing roadmap;
execution order can be chosen separately, including prioritizing fixes before PWA.

### V2.9 contract: History filter correctness

**Status:** Implemented, verified and approved on 2026-10-22. See the
[completion archive](history/features/V2.9-fix-history-filter-correctness.md).
Separate from the completed V2.7 visual redesign.

- The model filter offers DeepSeek and Qwen despite those models no longer
  being available in the app. Review the source of options and restrict the
  picker to the supported model choices. Preserve existing historical records.
- Filtering by Failed can return an entry with multiple model requests and
  display both failed and successful requests. Expanded entries should show
  only requests matching the selected result/model filters, while retaining
  the original text and access to matching request details.
- Verify model and result filters together against the same request, plus
  search, date bounds, sorting, pagination, reset and empty-result behavior.
  Use synthetic history fixtures with mixed request outcomes and models.

This is a correctness fix, not another filter styling pass. Diagnose frontend
display and backend search behavior before choosing the implementation scope;
no server changes are authorized by recording this backlog item.

### V2.10 contract: Failed requests and recoverable model output

**Status:** Approved V2 fix, committed to the roadmap on 2026-10-22.
Implemented and approved on 2026-10-22; see the
[completion archive](history/features/V2.10-fix-failed-requests-and-recover-usable-output.md).

The user observes requests rejected for not respecting the reasoning setting,
while usage/cost is recorded and generated output appears to have been returned.
They want the response shown when usable corrected text exists, rather than
discarded or hidden solely because reasoning was returned.

- Inspect the response, validation and persistence paths to establish what is
  received, retained and currently available to the UI. Recorded cost alone
  does not prove a complete usable correction exists.
- User clarification on 2026-10-22: treat complete valid corrected text as a normal
  successful response even if reasoning was returned. The reasoning-setting
  violation is an implementation detail to log only, with no user-facing warning,
  error or retry prompt. Keep actual reported costs and never display internal
  reasoning as the correction.
- Review other failure cases and distinguish recoverable output from missing,
  malformed or incomplete responses. Keep the original text available and
  explain what happened without concealing returned usable output.
- Cover the workspace and history, coordinating failure/result classification
  with V2.9 so successful results, filters and details remain consistent.
- Determine whether historical rejected output was saved and can be recovered;
  do not promise recovery of data that was never persisted. Verify using mocked
  responses, without paid model requests.

The implemented policy accepts complete valid correction text and logs reasoning
setting violations only. Request reasoning settings and prompts are unchanged.

### V2.11 contract: Caching and local storage

**Status:** Approved V2 feature, committed to the roadmap on 2026-10-22.
Not implemented; exact persistence, reuse, retention and clear behavior will
be decided in its specification.

Review caching and browser-local persistence together, while distinguishing
temporary reuse from data that should survive reloads or reopening the app.

- Inspect existing behavior first, including drafts, saved explanations, model
  preferences and the cached exchange rate. Avoid duplicating existing caches.
- Decide what should persist locally, what should only be cached temporarily,
  and when data should expire, refresh or be cleared. Coordinate draft retention
  and recovery with UX-01 and UX-02.
- Define cache identity and invalidation for any correction/explanation reuse,
  including text, selected change, mode, model and relevant versions. Choose
  this only where reuse is actually wanted; do not silently change paid actions.
- Decide how local storage relates to server history and deletion. Do not
  introduce local copies of personal text or history until retention and clear
  behavior are agreed. Handle unavailable browser storage without losing the
  current editing session.
- Reconcile any chosen persistence changes with the existing session-only theme
  override and V2.8's minimal installation scope. This backlog item does not
  automatically add offline correction or offline history to the PWA.
