# Gramota V4.5 — Read Aloud: Implementation Specification

**Status:** Approved functional scope and UI direction; ready for staged implementation  
**Target:** `https://gitlab.com/ezzil1997/gramota`, current `master` after V4.2R frontend refactor  
**Scope:** Frontend only, native browser speech synthesis  
**Date:** 2026-10-29

## 1. Objective

Add one-click read-aloud functionality to three existing text surfaces:

1. Original text editor.
2. Corrected result text, with the action accessible in both Text and Changes views.
3. Explanation content.

One shared speech controller must own all speech in Gramota. Different surfaces may request speech, but only one session can be active at any time. Keep the UI minimal: **one icon per surface**, toggling between start, pause, and resume. There must be no separate audio player.

This document is the implementation handoff. Implement in small, verifiable stages; do not introduce unrelated refactoring or features.

## 2. Locked product decisions

| Topic | Requirement |
| --- | --- |
| Engine | Native browser `window.speechSynthesis` / `SpeechSynthesisUtterance` |
| Backend | No new endpoint, dependency on a TTS server, or audio storage |
| TanStack Query | Do **not** use it for speech operations |
| User gesture | Speech starts only from an explicit click/keyboard activation |
| No selection | Speak the **entire content of the clicked surface** |
| Selection | Speak only the selected text **if the selection belongs to that surface** |
| Controls | Exactly one icon per surface; no separate Stop, voice, speed, or player UI |
| Playback speed | Default `1.0`; future settings are out of scope |
| Voice | Automatically choose an appropriate available voice; no voice selector |
| Languages | UI catalogs **Russian, English, French**; source speech language is explicit |
| Concurrent sessions | At most one; a new source cancels the previous source |
| Automatic retries | None, including start failures or chunk failures |
| Long text | Chunk internally and speak in order; no user-facing chunk UI |
| Styling | Preserve existing design, Tailwind, component boundaries, responsive layout |
| Out of scope | Define, Translate, speech-to-text, highlighting in sync with audio, downloaded audio, extra pages/settings |

## 3. UI layout: desktop and mobile

### 3.1 Shared icon design

Use the project's existing icon system, colors, focus-ring styles, theme support and i18n mechanism. Suggested icon mapping (use the nearest existing icons if necessary):

| Controller state | Visible icon | Activation |
| --- | --- | --- |
| Idle / finished / safely stopped | Speaker (`volume-2`) | Start current surface text |
| Starting | Speaker, with a subtle busy state; do not add a new control | Ignore repeated start requests |
| Speaking | Pause (`pause`) | Pause current speech |
| Paused | Play (`play`) | Resume current speech |
| Error | Speaker, with localized existing toast/error feedback | User may click to try again |

The active source owns the pause/play visual state. Other surfaces continue to show their idle speaker icon. When another surface takes ownership, the former immediately returns to idle. Icon buttons must have localized accessible names, visible keyboard focus and approximately 44 × 44 CSS px touch targets on mobile (the graphic itself may be smaller). Do not depend on hover to explain controls.

**No floating player, no mini-player, no progress strip, no Stop button, no new menu, and no settings UI in this release.**

The future Define and Translate actions may eventually appear alongside the speaker icon, but **do not add disabled or placeholder icons for them in V4.5**. Leave a layout that can accommodate their own icons later.

### 3.2 Original editor

- Remove the always-visible `41 / 5,000 characters`-style counter from its current row.
- Reuse that row **below the textarea and above the Strict/Rewrite control** for the Read Aloud icon, aligned left.
- Keep `New correction`, `Paste`, mode selector and `Correct` in their current locations.
- Do not overlay the speaker icon on editable text or interfere with caret/selection behavior.
- Preserve the actual input-length validation, maximum length, paste behavior and associated accessibility/error handling. Only the always-visible count is removed.
- If a length warning is necessary, show contextual feedback near the existing limit (for example, at 90% of the maximum), rather than permanently occupying the toolbar; avoid changing the server contract.
- Leave horizontal space next to the speaker icon for future Define/Translate icons.

