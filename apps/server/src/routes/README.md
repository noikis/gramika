# Server routes

All route groups are registered explicitly from app.ts:

- root.ts: GET / and built assets in production; simple API response in development.
- health.ts: GET /health for local configuration and SQLite readiness.
- corrections.ts: POST /api/corrections.
- history.ts: history listing, search and detail.
- model-settings.ts: correction configuration and saved model preference.

app-resources.ts initializes shared resources and registers shutdown cleanup.
Route groups receive their dependencies from app.ts and keep their HTTP error
handlers scoped independently.

See [the project overview](../../../../blueprint/context/project-overview.md) for
the current API and [setup and deployment](../../../../docs/container.md) for operations.
