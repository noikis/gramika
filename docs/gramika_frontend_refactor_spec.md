# Gramika frontend refactor - implementation specification

**Status:** Proposed handoff specification, not authorization to implement all steps at once  
**Repository:** https://gitlab.com/ezzil1997/gramota  
**Inspected baseline:** `master` at `30eab69f5bb39f4d0b7d0112ae3912e44557d0d8` (2026-10-29)  
**Scope:** Existing `apps/web` code only, except necessary npm workspace lockfile updates and workflow bookkeeping approved by the user

## 1. Objective and execution contract

Reorganize the existing React/Vite frontend into a maintainable, lightweight structure before V4.3-V4.10. Improve code ownership, testability, API boundaries, and plain-CSS organization without changing the user experience or implementing future features.

**Implement sequentially, one step at a time.** Before each step, review its scope against the current checkout. After it, run relevant checks and report the actual changes, pass/fail evidence, and remaining risks. **Stop for user review before starting the next step.** Do not bundle all steps into one implementation pass. Follow `AGENTS.md`, `blueprint/context/coding-standards.md`, the active Blueprint workflow, and branch/approval rules. Do not overwrite an active work item in another checkout. Do not push, merge, or deploy without separate authorization.

The source commit above is a planning reference, not a frozen implementation target. Reinspect the latest selected branch before implementation. If files or behavior have materially changed, reconcile this spec with the user before acting.

### Invariants

- No intentional changes to visible UI, wording, accessibility, focus behavior, styling, responsive layout, browser storage semantics, network payloads, or user workflows.
- No changes to Fastify routes, server behavior, SQLite schema, shared Zod contracts, OpenRouter transport, prompts, or application deployment.
- No real paid or external requests in tests. Never run the manual benchmark entry point. Use synthetic, non-personal fixtures.
- Preserve strict/rewrite behavior, model selection and second opinion, regeneration limits, correction cache, local diff and selection offsets, explanations, request metrics, history filters/pagination/deletion, copy/paste, themes, locale preference, and PWA behavior.
- Existing OpenRouter correction and explanation-generation flows **must not be migrated to TanStack Query**. They must remain explicitly user-triggered, with no automatic retry, replay, mount, focus, or reconnection trigger.
- No new feature implementation: no translation, dictionary, TTS, authentication, invitation, account creation, new routes/screens, or new user-workspace architecture.
- No Zustand, Redux, router, styling migration, SCSS, CSS Modules, CSS-in-JS, Tailwind rewrite, generic feature framework, or speculative reusable platform.
- Preserve the two existing typed localization catalogs and `t`/`message` APIs. Do not merge catalogs or rewrite translation content.
- No new CI, coverage thresholds, compulsory future frontend test gate, or recurring verification workflow.

## 2. Target structure and ownership

Use a lightweight layered structure, **not** Feature-Sliced Design. Create directories only when populated by existing code; avoid empty placeholders for future roadmap items.

```text
apps/web/
  src/
    main.tsx
    App.tsx                 # App shell, navigation, providers/toasts as applicable
    pages/
      CorrectionPage.tsx   # Correction screen composition
      HistoryPage.tsx      # History screen composition
    components/
      correction/          # Editor and correction-only controls
      history/             # History entry, request, delete and detail UI
      results/             # Shared result and comparison UI
      explanations/        # Existing explanation and metrics UI
      settings/            # Existing settings UI
      ui/                  # Existing generic Button, Textarea, Icon
      ...                  # Keep tiny one-off components sensibly placed
    hooks/                 # App-specific React state and orchestration
    api/                   # Backend HTTP functions
    i18n/                  # Existing two catalogs, provider, locale helpers
    lib/                   # Pure formatting/diff helpers and browser utilities
    styles/                # Plain CSS grouped by UI responsibility
    index.css              # Existing CSS entry if useful for ordering
  tests/
    unit/
    behavior/
    setup.ts
  vitest.config.ts         # Or minimal equivalent configuration
```

