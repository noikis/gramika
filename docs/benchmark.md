# Manual V3 model benchmark

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
Each selected model receives every identical case once, in case/model order.

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
`apps/server/.env` and environment variables. Development uses the system VPN;
Home Lab retains the mandatory proxy with no direct fallback. Invalid or missing
configuration prevents execution. Never print or paste credentials into a report.

The active prompt must still be `strict-v3`. The runner reuses the production
prompt, parameters, reasoning-disabled request setting, response validation and
60-second timeout. Benchmarks accept valid correction outputs even when the
provider returns reasoning fields or reports reasoning tokens. Reported token
usage and costs are still recorded. Ordinary application corrections retain
their reasoning-response guard.
If the production prompt changes, revise the benchmark deliberately rather than
running an accidentally different prompt under a V3 label.

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

The maximum number of requests is cases multiplied by selected models. This is
not a dollar cap: cost and usage are provider-reported after each request, and
failed requests can also cost money. Unknown cost is never counted as zero.

## Compare results offline

Each execution creates a unique directory under
`apps/server/benchmark-data/runs/` and prints its path. Existing runs are never
overwritten. The folder contains:

- `records.sqlite`: normal correction/request records, isolated from everyday
  history. Each sentence has one correction with its attempted model requests.
- `run.json`: exact prompt and parameters by model, selected models and case
  order, timestamps, completion state, case texts, and saved request identifiers.
- `report.html`: a self-contained comparison, updated after every attempt.

Open `report.html` directly in a browser. It needs no app server, internet, or
additional requests. Select a sentence and two models to compare complete outputs
side by side, with the shared original above. Narrow screens stack the panels.
The default selection is the first sentence and first two models; if only one
model was selected, both panels show that model.

The report shows success, failure and not-run states, returned model/provider,
generation and application timings, token usage, finish reason and reported cost.
Per-model summaries count successes/failures/not-run comparisons and show known
cost separately from unavailable costs. All recorded request details remain in
SQLite. Text is displayed literally with whitespace preserved, not rendered as
model-supplied HTML.

Judge quality manually: necessary corrections, missed errors, unnecessary changes,
and preservation of meaning and tone. There is no reference-answer requirement,
automatic quality score, judge model or winner. A single observation is not a
statistical latency benchmark.
