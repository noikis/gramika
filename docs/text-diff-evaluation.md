# Offline text-diff evaluation

V4.2.1 evaluates the current deterministic engine. It does not change its behavior.
All inputs are synthetic. This command has no application server, browser,
model transport or network access, and never invokes the model benchmark tools.

Run from the repository root with the installed workspace dependencies:

```sh
npm run --silent diff:evaluate
npm run --silent diff:evaluate -- --case separator-forward
npm run --silent diff:evaluate -- --baseline test-results/text-diff/<baseline-run>/results.json
npm run --silent diff:evaluate -- --case separator-forward --baseline test-results/text-diff/<baseline-run>/results.json
```

Use `--silent` to suppress npm's script banner. The evaluator itself prints only
a completion status and its report directory, or a concise error. Shared diff
and contracts packages are built first, with detailed output in `build.log`.
There is no need to start Gramika or configure OpenRouter.

Each invocation creates a unique timestamp/random directory under ignored
`test-results/text-diff/`. Earlier runs, including the supplied baseline, are
preserved. Fixture definitions are committed separately in
`apps/server/test/fixtures/text-diff.json`. The adjacent `text-diff-fixtures.ts`
contains validation and generated performance cases.

## Editing examples

Edit `apps/server/test/fixtures/text-diff.json` as a JSON array. Add an object or
change an existing object's text, keeping each `id` unique and stable:

```json
{
  "id": "my-spelling-case",
  "original": "Превет\nмир",
  "corrected": "Привет\nмир",
  "category": "spelling",
  "description": "Correct spelling while retaining the line break.",
  "evaluation": "confirmed",
  "expectation": {
    "count": 1,
    "correctedFragments": ["Привет"],
    "unchanged": ["мир"]
  }
}
```

JSON escapes such as `\n`, `\t`, `\r` and `\u00a0` decode into the actual source
characters. Cyrillic and emoji can be typed directly. JSON requires double quotes
and does not allow comments or trailing commas; put commentary in `description`
or optional `notes`.

`expectation` is optional. Omit it to run structural checks and produce a report
without asserting a particular grouping. Its supported fields are `count`, `min`,
`max`, `kinds`, `originalFragments`, `correctedFragments`, `unchanged` and `marker`.
Use `evaluation: "exploratory"` when the desired quality is under discussion;
behavioral expectations then remain informational while structural checks still
apply. The other metadata fields shown above remain required.

Run `npm run --silent diff:evaluate -- --case my-spelling-case` after saving.
Invalid fixture fields identify the filename, case and field; duplicate IDs are
rejected. Generated exact-length performance cases remain in TypeScript so the
JSON file does not need thousands of repeated characters.
There is no upper case-count limit. Keep the built-in regression cases and their
IDs when adding examples; dedicated tests also use those cases.

### TypeScript reference for the JSON format

The file contains a `TextDiffExamples` array. This type describes JSON input;
the loader supplies `{}` when `expectation` is omitted.

```ts
type ChangeKind = "insert" | "delete" | "replace" | "move" | "whitespace";

type TextDiffExample = {
  id: string; // Unique; lowercase letters, digits and hyphens only.
  original: string;
  corrected: string;
  category:
    | "identical"
    | "spelling"
    | "inflection"
    | "punctuation-insert"
    | "punctuation-replace"
    | "whitespace"
    | "separator"
    | "split-join"
    | "movement"
    | "independent"
    | "rewrite"
    | "unicode"
    | "boundary"
    | "performance";
  description: string; // Nonempty explanation of the expected behavior.
  evaluation: "confirmed" | "exploratory";
  expectation?: {
    count?: number; // Exact group count.
    min?: number; // Minimum group count.
    max?: number; // Maximum group count.
    kinds?: ChangeKind[]; // Group kinds in output order.
    originalFragments?: string[]; // Flattened exact changed fragments, in group/span order.
    correctedFragments?: string[];
    unchanged?: string[]; // Each must occur in an unhighlighted run on both sides.
    marker?: "deletion" | "move-source"; // At least one marker of this kind.
  };
  notes?: string;
  performance?: boolean; // Collect warmed timing samples when true.
};

type TextDiffExamples = TextDiffExample[];
```

Counts must be nonnegative integers. The array must contain at least one entry;
IDs must be nonempty and unique. Unknown fields are rejected. Runtime validation
is defined by the Zod schemas in
[`text-diff-fixtures.ts`](../apps/server/test/fixtures/text-diff-fixtures.ts).

## Files and lifecycle

- `results.json`: schema version 1, UTC run timestamp, Git revision and dirty
  indicator, Node/ICU/platform details, effective settings, selected IDs,
  lifecycle status, summary and per-case data. Each case preserves the exact
  inputs, expected behavior/evaluation status, complete actual `TextDiff`, named
  assertion outcomes/errors, initial pure-diff elapsed time and any warmed timing
  samples. Timing excludes validation and report writing.
- `report.md`: generated from those same results. Includes exact changed
  fragments, UTF-16 boundaries, comparison context, failures and separately
  labeled exploratory quality expectations. Fixture text is escaped; spaces,
  tabs, CR/LF and NBSP are displayed visibly here only. The JSON keeps original
  source characters and offsets.
