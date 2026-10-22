# Manual model and mode benchmark

This is a small, local comparison tool for deliberate runs, not an automated test
suite or a product feature. Only the human user may invoke the benchmark command,
including preview. Agents must never invoke it, run paid comparisons, schedule
runs, or add the command to startup, CI, builds, or verification. Automated code
checks use injected mocked transport only.

## Prepare local cases

Create `apps/server/benchmark-data/cases.json` yourself. This directory is ignored
by Git. Keep actual cases, SQLite files and generated reports local; they contain
the supplied texts and model outputs. Do not put personal texts into tracked
examples, documentation, logs or automated test fixtures.

The file is a JSON array. Every case needs a unique `id` and nonempty `text`,
subject to the normal 5,000-character correction limit. Text is sent exactly as
provided, including paragraphs, spaces and emoji. This fictional example shows
the format only:

```json
[
  { "id": "punctuation-1", "text": "Привет мир!" },
  { "id": "unchanged-1", "text": "Спасибо за ответ." }
]
```

Select model IDs explicitly. The current supported IDs are:

- `google/gemma-4-26b-a4b-it` (the application default)
- `google/gemini-3.1-flash-lite` (the application alternative)

The benchmark and application use the same two-model list. Both keep the current
reasoning-disabled request and provider settings.

Duplicate or unknown IDs are rejected. There is no implicit model selection.
Existing --models commands remain Strict-only. Each selected variant receives
every identical original once, in case/variant order.

## Preview, then authorize spending

Run commands yourself from the repository root. Relative cases paths are resolved
from the server workspace because npm runs the script there.

Preview an explicitly selected pair:

```powershell
npm run benchmark -w apps/server -- --cases benchmark-data/cases.json --models google/gemma-4-26b-a4b-it,google/gemini-3.1-flash-lite
```

Preview builds the server, validates all inputs, and prints the prompt version,
model names, sentence count, and maximum request count. It does not read server
credentials, contact OpenRouter, open the application database, or create a run
folder. A missing or invalid cases file stops before requests.

For paid execution, add `--execute` to that same command. Use an interactive
terminal and type the exact confirmation shown, such as `RUN 4` for two cases
and two models. Piped confirmation and automatic approval flags are unsupported.
No actual run is authorized merely by implementing or reviewing this tool.

Execution uses the existing server environment configuration from
the root `.env` and environment variables. Development uses the system VPN;
production retains the mandatory proxy with no direct fallback. Invalid or missing
configuration prevents execution. Never print or paste credentials into a report.

## Compare Strict and Gentle rewrite

Use --variants instead of --models to select explicit model/mode pairs.
Modes are strict and gentle-rewrite. A pair uses model-id:mode; pairs are
comma-separated. Unknown models/modes, duplicate pairs and providing both
selection flags are rejected before any requests or run files.

For both requested comparisons in one report, preview these three variants:

```powershell
npm run benchmark -w apps/server -- --cases benchmark-data/cases.json --variants google/gemma-4-26b-a4b-it:strict,google/gemma-4-26b-a4b-it:gentle-rewrite,google/gemini-3.1-flash-lite:gentle-rewrite
```

This makes at most three requests per case when executed. It includes Gemma
Strict versus Gemma Gentle rewrite, and Gemma Gentle rewrite versus Gemini
Gentle rewrite, without an extra Gemini Strict request. For two cases the
execution confirmation is RUN 6. Add --execute only when ready to spend.

To test only Strict versus Rewrite for Gemma:

```powershell
npm run benchmark -w apps/server -- --cases benchmark-data/cases.json --variants google/gemma-4-26b-a4b-it:strict,google/gemma-4-26b-a4b-it:gentle-rewrite
```

To test only Rewrite across models:

```powershell
npm run benchmark -w apps/server -- --cases benchmark-data/cases.json --variants google/gemma-4-26b-a4b-it:gentle-rewrite,google/gemini-3.1-flash-lite:gentle-rewrite
```

The runner uses the production strict-v3 and rewrite-v1 prompts, identical
production parameters (including disabled reasoning and max_tokens: 8192),
response validation and 60-second timeout. Prompts are checked against their
expected versions so future changes require a deliberate benchmark update.
Benchmarks accept valid outputs even when the provider returns reasoning
fields or reports reasoning tokens; reported usage and costs are retained.
Ordinary application corrections retain their reasoning-response guard.
Each request uses the original, never an earlier corrected or rewritten result.

## Stopping and costs

Requests run sequentially. The first failure, timeout, or invalid response
stops the whole run. No model receives a retry. Storage or
report-writing failures also prevent further requests. Remaining comparisons are
marked **Not run** in the latest saved report.

Ctrl+C stops the queue after the current request finishes and its outcome is
saved, which can take up to the normal timeout. Do not force-kill the process if
you want its final report. A forced shutdown may leave only the last checkpoint
and database records. If the disk itself fails, the report may remain at an
earlier checkpoint. The runner never resumes or sends requests automatically.

Completed runs exit successfully; stopped or failed runs exit unsuccessfully.
An execution-time Ctrl+C exits with code 130. A new invocation always creates a
fresh run and may charge again for previously completed pairs, so choose cases
and models deliberately before a second run.

The maximum number of requests is cases multiplied by selected model/mode
variants. This is not a dollar cap: cost and usage are provider-reported after each request, and
failed requests can also cost money. Unknown cost is never counted as zero.

## Compare results offline

