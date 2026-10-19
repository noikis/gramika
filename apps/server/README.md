# Gramota server

Fastify API for corrections, model preferences and searchable SQLite history.
The OpenRouter transport and prompt remain server-only.

`app.ts` composes resources and routes. Internal modules expose their public API
through `index.ts`:

- `correction/`: workflow, prompt and repository/transport contracts.
- `openrouter/`: HTTP transport and provider response parsing.
- `database/`: better-sqlite3 connection, Drizzle schema, migrations and lifecycle.
  Its `repositories/` folder owns correction, history and model-preference queries.
- `benchmark/`: manual CLI, reusable runner and offline report.

These are internal modules in the server workspace, not separate workspace packages.
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
- `npm run db:generate -w apps/server -- --name=<change>`: generate SQL migrations
  after a schema change. Review and commit the SQL and metadata in `drizzle/`.

Startup applies migrations with Drizzle. Runtime packaging must include `drizzle/`
alongside `dist/`. See [correction setup](CORRECTION.md) for existing databases.

[Correction setup](CORRECTION.md) covers environment variables, storage and proxy
policy. [Architecture](../../docs/architecture.md) lists the API and source layout.
GET `/` is a simple server response, not a deployment readiness check.

Only the human may invoke the separate benchmark CLI, including preview.
See [manual benchmark instructions](../../docs/benchmark.md). Automated checks use
mocked transport, never model requests or private cases.
