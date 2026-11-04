# Authentication deployment notes

Authentication uses Better Auth 1.7.17 with the existing SQLite database and
same-origin Fastify deployment.

Required production settings:

- `BETTER_AUTH_SECRET`: a long, stable random secret.
- `BETTER_AUTH_URL`: the canonical HTTPS origin served by the reverse proxy.
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: the Google web client.

The Google callback is:

`https://<production-origin>/api/auth/callback/google`

Email delivery and verification are intentionally deferred. The login screen
keeps the forgot-password entry point but reports that recovery email is not
available yet.

Before applying auth migrations, copy the SQLite database and any matching WAL
and SHM files to a recoverable backup directory. The initial backup created for
this checkout is under `apps/server/.migration-backups/20261105-021314/` and
passed SQLite integrity verification. To restore a backup, stop the server,
replace the active database files with the backup set, and start the server so
the existing migration runner can reconcile the schema.
