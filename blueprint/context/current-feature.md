# Feature: Frontend refactor

**From build-plan:** feature V4.2R
**Build attempt:** 1
**Branch:** feature/frontend-refactor

## Goal

Reorganize the existing `apps/web` React/Vite frontend into a lightweight layered structure before V4.3-V4.10. Improve ownership, testability, API boundaries and plain-CSS organization while preserving all existing UI, accessibility, storage, localization, request and workflow behavior.

## In scope

- Eight sequential steps from `docs/gramika_frontend_refactor_spec.md`: read-only preflight, regression protection, page/component separation, selective component organization, focused API modules, TanStack Query for read-only server data, localization ownership cleanup, CSS organization, and final verification.
- Frontend files and necessary npm workspace lockfile updates only.
- Stable Vitest/Testing Library tooling for this refactor's opt-in web tests, and stable `@tanstack/react-query` only for explicitly approved read-only queries.

## Out of scope

No product behavior changes, future V4 features, server/routes/contracts/prompts/deployment changes, paid or automatic requests, auth/workspaces, routers, global state libraries, styling migrations, CI, coverage policy, benchmarks, SSH, deployment, push or merge.

## Build loop

Implement one numbered step at a time on `feature/frontend-refactor`, run its relevant checks, present observed evidence and risks, and stop for user review before the next step. No checkpoint commits are required; `/complete` handles final bookkeeping.

## Build steps

- [x] **1. Preflight and baseline inventory.** Inspect branch/worktree, scripts, tests, entrypoints, CSS order, network triggers, storage and high-risk selection/focus behavior; run documented web build/lint/format checks. **Done when:** the untouched baseline and drift are recorded without product-file changes.
- [x] **2. Add focused regression protection.** Add opt-in web test tooling and characterization tests for request trigger guards, failure preservation, storage restore/clear, result selection, history operations and locale persistence. **Done when:** tests pass against the unchanged implementation and baseline checks are known.
- [x] **3. Separate pages from components.** Move the history page and meaningful history entry/correction page composition while preserving navigation, focus, scroll, unmount and filter behavior. **Done when:** screens are behaviorally and visually equivalent and checks pass.
- [x] **4. Organize components selectively.** Group current components by responsibility, extract only meaningful responsibilities, move shared result types out of component modules and avoid cycles or broad state rewrites. **Done when:** ownership is clear and props, accessibility and diff/selection semantics remain equivalent.
- [x] **5. Establish focused API modules.** Move endpoint construction, status handling and Zod parsing into named API functions without changing payloads, cancellation, errors, retries or paid request paths. **Done when:** targeted UI modules no longer own avoidable HTTP parsing and call behavior is equivalent.
- [ ] **6. Add TanStack Query for read-only data only.** Migrate history search/detail and correction config incrementally with explicit keys, cancellation and retry/refetch policy; keep correction, explanation generation, second opinion and regeneration imperative. **Done when:** no unexpected calls occur and paid paths remain unchanged.
- [ ] **7. Clean up localization ownership and formatting.** Colocate locale provider/context/hook, preserve both typed catalogs and APIs, and consolidate only equivalent formatting while preserving locale, storage and language attributes. **Done when:** locale behavior and catalog content are unchanged with no unsafe duplication.
- [ ] **8. Reorganize CSS and verify.** Split plain CSS by ownership without changing selectors, cascade, media queries, fonts or responsive behavior; run web checks and manual representative UI review. **Done when:** desktop/mobile, themes, settings, install, history, dialogs, diff and copy controls remain equivalent and all checks pass.

## Files / areas

`apps/web/src/App.tsx`, `apps/web/src/pages/`, `apps/web/src/components/`, `apps/web/src/hooks/`, `apps/web/src/api/`, `apps/web/src/i18n/`, `apps/web/src/lib/`, `apps/web/src/styles/`, `apps/web/tests/`, `apps/web/package.json`, root lockfile.

## Data / contracts

No server, route, SQLite, Zod, prompt or deployment changes. Preserve `gramota.workspace`, `gramika.interface-locale`, locale catalogs, correction payloads, request timing and all browser persistence semantics.

## Testing

Use the opt-in web unit/behavior suite added in Step 2, plus `npm run build -w apps/web`, `npm run lint -w apps/web`, and `npm run format:check -w apps/web`. Use manual UI review for CSS and responsive equivalence. Do not add browser automation or run benchmarks.

## Notes for the AI

Reinspect the latest branch before each step. Preserve unrelated user work. Stop after every step for review. Follow the full handoff in `docs/gramika_frontend_refactor_spec.md`.

### Preflight baseline

- Branch: `feature/frontend-refactor`.
- Web build: passed (`npm run build -w apps/web`).
- Web lint: passed (`npm run lint -w apps/web`).
- Web format check: failed on 44 existing files (`npm run format:check -w apps/web`); no formatting changes were made.
- Frontend tests: no test runner or test directory is configured yet.
- CSS entry order: `main.tsx` imports `index.css` before `App.tsx`; `App.tsx` imports `App.css`; `history-page.tsx` imports `components/history.css`; `install-app.tsx` imports `components/install-app.css`.
- High-risk behavior inventory: imperative correction and explanation requests, workspace persistence (`gramota.workspace`), locale persistence (`gramika.interface-locale`), result/diff selection and focus restoration, history filters/pagination/deletion, and theme synchronization.
- Regression suite: 10 Vitest tests across workspace storage, locale persistence, correction transport, history search/deletion, and deterministic diff ranges. Tests use synthetic responses and never contact the server or OpenRouter.
- Page separation: `CorrectionPage` and `HistoryPage` now own screen composition under `src/pages/`; `HistoryEntry` owns history detail rendering under `src/components/history/`. App-level workspace/session ownership and existing CSS import order remain unchanged.
- Component organization: correction editor/heading, history controls, result rendering, explanations, settings, and shared UI now have responsibility directories. `ResultViewMode` lives in `components/results/types.ts`, so hooks and storage no longer import a component for its type.
- API boundary: `src/api/` now owns corrections, history, explanations, and correction configuration HTTP calls, status handling, and contract parsing. UI hooks and components retain state, cancellation, retry, notifications, and explicit paid-request triggers.