### 3.3 Result text

- Place the speaker action in the existing result controls area near the `Text / Changes` toggle and `Copy` button.
- It acts on **the corrected result text**, regardless of whether Text or Changes is visible. It must not speak correction markers, navigation labels, or comparison metadata.
- Desktop: keep the control group in the toolbar if it fits without compressing existing controls.
- iPhone/narrow mobile: preserve the `Text / Changes` and `Copy` row; allow text-action icons to occupy a compact second row, so future Define/Translate icons will not squeeze Copy or overflow.
- Maintain current view toggling, copying, scroll behavior, diff selection, correction-highlight clicking and Explain interactions.
- Apply the same result action to a result shown in history through the reused result component; do not duplicate the speech implementation.

### 3.4 Explanations

- Place the speaker icon **at the top-right of the existing Explanation heading row**.
- The icon reads only that explanation's visible, meaningful body text, not the heading, actions, navigation, buttons, hidden metadata or unrelated panels.
- If multiple explanation instances are visible, each must have a distinct, stable source ID.
- Preserve existing explanation layout, line wrapping, panel controls and text selection. Do not inject a player inside the explanation body.
- The icon group must fit at approximately 320–390 CSS px viewport widths without covering the title or content. If needed, use responsive wrapping rather than shrinking touch targets.

### 3.5 Responsive and accessibility constraints

- Verify at iPhone-sized widths (at minimum 320, 375 and 390 CSS px), a wider mobile width, and desktop.
- No horizontal scrolling, clipped buttons, text overlap or unexpected layout shift while the icon changes state.
- Respect existing dark/light themes, high zoom, safe-area padding, keyboard use and screen readers.
- For long explanations, test usability when the heading scrolls off-screen. Do not introduce a sticky global player to solve it; document any remaining limitation for review.

## 4. Text-selection contract

Text extraction is the responsibility of the **source component**, not the browser speech adapter. Deliver a snapshot of `sourceId`, `text` and `lang` when the user activates its icon.

### Original textarea

Use the exact substring represented by valid `selectionStart` / `selectionEnd`. If that textarea has no nonempty selection, use the full current textarea value. Preserve punctuation, whitespace and line breaks. Never pull selection from another surface.

### Corrected result

For Text view, use the textarea's native selection offsets. For Changes view, use the corrected-text range already mapped by the current manual-selection logic, and slice the actual `correctedText`. If there is no selection belonging to the result, read all `correctedText`. Ignore diff UI symbols, accessibility labels and removed original text.

Use existing `ResultView.tsx` and `ResultChanges.tsx` selection handling where appropriate; do not rewrite the text-diff implementation.

### Explanation content

Read the selection only if its DOM range lies wholly within that particular explanation body. Otherwise derive the full readable explanation text from its content container or the existing render/data contract. Do not use raw HTML, markdown punctuation, button text or an unrestricted `window.getSelection().toString()`.

### Shared rules

- Capture selection **before icon activation steals focus**; a deliberate selection must not disappear on click/tap.
- An empty or whitespace-only source does not start speech; keep the icon disabled or provide a localized, nonintrusive message consistent with existing UI.
- Do not trim or normalize meaningful user text merely to obtain speech input. Internal chunk boundaries may separate it but must not reorder or discard it.
- The run uses a snapshot. Editing or replacing the active source text should cancel that source's now-stale playback, rather than silently reading outdated content.
- Changing selection alone while speech is active does not restart speech.

## 5. Speech language and voice