**Boundary rules:**

1. `App.tsx` owns application shell and switching between the two existing views. Do not introduce a router.
2. A page composes a screen and owns its page-level UI state. It may use existing hooks; avoid an extra wrapper component with no meaningful purpose.
3. Components render UI and manage local interactions. Small, private subcomponents may remain in the same file. Split only meaningful independent responsibilities.
4. Hooks coordinate React state/effects. Preserve the existing `useWritingSession`, `useSubmission`, `useResultPair`, `useDraft`, and persistence contracts unless a small change is needed to decouple imports.
5. `api/` owns calls to Gramika's Fastify endpoints and response validation. Do not introduce a generic HTTP client or API framework. Existing browser APIs (`localStorage`, clipboard, install events, `window`) may stay in `lib/` or their owning hooks/components; do not create a `browser/` layer just for uniformity.
6. A hook or pure utility must not import a React component solely to obtain a type. Put such types in an appropriate non-UI module.
7. No dependency-direction enforcement tooling or widespread barrel files. Use direct imports where they keep the tree clear.

## 3. Step-by-step implementation

### Step 0 - Preflight and baseline inventory (read-only)

**Actions**

- Inspect the current checkout, branch, uncommitted changes, `AGENTS.md`, active Blueprint feature state, package scripts and existing tests. Do not overwrite unrelated user work.
- Record current build/lint/format-check results using the documented web commands. Failures already present before the refactor must be identified, not attributed to later steps.
- Inventory entry points and CSS import order (`main.tsx`, `App.tsx`, `index.css`, `App.css`, `components/history.css`, `components/install-app.css`).
- Identify current network operations and their trigger semantics, including `useHistory`, `useServiceConfig`, `HistoryEntry`, `HistoryDelete`, explanation UI and `useSubmission`.
- Note current browser persistence keys and restoration semantics. Identify high-risk DOM selection and focus behavior before moving files.

**Done when:** The agent can state the untouched baseline, exact working branch, checks available, and any drift from this plan. No product files changed.

### Step 1 - Establish focused regression protection before refactoring

**Tooling:** Add stable releases of Vitest, React Testing Library, `user-event`, and `jsdom` as **web dev dependencies only**, plus minimal assertion helpers if needed. Use npm workspaces and the root lockfile. No extra coverage, snapshot, CI, or browser-test dependencies.

**Actions**

- Configure an opt-in `npm test -w apps/web` command. Test files live in `apps/web/tests/unit/` and `apps/web/tests/behavior/`, with a small shared setup file. Avoid changing production source merely to make tests convenient.
- Add approximately 8-12 high-value characterization tests against the **unchanged implementation**. The agent chooses exact test cases, but must cover the invariants below. Prefer accessible roles and observable effects, not CSS selectors, internals, file paths, or full rendered snapshots.
- Stub `fetch`, clipboard, browser storage, media queries, scrolling, and other unavailable browser capabilities only where required. All API and provider outcomes use synthetic fixtures. No tests contact real servers, external services, or OpenRouter.

**Minimum protected behaviors:**

1. No correction/explanation-generation request on mount, rerender, locale change, navigation, or failure; one deliberate submission produces one request, with no automatic retry.
2. Correction failure preserves draft and prior usable results; regenerate/second-opinion controls remain explicit and obey current guards.
3. Workspace restore/clear semantics, including pending marker, unchanged draft text, results/views, theme, locale preference, and corrupted/unavailable storage recovery.
4. Result Text/Changes switching, result selection, and important text-selection/diff inspection behavior, using suitable deterministic examples.
5. History search/filter/pagination request parameters, entry expansion, delete success/error handling, and user-triggered refresh.
6. Locale detection/switching and persistence without resetting correction state.

**Done when:** The targeted tests pass on the **pre-refactor** code and documented web build/lint/format checks have a known baseline. If behavior is currently untestable, document the gap rather than making unrelated changes. The suite protects this refactor; it is not a new mandatory test policy for future features.

