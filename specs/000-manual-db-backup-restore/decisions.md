# Settled without asking

- **Manual backup only** — no scheduled jobs, no automatic triggers. Admin clicks "Save Data" when they choose.
- **File exported to Downloads folder** — not to a server path, not to cloud storage.
- **Restore wipes entire database** — no merging; backup completely replaces current `dev.db`.
- **30-second red-warning modal with countdown** — builder's explicit choice (decision A). Dismissing cancels the restore.
- **No cloud upload, no Google Drive** — per Standard, cloud integration is outside scope and requires a developer.
- **Only admin role can access backup/restore controls** — UI-level gate, no additional auth middleware needed beyond existing admin session.
- **ZIP handled with `jszip`** — added as a dependency (2026-08-16). No zip library was present; `jszip` is widely used, actively maintained, and typed. Used for both writing the backup archive and reading/validating restore uploads.

# Needs a developer

- None. All requirements are within the Standard. Backup is a filesystem-level operation on SQLite; restore replaces the DB file and reinitializes the Prisma client. No external integrations.