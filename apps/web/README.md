# Gramota web

React/Vite client for Russian proofreading, local Text/Changes views, clipboard
actions and searchable correction history. Model selection offers Gemma 4 as
Standard and Gemini 3.1 Flash Lite as Higher cost. Gemini's helper text is shown
only when selected; better quality has not been established by the user.

Run from the repository root:

- `npm run dev:web`: start Vite; run `npm run dev:server` in another terminal.
- `npm run build -w apps/web`: build contracts, typecheck and bundle the client.
- `npm run preview -w apps/web`: preview the built client; this does not start the API.
- `npm run lint -w apps/web`: check code quality.
- `npm run format:check -w apps/web`: check formatting.
- `npm run format -w apps/web`: format source and configuration.

Vite proxies relative `/api` requests to Fastify on port 3000. OpenRouter
credentials are never included in the web bundle. Tailwind and local CSS provide
the theme; Roboto and its license are bundled. Sonner provides transient feedback.

No web test runner or browser test command is configured. Playwright MCP requires
explicit user approval. Browser checks must mock correction traffic before an
agent clicks Correct; paid requests and benchmark commands are human-only.