Each execution creates a unique directory under
`apps/server/benchmark-data/runs/` and prints its path. Existing runs are never
overwritten. The folder contains:

- `records.sqlite`: normal correction/request records, isolated from everyday
  history. Each sentence has one correction with its attempted model/mode requests.
- `run.json`: schema version 2, exact prompts and versions by mode, parameters
  by model, selected variants and case order, timestamps, completion state, case
  texts, per-attempt mode/variant IDs, and saved request identifiers.
- `report.html`: a self-contained comparison, updated after every attempt.

Open `report.html` directly in a browser. It needs no app server, internet, or
additional requests. Select a sentence and two model/mode variants to compare
complete outputs side by side, with the shared original above. Narrow screens stack the panels.
The default selection is the first sentence and first two variants; if only one
variant was selected, both panels show that variant.

The report shows success, failure and not-run states, returned model/provider,
generation and application timings, token usage, finish reason and reported cost.
Per-variant summaries count successes/failures/not-run comparisons and show known
cost separately from unavailable costs. All recorded request details remain in
SQLite. Text is displayed literally with whitespace preserved, not rendered as
model-supplied HTML.

Judge quality manually: necessary corrections, missed errors, unnecessary changes,
and preservation of meaning and tone. There is no reference-answer requirement,
automatic quality score, judge model or winner. A single observation is not a
statistical latency benchmark.

Choose synthetic or anonymized cases covering already-correct text, objective
errors, ambiguous phrasing, formal and conversational styles, names, links,
numbers, emoji, whitespace and embedded instructions. Accept valid alternative
corrections rather than requiring one exact reference answer. Compare quality
alongside reported cost and timing before deciding whether a model helps.

For Rewrite, assess faithfulness first, then naturalness, clarity, flow and
proportionate change. See [synthetic evaluation criteria](rewrite-evaluation.md).
Previously generated offline reports remain self-contained and readable.

## Explain every change in an existing run

Strict and Rewrite Explain can be evaluated against saved correction results without paying
for corrections again. Use an existing version-2 correction benchmark folder
containing `run.json` and `records.sqlite`. The source files stay unchanged.
The command defaults to Strict. Add `--explain-mode gentle-rewrite` to explain
successful Gentle Rewrite results instead, using the same model that rewrote them.
Failed/not-run results and results from the other mode are shown as skipped.
Unchanged results need no explanation request. Each detected change gets its own request,
using the correcting model and full original/result context. Adjacent grouped
corrections and whitespace context match the app's Changes inspector. Missed
errors cannot be explained because they did not produce a change.

Preview it yourself from the repository root, replacing the example folder:

```powershell
npm run benchmark -w apps/server -- --explain-run benchmark-data/runs/YOUR-RUN-FOLDER
```

To preview Rewrite explanations from an existing mixed-mode or Rewrite run:

```powershell
npm run benchmark -w apps/server -- --explain-run benchmark-data/runs/YOUR-RUN-FOLDER --explain-mode gentle-rewrite
```

Add `--execute` to that command when ready; type the displayed `RUN N`
confirmation yourself. It explains each detected change in every successful
Rewrite result in that source folder, including both models when present. It does
not generate new rewrites. For a small evaluation, use a source run with a small
set of cases. A Strict-only source has no eligible Rewrite changes.

The preview opens only the supplied source database read-only. It does not read
credentials, send requests, create output files or run migrations. It prints the
selected mode, prompt version and exact explanation count for this source snapshot. Do not combine `--explain-run`
with `--cases`, `--models` or `--variants`.

Add `--execute` when ready to spend and type the displayed `RUN N` confirmation
in an interactive terminal. The prepared snapshot is used after confirmation;
there are no fresh corrections or automatic retries. If there are no eligible
changes, execution sends no requests. Repeating this command creates a fresh
Explain run and may charge for the same changes again; it does not reuse app
history explanations or prior Explain benchmarks.

Requests use the actual application prompts: `explain-v1` for Strict and
`explain-rewrite-v1` (unchanged shared core plus the approved Rewrite prompt) for
Gentle Rewrite, along with the application's existing
request settings. Gemini explanations explicitly use `reasoning: { effort: 'minimal' }`
in both the app and benchmark; Gemma explanations still use disabled reasoning.
Like correction benchmarks, Explain
benchmarks accept otherwise valid answers with reasoning metadata and retain
reported usage; the run records `isRejectReasoning: false`. Application
corrections and Gemma explanations keep their reasoning-response guard enabled.
Gemini app explanations accept reasoning metadata too, as requested by the user.
The first failed response or timeout stops the queue.
Ctrl+C waits for the current response to be saved, then stops. Reports mark the
remaining changes Not run. Storage/report failures stop further requests too.
Provider-reported unknown costs remain unavailable, including on failed calls.

A new folder under `apps/server/benchmark-data/explain-runs/` contains:

- `run.json`: the source folder, exact source texts and change positions, model
  identities, selected mode, exact prompt/version, request settings, per-change status, explanation,
  reported metadata, cost and duration. These are local benchmark records only;
  application explanation accounting remains deferred.
- `report.html`: a self-contained offline report. Choose a correction result to
  see the complete original/result and **every detected change with its own
  explanation** below it. No additional requests happen when viewing the report.

Judge explanations manually for accuracy, focus, contextual reasoning, honesty
about optional or questionable edits, clear Russian and the five-sentence ceiling.
Agents may test helper functions with mocked transport only and must never invoke
the benchmark CLI, including preview.
