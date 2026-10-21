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
- [ ] **V2.2 - Rewrite mode:** explicitly request alternative wording, adapting the extent of rewriting to the text while preserving meaning and voice; retain Strict as the default. Working UI label: Gentle rewrite. Approved implementation steps are in the active V2.2 spec on feature/rewrite-mode.
- [ ] **V2.3 — Another opinion:** replace the model selector with Gemma as the normal correction action and an explicit Gemini second opinion; retain both results.
- [ ] **V2.4 — Selected-correction explanations:** explain a requested word or phrase correction rather than the whole result; save explanations for reuse.
- [ ] **V2.5 — Soft-delete history:** allow history records to be removed from normal views while retaining them in storage.
- [ ] **V2.6 — Choose the UI direction:** explore and approve the visual design and interactions after the preceding features are usable.
- [ ] **V2.7 — Implement the UI redesign:** include light/dark themes, system preference with manual override, New correction, better mobile access to results and Copy, and Ctrl+Enter submission. Revisit existing feedback presentation.
- [ ] **V2.8 — Minimal installable PWA:** support phone installation and home-screen launch; defer offline functionality and local-storage decisions.

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
