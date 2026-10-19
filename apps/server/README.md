# Gramota server

Fastify API for corrections, model preferences and searchable SQLite history.
The OpenRouter transport and prompt remain server-only.

`app.ts` composes resources and routes. Internal modules expose their public API
through `index.ts`:

- `correction/`: workflow, prompt and small storage/transport contracts.
- `openrouter/`: HTTP transport and provider response parsing.
- `storage/`: Node SQLite connection, migrations, attempt recording, history and preferences.
- `benchmark/`: manual CLI, reusable runner and offline report.

These modules share the server workspace; no extra npm packages are needed.
The application imports no benchmark CLI code. Only the human may invoke
`benchmark/cli.ts`; automated tests use injected mocked transport via its runner.

Run from the repository root after installing workspace dependencies:

- `npm run dev:server`: compile/watch and run the API on port 3000.
- `npm run build:ts -w apps/server`: build contracts and server.
- `npm run start -w apps/server`: build and start the API.
- `npm test -w apps/server`: build, typecheck tests and run mocked tests with coverage.
- `npm run lint -w apps/server`: check source, tests and ESLint configuration.
- `npm run format:check -w apps/server`: check formatting.
- `npm run format -w apps/server`: format source and tests.

[Correction setup](CORRECTION.md) covers environment variables, storage and proxy
policy. [Architecture](../../docs/architecture.md) lists the API and source layout.
GET `/` is a simple server response, not a deployment readiness check.

Only the human may invoke the separate benchmark CLI, including preview.
See [manual benchmark instructions](../../docs/benchmark.md). Automated checks use
mocked transport, never model requests or private cases.
