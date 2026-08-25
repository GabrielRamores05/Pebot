# Plan: Fix VAT/Bug Data Issues & Add Order History

## Context

The user installed a CaféOS Electron+Next.js+Prisma app. The previous build (23:33) fixed
the subscription seeding error and removed sample data from the seed script, but several
**code-level bugs** remain, and one **new feature** (Order History) is requested.

Key environment facts:
- Electron 40.7.0 + Next.js 14.2.0 + Prisma 5.22.0 + SQLite
- DB at `%APPDATA%\cafeos\cafeos.db`; `DATABASE_URL=file:<that path>` set by `main.js`
- Build: `npm run build` (Next) → `electron-builder` → `win-unpacked/` → NSIS `.exe`
- Source root: `D:\Buggy The Coffee Project\05_Buggy_v3_i_41026\cafe\my-app`

---

## Issues & Root Causes

### 1. VAT rate reverts to 12% after edit+refresh
**Code bug** — JavaScript `||` treats `0` as falsy.

| Location | Line | Buggy code |
|---|---|---|
| `app/admin/settings/page.tsx:118` | load | `setVatRate(d.vatRate \|\| 12)` |
| `app/admin/settings/page.tsx:141` | save | `vatRate: Number(vatRate) \|\| 12` |
| `app/api/settings/business/route.ts:84` | PUT | `vatRate: Number(vatRate) \|\| settings.vatRate` |
| `app/api/settings/business/route.ts:98` | create | `vatRate: Number(vatRate) \|\| 12` |

**Fix**: Replace `||` with null-safe checks so `0` is preserved:
- UI load: `setVatRate(d.vatRate ?? 12)`
- UI save + API: `vatRate: vatRate != null ? Number(vatRate) : default`

**Related**: `app/admin/page.tsx` invoice hardcodes 12% VAT math (lines 955–960, 1055–1064).
Replace with dynamic `businessSettings.vatRate`.

### 2. Cannot delete loyalty data (3 records)
The DELETE endpoint **exists** at `app/api/loyalty/cards/[customerName]/route.ts:269-293`
and correctly deletes vouchers then cards. The "3 records" and inability to delete are
from the **old installer's bundled `dev.db`** which had sample data. The current `seed.js`
(192 lines) and `dev.db` (204,800 bytes, empty) are clean.

**Action**: Improve error diagnostics only — replace generic `"Failed"` with `String(e)`
so failures surface the real Prisma error. No logic change needed.

