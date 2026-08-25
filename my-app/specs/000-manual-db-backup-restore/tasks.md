# Tasks — Manual DB Backup/Restore

*Ordered. Tick as you go — if the session ends, the next one starts here.*

*Internal. The builder is not expected to read or approve this.*

- [x] Add `IconDownload` and `IconUpload` to `lib/assets.tsx`.
- [x] Build `app/api/backup/route.ts` — admin-only GET that streams the live database as `cafeos-backup-YYYY-MM-DD-HH-MM.zip`.
- [x] Build `app/api/restore/route.ts` — admin-only POST that validates the uploaded ZIP (contains `dev.db`, is real SQLite), stages it, swaps the live database, and redirects to login.
- [x] Add "Save Data" and "Restore Data" buttons to the admin sidebar (admin role only).
- [x] Add the 30-second countdown confirmation modal and the invalid-backup error modal to the admin layout.
- [x] Verify: `tsc --noEmit`, `eslint`, `npm run build` all clean.
- [x] Write the acceptance tests in `tests/acceptance/` mapping every criterion in `spec.md`.

## Acceptance criteria → tests

*Every criterion in `spec.md` gets one end-to-end test. This mapping is how the
builder verifies their own software, so it must be complete before the build is
considered done.*

| Criterion (from spec.md) | Test |
|---|---|
| When I click "Save Data" in the admin panel, then a backup file downloads to my Downloads folder containing a snapshot of all current data. | `tests/acceptance/manual-db-backup-restore.spec.ts` → "saves a backup with the current data" |
| When I click "Save Data", then the backup file is named `cafeos-backup-YYYY-MM-DD-HH-MM.zip` (timestamp of when the backup was taken). | `tests/acceptance/manual-db-backup-restore.spec.ts` → "names the backup with a timestamp" |
| When I click "Restore Data" and select a backup file, then a 30-second warning modal appears with the message: "Current database will be permanently lost. Are you sure?" | `tests/acceptance/manual-db-backup-restore.spec.ts` → "shows the 30-second warning before restoring" |
| When I confirm the warning, then the current database is replaced with the backup and I am redirected to the login page. | `tests/acceptance/manual-db-backup-restore.spec.ts` → "restores the backup and sends me to login" |
| When I dismiss the warning, then the restore is cancelled and I remain on the current page. | `tests/acceptance/manual-db-backup-restore.spec.ts` → "cancels the restore when I dismiss the warning" |
| When I restore a backup, then the restored database contains all previous data (orders, tables, staff assignments, loyalty cards) exactly as it was at export time. | `tests/acceptance/manual-db-backup-restore.spec.ts` → "restores all previous data" |
| When I attempt to restore a corrupted or invalid backup file, then an error modal appears: "Failed to restore backup. The selected file is not a valid CafeOS backup." | `tests/acceptance/manual-db-backup-restore.spec.ts` → "rejects an invalid backup file" |