### Step 2 - Separate pages from components

**Likely source files:** `src/App.tsx`, `src/components/correction-workspace.tsx`, `src/components/history-page.tsx`.

**Actions**

- Move `HistoryPage` to `src/pages/HistoryPage.tsx`. Extract `HistoryEntry` into `components/history/HistoryEntry.tsx`; leave filter/search/pagination composition at page level.
- Give the existing correction workspace a clear `CorrectionPage` entry point. Prefer a rename/move over adding a redundant pass-through wrapper. Keep the existing draft/session ownership in `App` for now; do not migrate state as part of a file move.
- Update imports and CSS links. Preserve existing view switching, interrupted-request link, focus restoration, scroll behavior, and unmount semantics (including History filter reset on leaving the view).
- Do not introduce URL routing or navigation history changes.

**Done when:** Screens behave and look the same, including mobile navigation and the existing correction/history switching behavior. Relevant baseline tests, build, lint, and format checks pass.

### Step 3 - Organize and split existing components selectively

**Likely source files:** `correction-workspace.tsx` (about 459 lines), `history-page.tsx` (about 427 lines), `result-view.tsx` (about 392 lines), `history-request.tsx` (about 263 lines), `explanation-panel.tsx`, `explanation-request-metrics.tsx`, `request-metric-facts.tsx`, `app-settings.tsx`, `install-app.tsx`.

**Actions**

- Group components by current responsibility under `components/correction`, `history`, `results`, `explanations`, `settings`, and `ui`. A separate directory is not required for each tiny component.
- Extract substantial `OriginalEditor`, `ResultHeading`, and related correction controls from the large workspace module where it materially improves readability. Keep small one-use helpers colocated.
- Separate `HistoryRequest` from the substantial request-metrics/dialog component. Keep shared metric rendering identifiable without inventing a generic design system.
- Keep `ResultView` and `ComparisonExcerpt` shared between correction and history. Carefully separate independent inspector/rendering responsibilities only where their interface is clear. Do not rewrite DOM range mapping, diff algorithms, UTF-16 offsets, event handlers, or accessibility semantics.
- Move `ResultViewMode` (currently imported from a component by hooks/storage) to a non-component type module and update dependent imports.
- Preserve the existing UI primitives, Radix Slot usage, Sonner behavior, and direct component props. Avoid broad context/store migrations and one-file-per-component rules.

**Done when:** Every moved/extracted component has clear ownership without changed props/behavior beyond necessary internal wiring. No import cycles or hook-to-component type dependencies remain for the moved types. Tests and documented web checks pass.

### Step 4 - Establish the API boundary without changing request behavior

**Existing call sites:** `lib/correction-api.ts`, `hooks/use-history.ts`, `hooks/use-service-config.ts`, `components/history-page.tsx` (`HistoryEntry`), `components/history-delete.tsx`, `components/explanation-panel.tsx`, `components/explanation-request-metrics.tsx`.

**Actions**

- Introduce focused modules under `src/api/`, for example `corrections.ts`, `history.ts`, `explanations.ts`, and `config.ts` only if useful. Move HTTP request construction, status interpretation, and Zod parsing into named functions. Preserve actual endpoints, methods, payloads, validation, error codes, and cancellation signals.
- Keep user-facing state and notifications in hooks/components. Do not create a global request wrapper, interception layer, generic repository abstraction, or new HTTP dependency.
- Move existing correction transport `requestCorrection` into the API boundary if this is a pure relocation. **Do not modify** `useSubmission` state transitions, no-retry guarantees, correction IDs, caching, or regeneration rules.
- Extract explanation lookup/metrics transport where safe. Paid explanation-generation remains imperative, explicitly invoked, and outside TanStack Query. If extraction threatens its behavior, defer that extraction and report why.
- History deletion remains an explicit user-triggered operation; preserve treatment of HTTP 404 and its feedback.
- Keep `lib/exchange-rate.ts` and existing browser storage/clipboard utilities in `lib/`; no forced migration of browser integrations.

