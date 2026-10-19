# Build Plan

Build the approved Gramota MVP in small, reviewable features. The application is
already scaffolded and both UI prototypes are approved; do not repeat those steps.

## Design and scope references

- [Project plan](project-plan.md): product requirements and constraints.
- [Correction prototype](../prototypes/correction.html): editor, model selection,
  result views and clipboard actions.
- [History prototype](../prototypes/history-v2.html): searchable history and
  individual request results and metrics.
- [Prototype handoff](../prototypes/README.md) and
  [shared theme](../prototypes/theme.css): approved visual decisions and tokens.

Preserve the blue-black surfaces, emerald actions, locally bundled Roboto and
English UI labels. Support desktop and mobile deliberately: side-by-side editors
on wide screens, stacked editors and full-width primary actions on narrow screens.
The prototype breakpoint is 720px; verify the implementation at narrow phone,
intermediate and desktop widths rather than assuming the CSS proves usability.

## Features

- [x] 1. **Responsive correction workspace** - Implement the approved React editor and navigation with shared theme tokens, Tailwind/shadcn integration, Original/Result labels, text entry and working Paste with manual fallback; support desktop and mobile layouts and honest empty/unavailable states without simulated corrections or fictional history.
- [x] 2. **Strict correction with automatic request recording** - Connect Correct to Fastify and one verified OpenRouter model with reasoning disabled, shared Zod contracts and a versioned prompt; persist originals, results, available usage/cost/timing and failed attempts in SQLite, provide clean-result Copy, preserve input on failure and enforce the environment-specific proxy rules.
- [x] 3. **Inspect changes in correction results** - Compute safe local diffs, enable the approved Text/Changes switch with Changes selected by default, preserve whitespace and Unicode, handle unchanged text, and always copy the clean corrected result regardless of the selected view.
- [x] 4. **Expandable correction history and request details** - Implement the approved History screen using persisted records, with preview/date/model summaries and expanded originals, individual results, Text/Changes views, Copy and request metrics; handle empty history, failed requests and unavailable metrics without fabricated values.
- [x] 5. **Model selection and repeated corrections** - Activate the model selector with Gemma 4 as default and Gemini 3.1 Flash Lite as the alternative, persist the selected preference, and retain separate request results and metrics when the same original is corrected again with the same or another model.
- [ ] 6. **Production operation and persistent storage** - Package the API and built frontend for one container with persistent SQLite storage, validated mandatory proxy configuration, health checks and documented backup/restore; verify restart persistence and absence of direct OpenRouter fallback without introducing authentication or external-access infrastructure.
  - [x] 6a. **Diagnostic logging and health** - Minimal privacy-safe failure logs using the existing Fastify logger and one local GET /health endpoint; no VPN probes or success-request logs.
  - [ ] 6b. **Single-container packaging and persistent SQLite** - Serve the built frontend and API together, ship migrations, configure a persistent volume and verify persistence through recreation and the mandatory proxy policy.
  - [ ] 6c. **Backup and restore** - Document and verify backup/restore using disposable data before deployment.

The single health endpoint is owned by 6a, not a separate liveness/readiness feature.
VPN/proxy reachability monitoring remains an open question for a later discussion;
local health does not establish upstream availability. Container log rotation belongs to 6b.

## Feature boundaries and verification

- Feature 1 is the usable input workspace, not another static prototype. Port the
  approved design into production React components. Before Feature 2, correction
  is explicitly unavailable; do not present sample output as a real result. The
  History destination may show a clear unavailable state until Feature 4.
- Feature 2 introduces only the contracts, database access and network plumbing
  needed for the first real correction. Record metrics from the first request,
  even though their history UI arrives in Feature 4. Use a clean result view until
  Feature 3 enables real diff; do not offer a nonfunctional Changes switch.
- The model selector becomes interactive in Feature 5. Before that, show the one
  configured model accurately. Do not ship the prototype's Model A/Model B values.
- Feature 4 supports all saved request records, including multiple requests per
  correction; Feature 5 exposes the user action that creates repeated requests.
  Changing the original creates a new correction. An explicit repeat of an
  unchanged original creates a new request rather than overwriting old output.
- Keep metrics out of the main correction screen, matching the approved design.
  Store prompt/configuration metadata for traceability; present secondary details
  within expanded history rather than expanding the collapsed list.
- Each feature includes relevant validation, failure states, accessibility and
  existing automated checks. UI features require desktop/mobile evidence and
  keyboard/clipboard checks. Follow the explicit-permission rule for Playwright MCP.
- Use mocked OpenRouter responses in ordinary tests. Any real model evaluation
  is human-only, using ordinary corrections or the completed manual benchmark
  CLI with isolated local SQLite and HTML reports. Agents must never invoke the
  benchmark, including preview. Do not add benchmark tables or automated judges.
- Resolve the exact model identifier, support for reasoning disabled, initial
  prompt, SQLite access/migrations and request limits in the Feature 2 spec.
  Resolve later implementation choices in their owning feature specs.
- The user reported VPN-off OpenRouter denial on 2026-10-19. Preserve that manual
  evidence without claiming future container operation is verified. Phone
  clipboard verification also depends on the eventual secure access context.

## Workflow

Prepare and approve one feature specification before implementing it. Keep the
feature steps small, verify their observable outcomes, and complete the feature
before starting the next. If a feature proves too large during specification,
split it into stable sub-items before coding rather than silently widening scope.

The project plan remains the product authority. These items specify build order,
not approval for paid experiments, commits, publication or deployment. Auth and
external access remain deferred. Generate the Blueprint overview after reviewing
both planning files.


## Completed follow-up work

Manual V3 benchmark and model selection were completed and merged on 2026-10-19.
History search/filter/sort/pagination and transient Sonner feedback are also
implemented. See `blueprint/history/` for completed specifications. These do not
add unfinished roadmap items. Unreviewed `docs/ideas.md` is outside this roadmap.
