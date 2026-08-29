# Manual DB Backup/Restore

This spec describes the "Save Data" and "Restore Data" feature for CafeOS, letting the admin export the live database as a timestamped backup file and restore from a previously saved backup.

## What this is for

The admin needs to be able to back up the current database state locally before performing risky operations, or recover from database corruption. This is a local-only backup — no cloud upload, no scheduled jobs. The admin manually initiates exports and decides when to copy the file off the machine.

## Who uses it

- **Admin** — the only user who can access the backup/restore controls from the admin panel.

## What people need to do

- **Save Data:** Click the "Save Data" button in the admin panel → a ZIP file containing a snapshot of `dev.db` is downloaded to the Downloads folder with filename `cafeos-backup-YYYY-MM-DD-HH-MM.zip`.
- **Restore Data:** Click the "Restore Data" button → select a previously saved `.zip` file → a 30-second red-warning modal appears counting down "Current database will be permanently lost. Are you sure?" → if confirmed, the live `dev.db` is replaced with the backup data and the app redirects to the login page (all existing sessions invalidated).

## What it will not do

- This feature does **not** automatically schedule backups. The admin must click "Save Data" manually.
- This feature does **not** upload to Google Drive, Dropbox, or any external service. The file stays on the local machine and must be copied off by the admin.
- This feature does **not** attempt to merge backup data with existing data — restore completely replaces the current database.

## Rules the business cares about

- Backups are **manual only** — no automated nightly jobs. The admin decides when to save.
- Backup files are **local only** — the app does not transmit or store files on a server.
- **Restore is destructive** — the current database is permanently replaced. A warning modal with countdown is mandatory.
- The admin is responsible for **off-site storage** of exported files. The app makes no guarantees about external transport.

## Money

- No money moves through this feature. It is an operational tool.

## Information about people

- The exported database includes all customer-identifiable data (loyalty names, order names, etc.). Per `personal-data.md`, the admin must handle this data according to the business's privacy obligations. No automatic redaction is performed.

## How we'll know it works

- When I click "Save Data" in the admin panel, then a backup file downloads to my Downloads folder containing a snapshot of all current data.
- When I click "Save Data", then the backup file is named `cafeos-backup-YYYY-MM-DD-HH-MM.zip` (timestamp of when the backup was taken).
- When I click "Restore Data" and select a backup file, then a 30-second warning modal appears with the message: "Current database will be permanently lost. Are you sure?"
- When I confirm the warning, then the current database is replaced with the backup and I am redirected to the login page.
- When I dismiss the warning, then the restore is cancelled and I remain on the current page.
- When I restore a backup, then the restored database contains all previous data (orders, tables, staff assignments, loyalty cards) exactly as it was at export time.
- When I attempt to restore a corrupted or invalid backup file, then an error modal appears: "Failed to restore backup. The selected file is not a valid CafeOS backup."

## Settled without asking

- Manual backup/export only — no scheduled jobs or automatic triggers.
- File exported to user's Downloads folder, not to a server path.
- Restore wipes the entire current database — no merging of backup into existing data.
- 30-second red-warning modal with countdown before restore executes (builder's explicit choice, decision A).
- No cloud upload, no Google Drive integration — per Standard, this is outside scope.
- Only admin role can access backup/restore controls.
- Post-Phase-2, restore verifies SHA-256 if `X-Backup-Checksum` sent, snapshots current DB, and blocks concurrent restores (429) per constitution §VII.

## Needs a developer

- None. All requirements are within the Standard.

## Still open

- None. All business questions resolved in the interview.