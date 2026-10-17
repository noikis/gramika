# Fix: Enable OpenRouter response metadata

**Type:** Fix
**Branch:** fix/enable-openrouter-metadata

## Goal

Apply the user's explicit request to opt in to routing metadata using
`X-OpenRouter-Metadata: enabled` on the existing correction request.

## Scope

Add the header without changing reasoning, proxy policy, timeout, prompt or paid
request count. Verify the header using Undici MockAgent with real networking
disabled. New persisted metadata fields belong in Feature 4's History spec;
this small change does not yet store openrouter_metadata.

## Build steps

- [x] Add the metadata header and require it in the mocked transport test.
  Done when the request matches only with the opt-in header present.
- [x] Align the existing prompt-version recording assertion with the already
  active strict-v2 prompt. Do not change the prompt.
  Done when the existing success case records strict-v2.
- [x] Run the documented server suite. No OpenRouter calls, private environment
  inspection, database inspection or live server starts are permitted.

## Review

Review remains manual. No automatic review or extra completion checks. The user
owns real model testing; the environment example remains untouched.

`npm test -w apps/server` passed: 30 tests, zero failures. All upstream behavior
was mocked; no OpenRouter request was made. Ready for the user's review.

## Completion

Accepted and completed 2026-10-18. Reused 30 passing mocked tests. No extra review, checks, environment inspection or OpenRouter requests. Local landing only.
