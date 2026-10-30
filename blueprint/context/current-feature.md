# Feature: Translation

**From build-plan:** feature V4.3
**Build attempt:** 1
**Branch:** feature/translation
**Status:** verification failed

## Goal

Provide Russian-to-English/French translation through the self-hosted LibreTranslate service for selected or whole text from Original, clean Result, and Explanation surfaces.

## In scope

- Server-only LibreTranslate transport, validated public contracts, configuration and `POST /api/translations`.
- Compact Translate actions paired with Read aloud and an expandable translation drawer.
- English/French target selection in Settings, with locale-based first-use default and local persistence.
- Workspace persistence for the active translation, excluding correction history and metrics.
- Mocked route coverage and web/server build and lint checks.

## Out of scope

Automatic source detection, non-Russian source languages, translation history, SQLite records, OpenRouter calls, benchmarks, and browser automation.

## Build loop

Implemented on `feature/translation`; final work commit and landing remain owned by `/complete`.

## Build steps

- [x] Add contracts, configuration, server transport, service and route.
- [x] Add target preference and workspace persistence with legacy-version loading.
- [x] Add Original, Result and Explanation actions, drawer, copy behavior and localized labels.
- [x] Add focused mocked translation route tests and run affected checks.

## Testing

`npm run build:ts -w apps/server`, `npm run build -w apps/web`, and `npm run lint -w apps/web` pass. The full server test command includes pre-existing frontend-refactor path failures in text-diff presentation tests; translation route tests pass.