**Done when:** UI modules no longer contain avoidable inline HTTP parsing for the targeted operations, but timing, retry behavior, visible errors, and API calls remain equivalent. No new paid or background requests. Focused tests pass.

### Step 5 - Introduce TanStack Query for safe read-only server data only

**Dependency:** Stable `@tanstack/react-query` in `apps/web`. Do not install Devtools, persistence plugins, or companion state managers.

**Actions**

- Add one stable `QueryClient` and `QueryClientProvider` at the app root. Keep locale and workspace providers/lifecycle intact.
- Migrate **read-only** operations incrementally: first history search (`POST /api/history/search`, which is a read-only query), then lazy history entry detail (`GET /api/history/:id`), then correction configuration (`GET /api/correction-config`). Optional saved explanation lookup/metrics migration is allowed only after the agent proves equivalent request timing and error behavior; it is not required to force every `fetch` into Query.
- Use stable, explicit query keys including the parameters or entry ID that affect data. Do not persist query caches or log personal search/text values. Preserve Zod parsing and cancellation (`AbortSignal`).
- Preserve user-visible loading/error/retry behavior, debounced search, filters, pagination, expansion laziness, and deletion refresh. Make automatic retry, focus/reconnect refetch, and stale-data behavior explicit; do not silently accept library defaults that increase requests or change the UI.
- After explicit successful history deletion, invalidate/refetch only the appropriate history data while retaining `correction.forgetHistoryEntry` behavior. Deletion itself need not move to `useMutation`.
- **Hard exclusion:** no `useQuery` or `useMutation` for `POST /api/corrections`, paid explanation generation, second opinion, or regeneration. Do not move `useSubmission` to Query. No automatic replay, retry, or refetch of paid work.
- Keep local draft/results, workspace persistence, theme, locale, selected UI views, clipboard and browser capabilities outside the Query cache. Keep the existing exchange-rate localStorage cache unless a concrete reason to change it emerges.
- If preserving current behavior for a particular read-only flow requires disproportionate work, retain the existing custom hook and report that exception rather than forcing migration.

**Done when:** Approved read-only flows use Query without additional unexpected calls; all paid paths retain their existing code path. Query changes are covered by call-count/error/retry tests. No new route, request payload, account context, or storage change.

### Step 6 - Clean up localization ownership and duplicated formatting

**Existing files:** `hooks/use-locale.tsx`, `hooks/locale-context.ts`, `i18n/{types,en,fr,ru,index}.ts`, `i18n/messages/`, `lib/history-format.ts`.

**Actions**

- Colocate the locale provider, locale context, and public `useLocale` hook inside `i18n/`. Preserve exported behavior and update imports; do not add a new state library.
- **Keep both typed catalogs** exactly as the user selected: existing interface strings and separate message catalog, with existing `t()` and `message()` lookup semantics. Do not merge files, change translations, rename keys, or introduce new locales.
- Identify duplicate `formatDate`/`formatCount` logic in `i18n/index.ts` and `lib/history-format.ts`. Consolidate only semantically equivalent code, preserving each caller's current null/error fallback and locale formatting. If outputs would change, keep a small compatibility wrapper or defer that particular consolidation.
- Preserve `gramika.interface-locale`, browser-language detection, explicit preference clearing, `document.lang`, Russian text language attributes, and existing `gramota.workspace` format/version.

**Done when:** No duplicated formatting implementation remains where equivalence is safe; provider ownership is clear; all three locales, persistence and correction behavior are unchanged. Existing catalog shape and translations remain intact.

### Step 7 - Reorganize existing plain CSS without visual changes

**Existing styles:** `src/index.css` (about 178 lines), `src/App.css` (about 909), `src/components/history.css` (about 1009), `src/components/install-app.css` (about 38).

**Actions**

