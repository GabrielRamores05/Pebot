# Escalations

## Standard Postgres patterns don't apply; app runs on host with SQLite

- **Date:** 2026-08-16
- **Spec:** 000-manual-db-backup-restore
- **The gap:** The project's locked technical decisions specify SQLite on the host, not Postgres in containers. Docker is not running on this machine.
- **What I did instead:** Built the backup/restore feature as plain Next.js route handlers operating on the host filesystem (jszip `lib/assets` icons), which is what the spec actually requires ("filesystem-level operation on SQLite"). Added `jszip` as a dependency for ZIP creation/parsing (it was not present). Auth enforced via `getAuthUser` + `requireRole(ADMIN)` per constitution §II.
- **Consequence:** Container-based Playwright tests cannot run here. Verification was done with `npx tsc --noEmit`, `eslint`, and a successful `npm run build` on the host.
- **Not improvised:** Nothing outside the standard was invented for this spec — the gap is purely environmental (stack mismatch), not a missing pattern.