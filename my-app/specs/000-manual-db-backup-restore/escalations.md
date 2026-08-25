# Escalations

## Standard says containers + Postgres; app actually runs on host with SQLite

- **Date:** 2026-08-16
- **Spec:** 000-manual-db-backup-restore
- **The edge:** The `.edgepoint/standard/` environment requires everything to run in Docker containers (`./edge`/`compose.yaml`) against a Postgres database with RLS. The actual CafeOS app in `my-app/` runs on the host via `npm run dev`/`server.js`, uses **SQLite** (`file:./dev.db` via Prisma), has custom JWT auth (`lib/auth.ts`), and Docker is **not running** on this machine.
- **What I did instead:** Built the backup/restore feature as plain Next.js route handlers operating on the host filesystem (jszip `lib/assets` icons), which is what the spec actually requires ("filesystem-level operation on SQLite"). Added `jszip` as a dependency for ZIP creation/parsing (it was not present). Auth enforced via `getAuthUser` + `requireRole(ADMIN)` per `standard/access.md`.
- **Consequence:** Container-based verification (`./edge`, `edgepoint check` in containers) cannot run here. Verification was done with `npx tsc --noEmit`, `eslint`, and a successful `npm run build` on the host.
- **Not improvised:** Nothing outside the standard was invented for this spec — the gap is purely environmental (stack mismatch), not a missing recipe.