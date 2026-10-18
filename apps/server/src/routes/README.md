# Server routes

`root.ts` provides GET `/` and is loaded by Autoload in `app.ts`.
Correction and preference endpoints are registered explicitly by
`correction-api.ts`; history endpoints are registered by `history-api.ts`.
See [architecture](../../../../docs/architecture.md) for the current API.
