# Feedback: standard env (containers/Postgres) vs actual app (host/SQLite)

- **When:** 2026-08-16
- **During:** build of spec `000-manual-db-backup-restore`
- **Gap:** The `standard/` environment (compose.yaml, `./edge`, Postgres + RLS) does not match how this app actually runs: host-run Next.js + Prisma + SQLite (`file:./dev.db`), custom JWT auth, Docker not running on the machine.
- **Impact:** `./edge`-based verification and container tests cannot run. Verification done via host `tsc`, `eslint`, and `npm run build` instead.
- **Logged also in:** `specs/000-manual-db-backup-restore/escalations.md`.
- **Suggestion:** Either adapt the environment standard for this codebase (host-run, SQLite) or accept that spec verification happens on the host.

## Per-spec note: kitchen-customer-messages (005)

- **When:** 2026-08-16
- **During:** build of spec `005-kitchen-customer-messages`
- **Verification done on host:** `tsc --noEmit` clean; `eslint` clean on changed files (only pre-existing warnings/errors elsewhere); `npm run build` passes. API behaviour verified live against the running host server (dev SQLite): customer messages are attributed to the order's customer name even when the body sends a spoofed `sender`; staff replies are attributed to the signed-in staff member's name.
- **Could not verify:** the Playwright acceptance tests can't execute (Docker down; container-only). The browser-side message UI and socket wiring are covered by code review and the build, but were not exercised in a headless browser on the host.
- **Reversible:** nothing here is environment-specific.