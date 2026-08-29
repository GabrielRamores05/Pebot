# Plan — Manual DB Backup/Restore

*Derived from `spec.md` plus the project constitution and locked technical
decisions. Nobody asked the builder to author this and nobody should. It exists
so that a build survives this session ending, or the builder switching to a
different AI tool halfway through.*

*Written during `/clarify`, once the spec is settled.*

## Recipes used

- **`file-upload.md`** — shape for handling a file upload from the admin UI (Restore Data). Adapted for the actual stack (Next.js route handler, host filesystem) per the environment escalation in `escalations.md`.
- **`access.md`** (standard) — the "Who uses it" section is a single actor: **Admin**. Enforced as admin-only at both the UI (buttons hidden for non-admins) and the route handler (`getAuthUser` + `requireRole(ADMIN)`).
- **`errors.md`** — the restore failure paths return plain-sentence user errors exactly as the spec states ("Failed to restore backup. The selected file is not a valid CafeOS backup.") and log full details server-side.

No recipe covers SQLite-file backup/restore (the Postgres-oriented patterns don't
apply). That gap is documented in `escalations.md`.

## Data

- **`prisma/dev.db`** (SQLite, the live database) — the single artifact backed up and restored.
- **No schema changes** in this spec. No new tables or columns. *Superseded by Phase 2 (2026-08-28): schema now includes `Location`, `AuditEvent` (was `AuditLog`), and `locationId` on 29 business tables (migration `20260829000000_add_location_and_audit_event`). Restore now implements constitution §VII: checksum `X-Backup-Checksum` (SHA-256), pre-restore snapshot, and `restoreInFlight` guard (`app/api/restore/route.ts:14`).*
- **Access:** only an authenticated user with role `ADMIN` may read the database file (backup) or replace it (restore). The route handlers enforce this with the existing JWT session (`lib/auth.ts`). The UI also hides the buttons unless `user.role === 'ADMIN'`.

## Screens

- **Admin sidebar (all admin pages)** — "Save Data" and "Restore Data" buttons in the user section, rendered only for admins.
- **Restore confirm modal** — 30-second countdown, message "Current database will be permanently lost. Are you sure?", Cancel and Confirm actions. Confirm disabled until the countdown reaches zero.
- **Restore error modal** — shown when the uploaded archive is invalid/corrupt, with the spec's exact message.
- **Post-restore redirect** — after a successful restore, the app redirects to `/login` (all sessions invalidated because the user table came from the backup).

## Outside connections

- None. No cloud, no email, no payments. The ZIP is produced and consumed entirely on the local machine.

## Not covered by the standard

- The standard patterns assume Postgres in containers with RLS; this app runs on the
  host with SQLite (`file:./dev.db`). Backup/restore is therefore a filesystem
  operation in Next.js route handlers, not a `pg_dump`/migration concern. See
  `escalations.md` for details.
- The standard requires e2e tests run via `./edge test` (Playwright in the container). Docker is not running, so acceptance tests are written in `tasks.md` but cannot be executed here. Escalated alongside the environment gap.