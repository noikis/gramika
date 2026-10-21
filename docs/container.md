# Setup and deployment

Run commands from the repository root with Node 24.16 or later in the Node 24
line, npm workspaces and the root lockfile. For containers, use Docker Desktop's
Linux engine or Docker Engine with Compose.

## One environment file

Copy the root `.env.example` to `.env` and fill in your private values. The API
loads this file regardless of its working directory; Compose also reads it.
Shell environment values take precedence. The web needs no separate env file,
and keys must never enter the frontend bundle, image layers, Git or logs.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Use `development` locally. The Docker image sets `production`; Compose does not forward this variable from `.env`. |
| `GRAMOTA_PORT` | Docker Compose host port, default 3000; serves both web and API. |
| `OPENROUTER_API_KEY` | Server-only key required for correction. |
| `OPENROUTER_PROXY_URL` | HTTP(S) proxy required in production; ignored in development. |
| `SQLITE_PATH` | Optional native-server path, relative to `apps/server` unless absolute; default `data/gramota.sqlite`. Compose retains the default path in its volume. |

## Local development

Install dependencies with `npm ci`. In separate terminals, run
`npm run dev:server` and `npm run dev:web`. The API defaults to port 3000 and
Vite to port 5173; open the Vite URL. Vite forwards `/api` to Fastify. Restart
the API after changing `.env`; its watcher follows compiled files, not database
writes. Use the computer's system VPN; do not configure a production proxy for
native development. A local Docker container still runs in production mode and
requires a proxy even when the host is the development computer.

## Production container

The container serves the built frontend and API from one Fastify process. It
joins the existing external Docker network `nginx-proxy-manager_default`.
That network must exist before Compose starts the service. In Nginx Proxy
Manager, forward to scheme `http`, hostname `gramota`, port `3000`.

Compose also publishes `${GRAMOTA_PORT:-3000}:3000` on all host interfaces,
subject to the host firewall. The host port serves both the web interface and
API; changing it does not change Nginx Proxy Manager's internal target port.
Application authentication is not implemented. Domain, TLS and access restrictions
are deployment settings; browser clipboard use needs a suitable secure context
and retains a manual-copy fallback.

## Start and change the port

Supply `OPENROUTER_API_KEY` and `OPENROUTER_PROXY_URL` in the root `.env` or your
shell. The proxy must be reachable from inside the container. A proxy
running on the Docker Desktop host can use `host.docker.internal`; `localhost`
inside the container refers to the container itself. Do not commit credentials.

In PowerShell:

```powershell
$env:GRAMOTA_PORT = '8080'
docker compose up -d --build
```

Open `http://127.0.0.1:8080`. Omit `GRAMOTA_PORT` to use port 3000. Changing
`GRAMOTA_PORT` and running `docker compose up -d` recreates the service with the
new host port while retaining its named volume. The container always listens
on port 3000. Other devices can use `http://<server-ip>:8080` if the host firewall
allows access. Nginx Proxy Manager uses `http://gramota:3000` on the shared network.

On a POSIX shell the equivalent is:

```sh
GRAMOTA_PORT=8080 docker compose up -d --build
```

Compose also supports `--env-file <private-file>`. SQLite retains the default
`data/gramota.sqlite` relative to the server workspace; no `SQLITE_PATH`
override is set in the image or Compose configuration.
Never supply secrets as build arguments; the image build needs no API key.

The image uses Node 24 LTS and production dependencies. Linux native modules are
installed in the build stage, independently of the host's node_modules. The
runtime runs as the non-root `node` user and includes Drizzle SQL and metadata.
No compilation or benchmark runs during startup.

## Health, logs and storage

```powershell
docker compose ps
docker compose logs --tail 50 gramota
Invoke-RestMethod http://127.0.0.1:8080/health
```

`GET /health` checks only local configuration and SQLite reads. It returns
`200 {"status":"ok"}` or `503` with `status: unavailable` and reason
`DATABASE_UNAVAILABLE` or `NOT_CONFIGURED`; database failure takes precedence.
Responses use `Cache-Control: no-store` and do not change saved preferences.
Without a key or
valid proxy, the frontend can still load but correction is unavailable and the
container becomes unhealthy. A well-formed unreachable proxy can still produce
healthy local status; health does not test the proxy, VPN or OpenRouter.

Production correction always uses its configured proxy, with no direct retry or
fallback. The proxy infrastructure must independently block direct egress when
its VPN fails. This property is not established by local health or these tests.

Logs go to stdout as JSON in production and readable output in development.
Routine successful requests and health polling stay quiet. Failures contain safe
codes, operation, route template, request/attempt identifiers and timing; bodies,
text, raw URLs, query values, headers, secrets, SQL parameters, exception messages
and stacks are omitted. Fastify's existing logger handles diagnostics; no extra
logging service is needed. Compose
rotates Docker `json-file` logs at 10 MB per file, retaining at most three files.
Inspect only the logs needed for diagnosis. The service uses
`restart: unless-stopped` to restart after process failures and Docker restarts.

The named `gramota-data` Compose volume mounts `/app/apps/server/data`,
the server workspace's `data` directory,
including SQLite journal sidecars. Its actual Docker name includes the Compose
project prefix; keep the same project name when recreating the service.
Migrations run transactionally on startup and preserve saved model preference.

```powershell
docker compose up -d --force-recreate
docker compose down
docker compose up -d
```

These commands retain the volume. `docker compose down --volumes`, volume removal
and volume-pruning commands can destroy saved history; do not use them for normal
restarts. The volume is not a backup. The user deferred backup/restore on
2026-10-20 because the current data is not important enough to require it.

## Database migrations and existing history

Startup applies committed Drizzle SQL migrations transactionally and records
interrupted requests as failed without replaying them. Ship `apps/server/drizzle/`
alongside `apps/server/dist/`; Drizzle Kit is not needed at runtime. To change the
schema, edit `src/database/schema.ts`, then run
`npm run db:generate -w apps/server -- --name=<change>`. Review and commit generated
SQL and metadata together. Never edit applied migrations, rewrite the baseline's
model seed or run `drizzle-kit push` against saved history.

An existing database with application tables needs one-time baseline registration
outside the application in `__drizzle_migrations`; startup does not register it
automatically or upgrade pre-baseline schemas. The existing local database was
registered on 2026-10-19 without replacing its records; see the
[completed migration record](../blueprint/history/fixes/2026-10-19-refactor-database-with-drizzle.md).
Retain its configured path when using existing history. A fresh Docker volume
does not import the native server's database automatically. No migration or
verification should inspect private texts or reset user data.

## Verification boundary

Implementation checks used disposable containers, a disposable volume, synthetic
texts and a fake key. Proxy failure checks ran with external networking disabled;
no paid OpenRouter call or benchmark was made. The temporary verification helper
was removed at the user's request. Existing mocked server tests separately assert
zero direct dispatcher creation and no retry after a failed mandatory proxy.

Local automated checks use injected environments, isolated databases and mocked
upstream responses; agents must not read private `.env` files or personal records.
Only the human may run real corrections or the
[manual benchmark](benchmark.md), including its preview. Agent browser checks
need explicit permission and mocked correction traffic before clicking Correct.

Verified locally on 2026-10-19: image build, Compose configuration, packaged
HTML/assets/API, non-root SQLite writes, fresh migrations, exact history and model
preference retention after recreation, graceful shutdown, and missing/invalid/
unreachable proxy failure behavior. This does not verify real proxy/VPN routing,
remote deployment, backup/restore or secure clipboard access from a phone.
