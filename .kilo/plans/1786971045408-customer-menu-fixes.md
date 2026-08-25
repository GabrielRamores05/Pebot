# Plan: Fix Customer Menu Issues & Electron Menu Security

## Issues Summary

### 1. Loyalty Card Registration Not Working
**Root Cause:** No `loyaltySetting` records exist in the database. The seed scripts (both `electron/seed.js` and `prisma/seed.ts`) don't create loyalty settings. The register API (`/api/loyalty/register`) requires an enabled loyalty setting to attach the card to (line 54-56 in register route).

**Files to Fix:**
- `my-app/electron/seed.js` - Add loyalty setting creation
- `my-app/prisma/seed.ts` - Add loyalty setting creation

### 2. Table Selection Shows Wrong Tables
**Root Cause:** In `my-app/app/menu/page.tsx` (lines 1698-1706), the table scanner modal shows ALL tables with status labels. Customers should only see/select `AVAILABLE` tables (or tables they're already seated at). The cart page (line 623-624) correctly filters: `.filter((table) => table.status === 'AVAILABLE' || table.name === cartStore.tableNumber)`.

**Files to Fix:**
- `my-app/app/menu/page.tsx` - Filter tables in table scanner modal to only show available tables for selection

### 3. "Failed to Create Order" Error
**Likely Causes:**
- No loyalty settings configured (see issue #1)
- Invalid table ID being sent (see issue #2)
- Missing required fields in order payload

**Files to Fix:**
- Fix issues #1 and #2 first
- Add better error logging in `/api/orders` route to identify specific failure

### 4. Electron Menu Security - Remove CafeOS Menu
**Root Cause:** The CafeOS menu in `electron/main.js` (lines 308-320) allows navigation to `/admin`, `/kitchen`, `/admin/analytics`, `/admin/inventory`, `/admin/tables` without authentication. Users can access admin features without logging in.

**Files to Fix:**
- `my-app/electron/main.js` - Remove or restrict CafeOS menu items to authenticated users only

---

## Implementation Plan

### Phase 1: Fix Loyalty Settings (High Priority)
1. **Add default loyalty setting to seeds**
   - Create global loyalty setting (categoryId: null) with `enabled: true`
   - Settings: 10 coffees for free, FREE reward type, default card title/description

### Phase 2: Fix Table Selection (High Priority)
2. **Filter table scanner modal**
   - In `startTableScanner()` function, filter `availableTables` to only show `AVAILABLE` status tables
   - Keep current table (from QR) even if occupied

### Phase 3: Fix Order Creation (High Priority)
3. **Add better error handling/logging**
   - Log specific error details in `/api/orders` route
   - Validate tableId exists before creating order

### Phase 4: Electron Menu Security (High Priority)
4. **Remove CafeOS menu or add auth check**
   - Option A: Remove CafeOS menu entirely (simplest, recommended)
   - Option B: Keep but disable admin links until authenticated
   - The tray menu already has these options, so app menu is redundant

---

## Files to Modify

| File | Changes |
|------|---------|
| `my-app/electron/seed.js` | Add loyaltySetting creation |
| `my-app/prisma/seed.ts` | Add loyaltySetting creation |
| `my-app/app/menu/page.tsx` | Filter tables in `startTableScanner()` |
| `my-app/app/api/orders/route.ts` | Add validation/logging for tableId |
| `my-app/electron/main.js` | Remove CafeOS menu section |

---

## Validation Steps

1. **Test loyalty registration:**
   - Open `/menu` → Click loyalty card (💳) → Enter name → Register
   - Should succeed and show loyalty card with progress

2. **Test table selection:**
   - Open `/menu?table=T1` → Click table switcher (🔄) 
   - Should only show AVAILABLE tables (plus current table)
   - Select different table → Should navigate to new table

3. **Test order placement:**
   - Add items to cart → Go to `/cart` → Enter name → Place order
   - Should succeed with order confirmation

4. **Test electron menu:**
   - Run `npm run electron` 
   - Verify CafeOS menu is removed from app menu bar
   - Verify tray menu still works for navigation

---

## Open Questions

1. **CafeOS menu removal:** Remove entirely, or keep with disabled admin links? (Recommendation: Remove entirely - tray menu provides same functionality)
2. **Table filter:** Should customers see OCCUPIED tables they're already seated at? (Yes - keep current table in list even if occupied)
3. **Loyalty defaults:** Use 10 coffees for free, FREE item reward as defaults?