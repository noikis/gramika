# Feature: Multilingual interface

**From build-plan:** feature V4.6
**Build attempt:** 1
**Branch:** feature/multilingual-interface

## Goal

Give the existing Gramika interface complete French, Russian and English catalogs. On first launch, choose the first supported browser or device language, silently fall back to English when none is supported, and let the user explicitly choose and remember a language later. Keep this interface preference separate from the correction language, which remains Russian in the existing correction and history data contracts.

## In scope

- A typed locale set for `en`, `fr` and `ru`, with complete catalogs for all current user-visible interface text, including headings, controls, status messages, errors, empty states, settings, history, install guidance, accessibility labels and notifications.
- First-launch detection from `navigator.languages` (including base-language matching such as `fr-CA` to French), with English as the deterministic fallback and no fallback message.
- An explicit language selector in the existing settings surface, showing the language names in their own languages and applying the new catalog immediately.
- Remembering an explicit interface choice in browser storage. Invalid or unavailable stored values recover through detection and English fallback.
- Updating the document language and locale-sensitive UI formatting when the interface locale changes, while preserving Russian `lang` attributes for user-authored and corrected text.
- Localized accessible names, live-region messages and toast text without changing correction requests, history records, model prompts, or server APIs.

## Out of scope

- Translating user-authored text, correction results, explanations, model prompts, dictionary or translation content from later roadmap items.
- Changing the correction language, the persisted `corrections.language = 'ru'` constraint, server history behavior, authentication, or workspace ownership.
- Adding a translation service, runtime remote catalog loading, new UI framework, or browser-test runner.
- Redesigning layouts, changing branding, or adding languages beyond English, French and Russian.

## Build loop

Implement on `feature/multilingual-interface` in small steps. The configured workflow reviews the feature as one packet (`stepReview: feature`) and has checkpoint commits disabled. Run the affected web checks during implementation, then stop for manual review; `/complete` owns final bookkeeping and commit creation.

## Build steps

- [ ] **1. Define the supported interface behavior and catalogs.** Add the English, French and Russian interface copy and the browser detection, English fallback and explicit-choice behavior. The code organization and state-sharing mechanism remain an implementation decision for the implementation phase. **Done when:** the supported locale behavior is defined without changing correction or server contracts.
- [ ] **2. Wire preference persistence and document locale.** Integrate the locale state at the app root, load it before the first meaningful render, persist changes independently of `gramota.workspace`, update `document.documentElement.lang`, and preserve existing workspace/theme restore and clear-local-data behavior. **Done when:** a reload remembers an explicit choice, first launch follows supported browser language order, clearing local data removes the language preference, and user text remains marked as Russian.
- [ ] **3. Localize the correction workspace and shared feedback.** Replace embedded interface strings in `App`, correction workspace, result view, settings and shared UI with catalog lookups, including loading, invalid, unavailable, failed, retry, copy, model, navigation and accessibility text. Keep model names and corrected/original text as data, not translated labels. **Done when:** switching locale updates the correction screen without losing draft/results or changing a request payload, and all correction happy, loading, empty, error and disabled states have localized visible and accessible text.
- [ ] **4. Localize history, install guidance and formatting.** Apply the same catalog and locale-aware formatting to history search, filters, pagination, request details, deletion states, cost/date/count labels, PWA install guidance and notifications. **Done when:** every reachable history and install state renders in the selected locale, dates/counts use that locale, and server history responses and deletion/copy behavior remain unchanged.
- [ ] **5. Verify fallback, persistence and regression behavior.** Exercise fresh supported and unsupported browser locales, stored locales, malformed storage, switching while on correction/history, reload, clear-local-data, and existing correction flows. Run `npm run build -w apps/web`, `npm run lint -w apps/web`, and `npm run format:check -w apps/web`; record only observed results. **Done when:** the checks pass and the manual matrix shows no English leakage in reachable interface copy except intentional product/model names, no locale preference affects correction language, and existing functionality remains usable on mobile and desktop layouts.

## Files / areas

- `apps/web/src/` components, hooks and utilities that currently own interface copy, settings, notifications and formatting.
- `apps/web/index.html` or the React entry point for the document language.
- The final file/module layout is intentionally undecided until the implementation architecture is discussed.

## Data / contracts

- Supported interface locale is the finite client value `en | fr | ru`; English is the fallback.
- Persist an explicit interface preference separately from the existing workspace. The existing `gramota.workspace` version and correction workspace shape remain compatible.
- `navigator.languages` is the first-launch input. Match case-insensitively by primary language subtag in listed order; if unavailable or unsupported, use `en`.
- Interface locale is presentation state only. Correction requests continue to use the existing Russian language behavior and no locale field is added to public Zod contracts or server routes.
- `document.documentElement.lang` follows the interface locale, while original/corrected/history text `lang="ru"` attributes remain unchanged.

## Testing

- Add focused pure-module tests only if a web test command becomes configured; do not install a runner for this feature.
- Use the documented web build, lint and format checks above as automated evidence.
- Manually verify the locale matrix in a normal browser or dev build. Playwright MCP is not authorized by this plan and requires separate user permission before use.

## Notes for the AI

- Preserve current English copy meaning while translating into natural, concise French and Russian UI language. Keep product name Грамика, model names, user text and server-provided correction/explanation content intact unless a label explicitly belongs to the catalog.
- Ensure language changes do not reset navigation, draft text, results, filters, pending state, theme or correction mode.
- Do not run benchmarks, paid model calls, SSH, deployment, push, merge or destructive data operations.

## Implementation architecture

- Add `apps/web/src/i18n/types.ts`, `en.ts`, `fr.ts`, `ru.ts` and `index.ts` for the typed locale set, catalogs, browser detection, preference validation, translation lookup and `Intl` formatting helpers.
- Add `apps/web/src/hooks/use-locale.ts` for the active locale state and explicit Settings changes.
- Keep locale state in the existing app-level React flow. Do not add React Query, Redux, Zustand or another state-management library.
- Keep the explicit interface preference separate from `gramota.workspace`, with locale storage owned by the i18n layer.
- Use the English catalog as the message-key source of truth. Missing runtime keys fall back to English; development warnings are allowed without blocking production rendering.
- Update existing components to consume translated strings, but do not split or substantially refactor large components such as `result-view.tsx` as part of V4.6. If a clean extraction becomes useful, plan it as a separate future feature.

## Open questions

- Which exact existing formatting and notification helpers should accept the selected locale can be resolved during implementation by following their current call sites; it does not change the product contract.