- Identify CSS ownership and existing cascade order first. Move rules into a small number of cohesive plain-CSS files, for example theme/tokens/base, app shell/navigation, correction workspace/editor, result/diff/inspector, history page/entry, request details/metrics, settings and install UI. Exact filenames may follow actual selector ownership; avoid one file per tiny component.
- Preserve existing selectors, custom properties, specificity, declarations, media query conditions, keyframes, font loading, and responsive behavior. Avoid reordering conflicting rules. Keep current Tailwind import and utilities as they are; do not convert CSS to Tailwind.
- Preserve imports so both correction and history styles load on the same screens and in equivalent order. Do not accidentally alter global selectors when moving them.
- Do not introduce SCSS, CSS Modules, CSS-in-JS, new styling packages, design tokens, or visual polish. This is file organization only.
- Validate desktop/mobile, light/dark, settings, install, history filters, dialogs, diff highlights, and fixed mobile copy controls through the project's existing manual UI review practices. Do not create a new automated visual testing infrastructure or add screenshot artifacts to the repository.

**Done when:** Appearance and behavior remain visually equivalent at representative existing states and viewport sizes, with no overflow, focus, or responsive regressions. CSS ownership is understandable and the long monolithic files have been split where beneficial. Web build/lint/format checks pass.

### Step 8 - Final verification and narrow cleanup

**Actions**

- Run the documented web build, lint and format checks, plus the targeted test suite. Run relevant checks after changes; do not repeatedly rerun passing, unchanged evidence merely for bookkeeping.
- Verify preservation of HTTP request methods/payloads, no extra paid calls, storage keys and snapshot compatibility, locale semantics, result/diff selection, history functionality, and UI appearance. Investigate any discrepancy before declaring the refactor done.
- Inspect source imports for dead modules/cycles and remove genuinely obsolete paths. Do not perform unrelated cleanup or broad style/format rewrites.
- Summarize which temporary refactor tests are worth retaining and which cause maintenance overhead. **Ask the user before deleting or materially reducing test coverage.** Do not make tests mandatory for all future frontend work or add a CI gate.
- Report any intentionally deferred extraction, unchanged known issue, limitation, or baseline failure. Follow the repository's Blueprint review/complete process and seek explicit approval for final landing actions.

**Done when:** The user can inspect a concise final mapping of old-to-new files, evidence of unchanged behavior, the test disposition recommendation, and no unexplained differences.

## 4. Acceptance criteria for the full refactor

- [ ] Each step completed independently with its own change summary and review, not as one large rewrite.
- [ ] The frontend follows a lightweight `pages` / `components` / `hooks` / `api` / `i18n` / `lib` / plain `styles` structure without new feature-framework conventions.
- [ ] The core correction/session and paid explanation-generation paths are still imperative and have no automatic retry or replay.
- [ ] Only appropriate read-only server data flows use TanStack Query, with deterministic query keys, cancellation, controlled refetch and equivalent visible behavior.
- [ ] No user-facing feature, UI copy, layout, styling, accessibility, navigation, locale, persistence, or network contract intentionally changed.
- [ ] The existing two localization catalogs, values, and lookup APIs remain intact.
- [ ] CSS is organized by ownership while preserving the existing styling system and appearance.
- [ ] Targeted Vitest/React Testing Library regression protection was established before source reorganization; tests and web checks pass or deviations are explicitly resolved.
- [ ] No real external/personal/paid test traffic, no benchmark invocation, no new CI/future testing obligation, and no unapproved dependency or infrastructure changes.
- [ ] No V4.3-V4.10 feature is implemented by this refactor; V4.7 identity and data ownership remain unresolved until their own specification.

## 5. Agent decision policy

Choose the smallest reversible implementation consistent with these boundaries. Exact file names and minor subcomponent extraction choices are delegated to the implementing agent. Material changes to behavior, visible UI, paid-request flow, persistence, test infrastructure beyond the approved stack, or scope must be raised with the user before implementation. Treat passing automated checks as evidence, not permission to merge or deploy.
