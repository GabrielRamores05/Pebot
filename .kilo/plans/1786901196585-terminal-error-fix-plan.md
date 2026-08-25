# Plan: Fix Terminal Error & Fresh Install Issues

## Problem Summary

When installing v1.0.3 on a new computer:
1. Terminal page shows "Something went wrong" error
2. "Restoring data" doesn't work
3. Need to understand login credentials and data storage

---

## Root Cause Analysis

### Data Storage (Electron Packaged App)
- **Dev mode**: Uses `prisma/dev.db` in project root
- **Production (packaged)**: 
  - Database stored at: `%APPDATA%\cafeos\cafeos.db` (Windows)
  - On first run: Copies `prisma/dev.db` (from extraResources) → `%APPDATA%\cafeos\cafeos.db`
  - Runs `prisma db push` to sync schema
  - Runs `electron/seed.js` to seed default data (users, categories, products, tables)

### Login Credentials (Seeded on First Run)
| Role    | Email                     | Password   |
|---------|---------------------------|------------|
| Admin   | admin@cafeos.local        | admin123   |
| Staff   | staff@cafeos.local        | staff123   |
| Kitchen | kitchen@cafeos.local      | kitchen123 |

### Why Terminal Fails on Fresh Install
1. **`prisma db push` may fail silently** - No error handling in `migrateDatabase()`
2. **`electron/seed.js` might not run** - Called after `migrateDatabase()` but if migration fails, seed never runs
3. **API endpoints fail** - `/api/categories`, `/api/tables`, `/api/settings/business` return errors because DB isn't seeded
4. **Terminal page has no error boundary** - Just crashes with generic "Something went wrong"
5. **No fallback UI** - If DB is empty, terminal shows error instead of empty state

### Additional Issues Found
6. **Inconsistent seed data** - `prisma/seed.ts` (dev) vs `electron/seed.js` (prod) have different data structures
7. **No error handling in terminal page fetches** - `fetch('/api/categories')` etc. have no `.catch()` or error UI
8. **Terminal page assumes data exists** - No empty state handling for categories/tables/products
9. **No database integrity check** - App doesn't verify DB was seeded successfully before rendering

---

## Plan

### Phase 1: Fix Terminal Error Handling (High Priority)
1. **Add error boundary to terminal page**
   - Catch fetch errors and show meaningful message
   - Show retry button
   - Show empty state when DB is empty (not error)

2. **Add loading/error states to terminal page**
   - Show spinner while fetching categories/tables/settings
   - Show "No categories found" instead of crashing
   - Add retry mechanism for failed fetches

3. **Add empty state handling in terminal page**
   - Handle empty categories array gracefully
   - Handle empty tables array gracefully
   - Show helpful message when no products exist

### Phase 2: Fix Fresh Install Database Setup (High Priority)
1. **Improve `migrateDatabase()` in `electron/main.js`**
   - Add proper error handling and logging
   - Ensure it waits for completion before continuing
   - Log success/failure clearly
   - Return success/failure status to caller

2. **Ensure `seed.js` runs reliably**
   - Verify it's called after successful migration
   - Add fallback if seed script fails
   - Add more detailed logging
   - Return success/failure status

3. **Verify extraResources includes seed DB**
   - Check `package.json` build config includes `prisma/dev.db`
   - Verify it's copied correctly on first run

3. **Sync seed data between dev and prod**
   - Align `prisma/seed.ts` and `electron/seed.js` data structures
   - Ensure both create same default data

### Phase 3: Add "Restore Data" Feature (Medium Priority)
1. **Clarify what "restoring data" means**
   - Import from a backup file?
   - Sync from cloud?
   - Reset to defaults?

2. **Implement based on clarification**
   - Add backup/export feature
   - Add import/restore feature

### Phase 4: Verify Cross-Computer Installation (Medium Priority)
1. **Test the installer on a clean machine**
2. **Verify all extraResources are included**
3. **Check that `prisma db push` works without dev dependencies**

---

## Open Questions

1. **What does "restoring data" mean to you?**
   - [ ] Import from a backup file (JSON/SQL)
   - [ ] Reset database to fresh seed state
   - [ ] Sync from another device/cloud
   - [ ] Something else

2. **Should the terminal show empty state or error when DB is empty?**
   - Recommended: Empty state with "No categories yet" + button to go to admin to add them

3. **Do you want to test the installer on a clean VM before shipping?**

---

## Validation Steps

1. Build installer: `npm run electron:build:win`
2. Install on clean Windows machine (or VM)
3. Launch app → should show login screen
4. Login with `admin@cafeos.local` / `admin123`
5. Go to `/admin/terminal` → should load without error
6. Verify categories, tables, products are seeded
7. Place a test order → should work end-to-end

---

## Files to Modify

### High Priority
- `my-app/app/admin/terminal/page.tsx` - Add error handling, loading states, empty states
- `my-app/electron/main.js` - Improve `migrateDatabase()`, `seedDatabase()` error handling
- `my-app/electron/seed.js` - Sync with `prisma/seed.ts`, add error handling

### Medium Priority
- `my-app/prisma/seed.ts` - Sync with `electron/seed.js`
- `my-app/package.json` - Verify extraResources includes `prisma/dev.db`