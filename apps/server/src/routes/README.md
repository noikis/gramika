# Server routes

All route groups are registered explicitly from app.ts:

- root.ts: GET / (simple server response).
- corrections.ts: POST /api/corrections.
- history.ts: history listing, search and detail.
- model-settings.ts: correction configuration and saved model preference.

app-resources.ts initializes shared resources and registers shutdown cleanup.
Route groups receive their dependencies from app.ts and keep their HTTP error
handlers scoped independently.

See [architecture](../../../../docs/architecture.md) for the current API.