- `run-status.json`: bootstrap lifecycle, including builds. A failed build may
  leave this manifest and its log without evaluation reports.
- `build.log`: prerequisite build output, separate from evaluation results.

JSON/Markdown are saved incrementally using temporary files and rename. Each
individual file is replaced atomically; the pair is not a transactional unit.
The JSON is authoritative when reading/comparing a run. A running, interrupted
or failed run must not be interpreted as a completed baseline. Abrupt termination
can leave a running status or temporary file; it cannot certify a completed pass.
Catchable SIGINT/SIGTERM saves available cases as interrupted (exit 130).

`completed` means all selected cases ran, **not** that assertions passed. Inspect
`summary.failed` and `summary.failedAssertions`. Failed assertions return exit 1
and preserve both successful and failed cases. Operational failures return a
nonzero status and save available results when the output directory is writable.
If writing fails, the terminal error names the problem and directory.

## Assertions and expectations

The same fixture evaluator runs through `apps/server/test/text-diff.test.ts` and
the CLI. Existing hand-written tests and 200 seeded generated combinations are
retained in the server suite; they supplement the fixed report corpus.

Structural assertions always apply, including on exploratory cases. They cover
bounded integer UTF-16 ranges, positive changed spans, grapheme safety, unique
group IDs, exact bidirectional run/span ownership, complete run partitions,
disjoint changed ownership, context containment, residual coverage, movement
identity/markers, determinism, identical/empty inputs and schema-valid Explain
selections within the per-side span limit. Unchanged anchors have explicit
fixture assertions. A separate span-union assertion protects future regrouping
against lost, duplicated or newly highlighted coverage.

Confirmed behavioral expectations can require an exact group count/kinds and
fragments, or allow a bounded group count without fixing the entire output.
Exploratory expectations describe future presentation/grouping quality and are
not approved pass/fail behavioral rules. They never excuse a structural failure.
Do not update expectations or fix the algorithm merely to get a green report.
Record a discovered existing failure and obtain a separate repair decision.

The test-only presentation bridge compiles actual web modules with the installed
TypeScript compiler and renders `ResultView` with React server rendering. This
checks rendered content, empty labels, whitespace descriptions, exact highlights,
multi-span movement and comparison context. It does not verify CSS, keyboard
interaction or DOM selection. Explain integration tests inject mocked transports;
both correction modes accept genuine recomputed groups and reject fabricated
selections. No real provider call is permitted.

## Comparing a later improvement

Pass a previous completed `results.json` explicitly. The reader validates its
schema, unique case IDs, selected-case consistency and summary. Completed reports
containing failures remain usable for honest baseline comparisons.

The candidate JSON and Markdown include baseline provenance and comparison data.
Cases match by ID, and direct output comparisons require byte-for-byte equal
original/corrected JavaScript strings. Added, missing and changed-input cases are
labeled separately. A selected-case run against a full baseline labels the
unselected baseline cases missing; it does not assert they regressed.

For comparable cases, inspect group counts/kinds, comparison boundaries, exact
spans, group IDs, runs/markers and assertion changes. Changes to fixture metadata
or expectations are identified separately. Changed cases include both baseline
and candidate detail in Markdown; complete data is also available in JSON.
Timing differences are diagnostic and do not make a case a quality regression.
Do not accept a behavior change solely because it reduces group count.

## Initial measured baseline (2026-10-27)

The unchanged engine passed 47 synthetic cases (7 exploratory) and 9,183 named
assertions on Windows x64, Node v24.16.0, ICU 78.3. The implementation revision is
recorded in the local report with `isDirty: true`; the new tooling was uncommitted.
This is corpus evidence, not proof that all possible inputs are correct.

Current observations, intentionally unchanged:

| Case                                | Observed output                                                                                                            |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `чат бот` → `чат-бот`               | Inserted hyphen and removed space form two groups. Both words remain unhighlighted.                                        |
| `чат-бот` → `чат бот`               | Inserted space and deleted hyphen form two groups.                                                                         |
| `слово ,` → `слово,`                | One whitespace group owns the removed space; context includes the comma. The current card renders no visible space symbol. |
| `Очень хорошо` → `Просто отлично`   | Two positional word replacements. Future alignment quality remains exploratory.                                            |
| `Она был готов` → `Она была готова` | Two independent replacement groups.                                                                                        |

The timing cases use exact input lengths, one additional warm-up call and five
pure-diff samples. Initial medians in milliseconds were:

| UTF-16 length | Local edit | Repeated words | Substantial rewrite |
| ------------- | ---------: | -------------: | ------------------: |
| 100           |      0.183 |          0.346 |               0.331 |
| 400           |      0.472 |          0.363 |               2.102 |
| 1,000         |      1.296 |          1.471 |               1.547 |
| 5,000         |      5.528 |          7.008 |               6.928 |

These are local measurements, not portable limits or acceptance thresholds.
Inspect the saved candidate samples for comparisons on the same runtime.

## Verification

```sh
npm test -w apps/server
npm run lint -w apps/server
npm run lint -w apps/web
npm run build -w apps/web
```

The existing server command builds shared dependencies, checks test TypeScript
and runs `node:test` with coverage. No new runner or CI workflow is introduced.
Capture detailed logs to ignored result storage when running these checks for a
handoff. The report command is independent of the model benchmark commands.