- Original and corrected Russian proofreading text: use `ru-RU`, regardless of UI locale.
- Explanations: use the **explicit language associated with that explanation** when it is known (e.g. `ru-RU`, `en-US`/appropriate English locale, `fr-FR`). Inspect the existing explanation request/response and localization behavior; do not infer language solely from the text or assume UI locale always equals content language.
- If explanation language is not currently available in the component's data contract, use the existing known application context where correct; document a deliberate fallback and add tests. Avoid automatic language-detection packages.
- Choose a matching voice from `getVoices()` if available; otherwise allow the browser to choose based on `utterance.lang` and report its genuine failure. `getVoices()` may be initially empty; handle `voiceschanged` for future sessions, without automatically restarting current speech.
- Do not promise offline execution: some browsers use remote voices. No TTS request is made by Gramota's own backend.
- Use default `rate = 1`; voice/rate settings and persistence are a later feature.

## 6. One owner: controller architecture

Implement one application-level controller, shared across the three surfaces. A small React context is appropriate for cross-component coordination; no Redux, Zustand, TanStack Query or generic event bus.

Suggested responsibilities (exact filenames are at the implementer's discretion if matching V4.2R patterns):

- `src/lib/browser/speech-synthesis.ts`: native API boundary, voice lookup, utterance lifecycle, queue/cancel and browser failure normalization.
- `src/lib/voice/` or another small `lib` module: pure text chunking.
- `src/hooks/useSpeechSynthesis.ts` and a narrowly scoped provider: one active session, ownership, status and commands.
- One small reusable icon-button component integrated into the three existing surfaces.

Keep browser APIs out of server-oriented `src/api/` modules. Do not instantiate a new speech engine in each component or call `speak()` during render, mount, effect replay or background events. Initialize/access browser APIs only when available, and initiate speech from a direct user action.

### Ownership and state transitions

1. A source calls `play(sourceId, textSnapshot, lang)`.
2. If that request is already starting, ignore a redundant duplicate.
3. Otherwise invalidate the previous run, cancel its utterance and pending chunks, and take ownership.
4. Speak the first chunk. On successful completion, proceed through remaining chunks.
5. On the active icon: `speaking -> paused -> speaking` as the user clicks.
6. On the final chunk's `end`: return to idle and show the speaker icon.
7. If the source unmounts, its text is replaced, the view disappears, or navigation invalidates it: cancel **only if that source still owns the run**.
8. The active source alone can affect controller state. Events and cleanup from previous runs cannot cancel or reset the new run.

Every run needs a monotonically changing run/generation ID. Capture that ID in each utterance listener and watchdog. Ignore stale `start`, `end`, `pause`, `resume` and `error` events. Treat expected `canceled`/`interrupted` errors after our own cancellation as normal control flow, not user-facing failures.

Calling the browser's `cancel()` also clears its queue, but does **not** necessarily clear its paused flag: ensure a new run is not accidentally left paused. Keep exactly one outstanding utterance at a time; never send the full chunk list into the browser queue.

### Double-click/race handling

The single visible icon is a toggle, so a double-click must **not** start and immediately pause speech. Suppress the second activation from the same icon within a short double-click interval (approximately 300 ms) while allowing an intentional subsequent Pause/Resume. Guard synchronously at the controller/button boundary, not only through React state. New playback from a **different** source must be allowed immediately and take ownership.

Pause, resume and cancellation must be idempotent. A rapid sequence such as A Play -> B Play -> A Play must leave only the last A run active. Do not use artificial delays for normal speech startup solely to detect a double-click.

## 7. Long text

Read complete long passages through internal chunking; do not truncate the whole selected/full text or require the user to select shorter text as the normal path.

- Split preferentially at sentence or paragraph boundaries, with an initial target of roughly **300–500 characters per utterance**; tune with real-browser smoke tests.
- For an unusually long sentence, split at whitespace, then at Unicode-safe boundaries if necessary. Never split within a surrogate pair/grapheme cluster.
- Preserve original order and all speakable text, including punctuation between chunks; don't duplicate words or silently skip content.
- Keep an in-memory chunk array/cursor scoped to the active run, but submit only the next chunk after the current one completes.
- Use the same voice, language and speed for every chunk in a run.
- Pause/Resume works on the current utterance. Stop/cancel internally discards all remaining chunks.
- No progress bar, chunk count or visible player. On a chunk failure, stop the session with a localized error; **do not** automatically restart or skip the chunk.

Note: Browser API length limits and engine stability vary. The browser's API documents `text-too-long`; short chunks reduce exposure but do not guarantee flawless synthesis.

## 8. Browser reliability and error handling

Handle missing `speechSynthesis` / `SpeechSynthesisUtterance`, empty voice lists, delayed voices, failed/blocked start, missing or late events, audio device problems, network-dependent voices, synthesis errors and exceptions.

- Keep the icon responsive even when browser state is inconsistent.
- Add a **conservative startup watchdog** (an initial ~15 seconds is a starting point). Do not leave the icon indefinitely busy if speech never starts.
- Add a generous per-chunk stall safeguard so missing completion events cannot leave an endless active session. Account for rate, pause and document visibility; avoid prematurely stopping legitimate slow voices.
- Use browser flags (`speaking`, `paused`, `pending`) only as supporting evidence, not as sole ownership or successful-completion truth.
- Do not guess that a stalled chunk completed, silently advance, or replay chunks automatically. Stop and present an actionable localized error.
- `cancel()` errors caused by user-driven replacement/navigation are not visible failures.
- Do not swallow genuine unexpected errors; normalize them to existing toast/inline error patterns without exposing low-level exception dumps.
- Clean up utterance listeners, timers and refs on end/error/cancel. No memory leaks after repeatedly opening history or explanation panels.
- Ensure React StrictMode/effect remounts do not cause duplicate speech.

## 9. Localization (RU / EN / FR)

Use the **existing** single-catalog-per-language i18n setup. Do not add hardcoded UI text inside components or split catalogs.

| Key (illustrative; follow existing key style) | Russian | English | French |
| --- | --- | --- | --- |
| `tts.readAloud` | Читать вслух | Read aloud | Lire à voix haute |
| `tts.pause` | Пауза | Pause | Pause |
| `tts.resume` | Продолжить | Resume | Reprendre |
| `tts.unavailable` | Озвучивание не поддерживается этим браузером | Speech synthesis is not supported by this browser | La synthèse vocale n'est pas prise en charge par ce navigateur |
| `tts.noText` | Нет текста для озвучивания | No text to read | Aucun texte à lire |
| `tts.voiceUnavailable` | Подходящий голос недоступен | No suitable voice is available | Aucune voix adaptée n'est disponible |
| `tts.failed` | Не удалось озвучить текст | Unable to read the text aloud | Impossible de lire le texte à voix haute |

Icons need the current action's accessible name (`Read aloud`, `Pause`, `Resume` in the current UI language), not an unchanging generic label. Use one localized error message for normal engine failures unless the existing UX supports a more useful distinction.

## 10. Non-regression requirements

V4.2R has just finished. Preserve existing:

- Correction flow, prompt/model selection, API calls, capacity and other user-facing error handling.
- No automatic retries or side-effect replay for correction/Explain requests.
- Original editor typing, selection, paste, new-correction, mode switching, 5,000-character validation and Correct button behavior.
- Result Text/Changes switching, copy, scrolling to highlighted corrections, click/keyboard correction navigation, manual-selection Explain behavior and text-diff fidelity.
- History opening, selecting and closing results; stale-detail bug fixes.
- Explanation loading, rendering and existing interactions.
- RU/EN/FR UI catalogs, responsive layout, light/dark themes and accessibility.

No new route, global state library, backend contract, storage schema, CSS framework, Playwright repository dependency, or future Define/Translate implementation.

## 11. Tests and manual checks

Use the existing Vitest + React Testing Library tools with a controllable `speechSynthesis` mock. Do **not** invoke actual paid correction/Explain APIs. Run the current baseline suite before touching code and compare after each step. Add focused tests for:

1. Original, result Text, result Changes, history result and explanation extracting the correct selection or the full text when none is selected.
2. DOM selections scoped to the correct explanation instance; clicking the icon does not lose a selected passage.
3. Single active owner across original/result/explanation; swapping sources cancels previous speech.
4. Icon transitions idle -> speaking -> paused -> speaking -> idle, including localized accessible labels.
5. Double-click Play does not immediately Pause; redundant and rapid commands are safe.
6. Late events from a canceled run cannot reset the new owner; cleanup of an old source cannot cancel another owner.
7. Long text chunk boundaries, punctuation/Unicode safety, ordering, pause/resume, final completion and stop mid-run.
8. Missing API, delayed voice list, method exceptions, blocked start, missing end event, long-text engine error, invalid voice and timer cleanup.
9. No network request, no TanStack Query call, no audio download or storage side effect.
10. Existing correction selection, explanation and history regression tests still pass.

**Manual browser smoke tests:** at least desktop Chromium/Edge, Firefox, Safari/iOS when accessible, including installed PWA mode when relevant. Specifically test iPhone-sized widths, double-tap, voice availability, long Russian input, long explanations, rapid switching of sources and page navigation. Browser mocking cannot verify audible output or native engine quality; explicitly report any untested platform.

## 12. Implementation stages and deliverables

### Stage A — Baseline and source inspection

- Read `AGENTS.md`, V4.2R handoff, current components, CSS and available test scripts.
- Verify exact explanation language contract and the current behavior of result history/selection.
- Record baseline tests/build/lint results and existing unrelated failures. Do not change UI yet.

### Stage B — Pure chunking and browser adapter

- Add tested text splitter and one browser speech adapter.
- Verify cancel/pause/resume, stale events, errors and timers with mocks.
- Keep UI untouched.

### Stage C — Shared React ownership

- Add a small shared context/hook that exposes current owner/state and commands.
- Test rapid competing requests, double clicks, unmount cleanup and async event races.

### Stage D — UI integration

- Add the reusable icon control, the three source integrations and minimal responsive styling.
- Replace original-editor counter row as specified; keep length validation.
- Add RU/EN/FR localized labels and errors.
- Preserve current styles and action positions, with a compact second action row on narrow result screens.

### Stage E — Regression and handoff

- Run the full relevant tests, TypeScript, build, lint and formatting checks using existing project commands.
- Perform manual browser smoke tests where tools/devices permit; do not pretend a mock proved actual audio works.
- Fix regressions within V4.5 scope and provide a concise implementation report: modified files, test results, browser limitations, untested cases and any deliberate deviations.

## 13. Acceptance checklist

- [ ] Exactly one working icon in each of the three agreed surfaces, with responsive placement.
- [ ] Original editor permanently visible character counter removed; max-length enforcement preserved.
- [ ] Read selected text if selection belongs to clicked surface; otherwise read all content of that surface.
- [ ] Russian original/result speech uses `ru-RU`; explanation language follows a verified explicit contract.
- [ ] One controller, one owner, no overlapping speech and no stale-event interference.
- [ ] Speaker / Pause / Play icons correctly represent idle/speaking/paused states and remain keyboard/screen-reader accessible.
- [ ] Double clicks and rapid cross-surface interactions are safe.
- [ ] Long text is chunked in order without intentional truncation; pause/resume and cancellation work.
- [ ] Unsupported browser and buggy engine behaviors fail cleanly without automatic retries.
- [ ] No separate player, Stop control, speed selector, voice selector or settings changes.
- [ ] RU/EN/FR labels present in existing i18n catalogs.
- [ ] Desktop and iPhone-sized views remain uncluttered and usable.
- [ ] Existing correction, diff, Explain, history, errors and styling pass regression checks.

## 14. Reference documentation

- [Web Speech API specification](https://webaudio.github.io/web-speech-api/)
- [MDN SpeechSynthesis](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis)
- [MDN SpeechSynthesisUtterance](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesisUtterance)
- [Gramota source repository](https://gitlab.com/ezzil1997/gramota)

**Implementation instruction:** Follow the agreed scope. If a real code constraint forces a meaningful UX change (especially a new control, a change to speech language, or losing existing selection behavior), stop and request a product decision instead of silently expanding the feature.