**Note for user**: Existing users must uninstall + reinstall to get the clean `dev.db`.
The app only copies `dev.db` → `cafeos.db` on first run (when `cafeos.db` doesn't exist).

### 3. Sample data still visible in Customer & Voucher pages
Same root cause as #2 — old installer's `dev.db` had sample data. Current `dev.db` is clean.

The `seed-1000-orders.js` at project root is a standalone dev utility — **not packaged**
(not in `build.files`), does not run at startup. No action needed beyond user reinstall.

### 4. Customer QR should use IP address, not localhost
**Code bug** — `app/admin/layout.tsx:101-106` uses `window.location.origin`:
```ts
const localIp = window.location.origin;  // → "http://localhost:3000"
```
QR codes at lines 626, 205, 247, 650, 671, 726 all embed `localIp`.

The table-QR API (`app/api/tables/qr/route.ts:7-24`) already implements `getLocalIP()`
correctly but is not reusable from the browser.

**Fix**:
1. Create `app/api/system/ip/route.ts` — server-side `getLocalIP()` + returns
   `{ origin: "http://<LAN-IP>:3000" }` (port from `process.env.PORT || 3000`).
2. In `app/admin/layout.tsx`, replace the `localIp` `useMemo` with a `useState` +
   `useEffect` that fetches `/api/system/ip`. Fall back to `window.location.origin`
   on error.

### 5. Restore Data writes to wrong file
**Code bug** — `app/api/restore/route.ts:53-54` hardcodes:
```ts
const dbDir = join(process.cwd(), 'prisma');
const dbPath = join(dbDir, 'dev.db');
```
But the real DB is at `%APPDATA%\cafeos\cafeos.db` (via `DATABASE_URL`).

The backup API (`app/api/backup/route.ts:7-15`) has the correct `getDatabasePath()`
function but it's local and not shared.

**Fix**:
1. Create `lib/db-path.ts` exporting `getDatabasePath()` (move from backup route).
2. Update `app/api/backup/route.ts` to import from `lib/db-path.ts`.
3. Update `app/api/restore/route.ts` to import and use the same function.

### 6. Add Order History feature
**API**: `app/api/orders/route.ts:43-45` filters to last 3 days + `take: 200`.
Add `all=true` query param: when set, skip date filter and increase `take` to 10 000.

**Icon**: Add `IconHistory` to `lib/assets.tsx` (clock/history spiral SVG).

**Nav**: Add to `navItems` in `app/admin/layout.tsx`:
```ts
{ href: '/admin/order-history', Icon: IconHistory, label: 'Order History',
  roles: ['ADMIN', 'STAFF'], permission: 'analytics' }
```

**Page**: Create `app/admin/order-history/page.tsx`:
- Fetch `/api/orders?all=true` on mount (no auto-refresh — it's history, not live).
- Table view: order #, customer, date/time, total, status, payment method, items count.
- Filters: date range, status dropdown, customer-name search.
- Click row → slide-over panel with full order details (items, table, payment proof, notes).
- "View Invoice" button opens a modal — reuse the invoice layout from
  `app/admin/page.tsx:872-1091` but use dynamic `businessSettings.vatRate`
  instead of hardcoded 12%. Include Print + Thermal Print buttons.

---

## Implementation Order

| Step | File(s) | Change |
|---|---|---|
| 1 | `app/api/orders/route.ts` | Add `all=true` param to GET handler |
| 2 | `lib/assets.tsx` | Add `IconHistory` component |
| 3 | `app/admin/layout.tsx` | Add Order History nav item; fix `localIp` to fetch from API |
| 4 | `app/api/system/ip/route.ts` | **New file** — return server LAN IP |
| 5 | `app/admin/settings/page.tsx` | Fix VAT `||` → null-safe on lines 118, 141 |
| 6 | `app/api/settings/business/route.ts` | Fix VAT `||` → null-safe on lines 84, 98 |
| 7 | `app/admin/page.tsx` | Fix hardcoded 12% VAT in invoice (lines 955–960, 1055–1064) |
| 8 | `app/api/loyalty/cards/[customerName]/route.ts` | Improve DELETE error message (line 291) |
| 9 | `lib/db-path.ts` | **New file** — extract `getDatabasePath()` |
| 10 | `app/api/backup/route.ts` | Import `getDatabasePath` from `lib/db-path.ts` |
| 11 | `app/api/restore/route.ts` | Import & use `getDatabasePath()` instead of `join(process.cwd(),...)` |
| 12 | `app/admin/order-history/page.tsx` | **New file** — full Order History page with invoice |

### Build & Package (after all source edits)
1. `cd my-app && npm run build` (Next.js production build)
2. Copy updated files to `dist-electron/win-unpacked/resources/app/`:
   - `app/`, `electron/`, `lib/`, `next.config.js`, `package.json`, `prisma/`
3. `npx electron-builder --win --publish never --prepackaged ../dist-electron/win-unpacked`
4. Test the resulting NSIS installer on a clean machine (or delete `%APPDATA%\cafeos\cafeos.db` first)

### Validation Checklist
- [ ] VAT rate of `0%` saves and persists after refresh
- [ ] VAT rate of `12%` still saves and persists
- [ ] Customer QR code shows LAN IP (not localhost)
- [ ] Backup downloads a valid ZIP containing `dev.db`
- [ ] Restore accepts the backup ZIP and replaces the correct DB file
- [ ] Order History nav item appears in sidebar
- [ ] Order History page lists all historical orders (all dates)
- [ ] Order History invoice uses dynamic VAT rate from settings
- [ ] Loyalty card deletion returns descriptive error on failure
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run build` succeeds
- [ ] Electron packaging + NSIS build succeeds

## Risks / Notes

- **Existing user data**: Users with an existing `cafeos.db` (old installer) will retain
  old sample data. They must uninstall/reinstall. No in-app data-reset is planned here.
- **Invoice VAT math**: Currently `subtotal = total / 1.12` and `vat = total - subtotal`.
  When VAT rate is `0`, subtotal = total and VAT = 0. The fix should use the dynamic rate:
  `subtotal = vatRate === 0 ? total : total / (1 + vatRate/100)`,
  `vat = total - subtotal`.
- **Orders API `take` limit**: Raising from 200 to 10 000 is fine for SQLite but could be
  slow with 100k+ orders. Pagination can be added later if needed.
- **Restore file handle**: The restore endpoint calls `prisma.$disconnect()` before
  swapping the file. In rare cases, another concurrent request could reopen the connection
  mid-restore. Acceptable for a single-user desktop app.
- **Loyalty delete**: No logic change — error message improvement only. The delete itself
  works; the "3 records" issue is from old sample data, resolved by reinstall.
