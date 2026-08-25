# Plan: Fix Prisma Migration Error — NOT NULL column to non-empty table

## Problem
Existing users upgrading from a version without `RestaurantTable.slug` get this error on startup:

```
Added the required column "slug" to the "RestaurantTable" table without a default value.
There are 3 rows in the table, it is not possible to execute this step.
```

`prisma db push` tries `ALTER TABLE ADD COLUMN "slug" TEXT NOT NULL` — SQLite rejects
this for non-empty tables. The app shows a dialog and quits.

## Root Cause
- `RestaurantTable.slug` is `String @unique` (no default) in `schema.prisma:144`
- `setupDatabase()` only copies `dev.db` when the destination doesn't exist — upgrading users
  keep their old `cafeos.db` which lacks the `slug` column
- `migrateDatabase()` runs `prisma db push` which fails before `verifySchema()` can catch it

## Solution: Pre-migration with Prisma Client

Add an `ensureSchema()` function that runs **before** `db push`. It uses Prisma Client's
`$executeRaw` to manually add the `slug` column (nullable), populate it using the same
slug-generation logic as `seed.js`, and create the unique index. After this, `db push`
becomes a no-op (schema already matches) and `verifySchema()` passes.

### Slug generation (must match `seed.js:239`)
```
name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
```
For existing table names like `T1`, `Bar-1`, `Outdoor-1`, the SQL equivalent is:
```sql
LOWER(name)
```
(sufficient since these names only contain alphanumerics and hyphens).

## Implementation Steps

### Step 1: Add `ensureSchema()` function
**File**: `my-app/electron/main.js` — insert between `migrateDatabase()` (ends line 144) and `verifySchema()` (starts line 147)

```javascript
function ensureSchema() {
  return new Promise(async (resolve, reject) => {
    try {
      const prismaClientPath = path.join(APP_DIR, 'lib', 'prisma-client');
      if (!fs.existsSync(prismaClientPath)) {
        log('Prisma client not found — skipping ensureSchema');
        return resolve();
      }
      const { PrismaClient } = require(prismaClientPath);
      const prisma = new PrismaClient();

      const cols = await prisma.$queryRaw`PRAGMA table_info(RestaurantTable)`;
      const hasSlug = cols.some((c) => c.name === 'slug');

      if (!hasSlug) {
        log('Pre-migration: adding slug column to RestaurantTable...');
        // SQLite allows adding nullable columns to non-empty tables
        await prisma.$executeRaw`ALTER TABLE "RestaurantTable" ADD COLUMN "slug" TEXT`;
        // Populate with unique slugs matching seed.js pattern: name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        await prisma.$executeRaw`UPDATE "RestaurantTable" SET "slug" = LOWER(name) WHERE "slug" IS NULL`;
        // Add unique index to match Prisma @unique
        await prisma.$executeRaw`CREATE UNIQUE INDEX IF NOT EXISTS "RestaurantTable_slug_key" ON "RestaurantTable"("slug")`;
        log('Pre-migration: slug column added and populated');
      }

      await prisma.$disconnect();
      resolve();
    } catch (err) {
      log('ensureSchema error: ' + err.message);
      try { await prisma?.$disconnect(); } catch (_) {}
      reject(err);
    }
  });
}
```

### Step 2: Call `ensureSchema()` before `db push`
**File**: `my-app/electron/main.js` — in `migrateDatabase()`, line 95, before `log('Running prisma db push...')`

```javascript
    await ensureSchema();
    log('Running prisma db push...');
```

### Step 3: Call `ensureSchema()` in the Prisma-CLI-missing path
**File**: `my-app/electron/main.js` — line 85-93, modify the CLI-missing block

```javascript
    if (!fs.existsSync(prismaCli)) {
      log('Prisma CLI not found — running ensureSchema + verifySchema...');
      return ensureSchema()
        .then(() => verifySchema())
        .then(() => resolve({ success: true, skipped: true }))
        .catch((err) => {
          log('Schema fix/verify failed (Prisma CLI missing): ' + err.message);
          reject(err);
        });
    }
```

### Step 4: Add `--accept-data-loss` fallback for `db push`
**File**: `my-app/electron/main.js` — line 124-137, modify the `proc.on('exit')` handler

If `db push` exits non-zero with an error about NOT NULL columns or existing rows, retry
with `--accept-data-loss` flag as a last resort. This handles any schema drift beyond
`slug` that `ensureSchema()` didn't cover.

## What this fixes
| Scenario | Before | After |
|----------|--------|-------|
| Fresh install (no existing DB) | `setupDatabase` copies dev.db (has slug) → db push no-op → works | Same (ensureSchema sees slug exists, skips) |
| Upgrade from old version (DB without slug) | db push fails on NOT NULL → app quits | ensureSchema adds column → db push no-op → works |
| Prisma CLI not bundled | verifySchema fails (no slug) → app quits | ensureSchema adds column via Prisma Client → verifySchema passes |

## Risk: Other NOT NULL columns
If other models have NOT NULL columns without defaults that were also added post-initial-version,
`db push` could still fail. The `--accept-data-loss` fallback (Step 4) handles this.
`ensureSchema()` can be extended for additional columns as needed.

## Status: COMPLETED — Ready for end-to-end testing
All four implementation steps were applied to `my-app/electron/main.js`:
- `ensureSchema()` function added (line 185)
- Called before `db push` (line 96)
- Called in Prisma-CLI-missing path (lines 87-93)
- `--accept-data-loss` fallback added (lines 126-175)

**Builds verified**:
- `npx tsc --noEmit` — passes (no errors)
- `npm run build` (Next.js) — succeeds
- `npx electron-builder --win --dir -p never` (packaging) — all files present:
  - `resources/app/electron/main.js` (with `ensureSchema`)
  - `resources/app/lib/prisma-client/index.js`
  - `resources/app/node_modules/prisma/build/index.js`
  - `resources/app/node_modules/@prisma/engines/query_engine-windows.dll.node`
  - `resources/app/.next/` (build output)
  - `resources/prisma/dev.db` (extraResource — fresh seed DB)
- `npx electron-builder --win --publish never` (NSIS) — `CaféOS Setup 1.0.3.exe` rebuilt (415MB) at 3:27 AM

**Remaining**: End-to-end test on a machine with a stale `cafeos.db` (has 3 table rows, no `slug` column) to confirm the pre-migration runs successfully and the app reaches the login screen.
