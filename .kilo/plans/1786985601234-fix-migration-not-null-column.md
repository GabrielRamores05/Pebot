# Plan: Fix Prisma Migration Error on Upgrade (NOT NULL column to non-empty table)

## Problem
On machines with an existing `cafeos.db` (from a previous app version lacking the `slug` column),
`prisma db push` fails with:

```
Added the required column "slug" to the "RestaurantTable" table without a default value.
There are 3 rows in the table, it is not possible to execute this step.
```

SQLite cannot add a `NOT NULL` column to a non-empty table in a single step.
Prisma's `db push` tries to add `slug TEXT NOT NULL` and fails.

## Root Cause
- `RestaurantTable.slug` is defined as `String @unique` in `schema.prisma:144`
- For existing databases (stale `cafeos.db`), the column doesn't exist
- `db push` attempts `ALTER TABLE ADD COLUMN slug TEXT NOT NULL` — rejected by SQLite for non-empty tables
- The `verifySchema()` function (added in previous session) then catches the missing column and rejects

## Solution: Pre-migration with Prisma Client

Before running `db push`, check if `slug` column exists. If missing, add it manually
using Prisma Client's `$executeRaw`:

1. `ALTER TABLE "RestaurantTable" ADD COLUMN "slug" TEXT` (nullable, no constraint)
2. `UPDATE "RestaurantTable" SET "slug" = 'table-' || "id" WHERE "slug" IS NULL` (populate)
3. `CREATE UNIQUE INDEX "RestaurantTable_slug_key" ON "RestaurantTable"("slug")` (unique constraint)

After this, `db push` should be a no-op (schema already in sync), and `verifySchema()` passes.

### Also handle the "Prisma CLI missing" path
When Prisma CLI is not bundled, the same `ensureSchema()` function should run
as a fallback (instead of or in addition to `verifySchema()`).

## Implementation Steps

### Step 1: Add `ensureSchema()` function
**File**: `my-app/electron/main.js` (after `migrateDatabase()`, before `verifySchema()`)

```javascript
function ensureSchema() {
  return new Promise(async (resolve, reject) => {
    try {
      const prismaClientPath = path.join(APP_DIR, 'lib', 'prisma-client');
      if (!fs.existsSync(prismaClientPath)) {
        return resolve();
      }
      const { PrismaClient } = require(prismaClientPath);
      const prisma = new PrismaClient();

      // Check if slug column exists
      const cols = await prisma.$queryRaw`PRAGMA table_info(RestaurantTable)`;
      const hasSlug = cols.some(c => c.name === 'slug');

      if (!hasSlug) {
        log('Pre-migration: adding slug column to RestaurantTable...');
        await prisma.$executeRaw`ALTER TABLE "RestaurantTable" ADD COLUMN "slug" TEXT`;
        await prisma.$executeRaw`UPDATE "RestaurantTable" SET "slug" = 'table-' || "id" WHERE "slug" IS NULL`;
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
In `migrateDatabase()`, before the `log('Running prisma db push...')` line:

```javascript
    await ensureSchema();
    log('Running prisma db push...');
```

### Step 3: Call `ensureSchema()` + `verifySchema()` in the CLI-missing path
Replace the current skip-and-resolve with:

```javascript
    if (!fs.existsSync(prismaCli)) {
      log('Prisma CLI not found — running ensureSchema + verifySchema...');
      return ensureSchema()
        .then(() => verifySchema())
        .then(() => resolve({ success: true, skipped: true }))
        .catch((err) => {
          log('Schema fix/verify failed: ' + err.message);
          reject(err);
        });
    }
```

### Step 4: Add `--accept-data-loss` fallback for `db push`
If `db push` still fails after `ensureSchema()`, retry with `--accept-data-loss`
as a last resort to handle any remaining schema drift.

## Files to Modify
| File | Change |
|------|--------|
| `my-app/electron/main.js` | Add `ensureSchema()` function; call before `db push`; use in CLI-missing path; add `--accept-data-loss` fallback |

## Validation
| Test | Expected |
|------|----------|
| Fresh install (no existing DB) | `ensureSchema()` sees `slug` exists, skips; `db push` no-op; `verifySchema()` passes |
| Upgrade from old version (DB without `slug`) | `ensureSchema()` adds column; `db push` no-op; `verifySchema()` passes |
| No Prisma Client available | `ensureSchema()` skipped gracefully; `verifySchema()` provides best-effort check |
| Existing rows in RestaurantTable | Column added as nullable, populated with `table-<id>`, unique index created |
