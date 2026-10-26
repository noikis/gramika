# Feature: Repeated correction results in workspace

**Status:** planned
**From build-plan:** feature 3.0 follow-up
**Build attempt:** 1
**Branch:** master

## Goal

Preserve every correction result in the workspace so Gemma, Gemini opinion, and repeated regenerations remain selectable in one chronological result carousel. History UI is out of scope.

## Decisions

- One visible Result pane with request-ID navigation and chronological order.
- One regeneration per model; hide Generate again after it is used.
- All attempts remain in one correction group with separate request IDs.
- Old localStorage snapshots are cleared when the new format is introduced.
- No server schema/API changes.

## Build steps

- [ ] **1. Replace two-slot workspace state.** Store ordered `SavedResult[]` plus `activeRequestId`; append results and preserve each view/request identity.
- [ ] **2. Update correction controls.** Navigate by request ID, label model/result position, keep Second opinion until Gemini exists, and enforce one regeneration per model.
- [ ] **3. Update persistence.** Bump the workspace snapshot version, validate one correction group, and clear old Gemma/Gemini snapshots.
- [ ] **4. Verify.** Run web lint/build, server tests, diff check, and Playwright mock flow for Gemma → Gemini → Gemini again plus regeneration limits.

## Files / areas

- `apps/web/src/lib/workspace-storage.ts`
- `apps/web/src/hooks/use-result-pair.ts`
- `apps/web/src/hooks/use-writing-session.ts`
- `apps/web/src/components/correction-workspace.tsx`
- `apps/web/src/hooks/use-workspace-persistence.ts`

## Out of scope

History UI, database migrations, server routes, OpenRouter calls, benchmarks, and unrelated UI redesign.

## Verification evidence (2026-10-26)
- `npm run lint -w apps/web` passed.
- `npm run build -w apps/web` passed.
- `npm test -w apps/server` passed: 154 tests, 0 failures.
- `git diff --check` passed.
- Playwright with mocked correction API verified chronological Gemma/Gemini/Gemini regeneration and Gemma regeneration, request-ID navigation, hidden regeneration buttons after the per-model limit, and old v1 localStorage clearing.
- No OpenRouter calls or benchmark commands were used.

## Mode separation regression update (2026-10-27)
- Results are filtered by active Strict/Gentle Rewrite mode while all mode results remain persisted in the workspace snapshot.
- Playwright with mocked corrections verified Strict → Rewrite → Rewrite actions and switching back to the preserved Strict result; no OpenRouter calls were made.
- `npm run lint -w apps/web` and `npm run build -w apps/web` passed after the fix.
