# Fix: Ingredient quantity not saving in Menu Management Options page

## Problem

On the **Menu Management → Options** tab (`OptionGroupManager.tsx`), when a user enters a
quantity in an ingredient delta input and attempts to save, the value appears to be lost
("refreshes") and "doesn't save at all."

## Root Cause

Three compounding issues in `app/admin/OptionGroupManager.tsx` and its API endpoint.

### 1. GET endpoint doesn't return `ingredients` (primary bug)

`GET /api/products/[id]/option-groups` (`app/api/products/[id]/option-groups/route.ts:31`)
uses:

```js
select: { id: true, name: true, priceDelta: true, groupId: true },
```

This **excludes** the `ingredients` relation. As a result, every option object returned lacks
`ingredients`. In `GroupDetail` (OptionGroupManager.tsx:490–491):

```js
const existing = opt.ingredients?.find((d) => d.ingredientId === ing.id);
const currentDelta = existing?.deltaQty ?? 0;
```

`existing` is always `undefined`, so `currentDelta` is always `0`. Any time the data is re-fetched
(e.g. parent `useSocket` event fires `fetchAll()`, React strict-mode remount, or the user toggles
the group open/closed), the inputs revert to `0`. This is the "refreshes" + "doesn't save"
symptom: the value *is* written to the DB by `saveDelta`, but the GET response never echoes it
back, so it appears unsaved.

### 2. `saveOption` lacks error handling and data refresh

`saveOption` (OptionGroupManager.tsx:196–207) has no `try/catch`. If the PUT request throws
(network error), the rejection is unhandled. It also does **not** call `refreshProductOptions`
after saving, so the UI stays stale.

### 3. `saveDelta` does not update or re-fetch `productOptions` after save

`saveDelta` (OptionGroupManager.tsx:380–406) writes to the API but never updates the local
`productOptions` state or the draft. The old `productOptions` (without ingredients) persists.
When the component re-renders for any reason, the fallback `currentDelta` (0) overwrites the
draft if the draft was cleared.

## Affected Files

| File | Change |
|---|---|
| `app/api/products/[id]/option-groups/route.ts` | Include `ingredients` in the SELECT |
| `app/admin/OptionGroupManager.tsx` | Fix `saveOption`, `saveDelta`, and button types |

## Implementation Steps

### Step 1 — Fix GET endpoint to return ingredient deltas

File: `app/api/products/[id]/option-groups/route.ts`, lines 31–35.

Replace `select` with `include` so each option includes its ingredient deltas:

```js
const allOptions = await prisma.productOption.findMany({
  where: { productId, available: true },
  orderBy: { sortOrder: 'asc' },
  include: {
    ingredients: {
      select: { ingredientId: true, deltaQty: true },
    },
  },
});
```

The response mapping at line 48 already strips `groupId` via destructuring; `ingredients`
will pass through as a nested array. `GroupDetail` only reads `d.ingredientId` and
`d.deltaQty`, so no interface change is needed.

### Step 2 — Add `type="button"` to all buttons in `OptionGroupManager.tsx`

Every `<button>` in `OptionGroupManager.tsx` lacks `type="button"`. In HTML, bare `<button>`
defaults to `type="submit"`, which can trigger a page reload if a wrapping form exists or if
browser heuristics kick in. Add `type="button"` to:

- Line 119: **Create group** button
- Line 162: **Toggle attach** (parent-level, `toggleAttach`)
- Line 177: **Add option** (`+ Add` button)
- Line 473: **Save option** button (inside `GroupDetail`)
- Line 479: **Delete option** (`Del`) button (inside `GroupDetail`)
- Line 226–248: **Group attachment** buttons (inside `GroupDetail`'s product list)
- Line 557–564: **+ Add** button (inside `GroupDetail`)
- Line 589–597: **Group settings** buttons (inside `GroupDetail`)

### Step 3 — Fix `saveOption` to accept `productId`, add error handling, refresh data

File: `app/admin/OptionGroupManager.tsx`, lines 196–207.

Update the function signature to accept `productId` so it can call `refreshProductOptions`:

```js
async function saveOption(productId: number, optId: number) {
  const patch = drafts[`opt-${optId}`] ?? {};
  try {
    const res = await fetch(`/api/product-options/${optId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(err.error || 'Failed to save option');
      return;
    }
    // Clear the draft so the UI shows the server value after refresh
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[`opt-${optId}`];
      return next;
    });
    refreshProductOptions(productId);
  } catch (e) {
    console.error('Failed to save option:', e);
    alert('Failed to save option — check the console for details');
  }
}
```

**BUT** `saveOption` is defined in `OptionGroupManager` (outer scope), while `refreshProductOptions`
and `setDrafts` are also in `OptionGroupManager` scope. Wait — `drafts` and `setDrafts` ARE in
`OptionGroupManager` scope (line 57). And `refreshProductOptions` is in `GroupDetail` scope (line 370).

Since `saveOption` is called from `GroupDetail`'s JSX, the cleanest approach is to update the
button's `onClick` handler to call `refreshProductOptions` after `saveOption`:

```jsx
// In GroupDetail's option Save button (line 473-478):
<button
  type="button"
  onClick={async () => {
    await saveOption(opt.id);
    refreshProductOptions(p.id);
    // Clear the name/price drafts for this option
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[`opt-${opt.id}`];
      return next;
    });
  }}
  className="px-2 py-1.5 rounded-lg bg-black text-white text-xs font-medium hover:bg-gray-800"
>
  Save
</button>
```

Add `try/catch` inside `saveOption` itself (for network errors).

### Step 4 — Fix `saveDelta` to refresh data after save and accept `productId`

File: `app/admin/OptionGroupManager.tsx`, lines 380–406.

Add `productId` parameter so we can call `refreshProductOptions` after saving. After a
successful POST, call `refreshProductOptions(productId)` to pull the updated ingredient deltas
from the server (which now includes the just-saved value thanks to Step 1).

Also clear the delta draft so the input shows the server-confirmed value:

```js
async function saveDelta(productId: number, optId: number, ingredientId: number) {
  const saveKey = `${optId}:${ingredientId}`;
  const val = parseFloat(deltaDrafts[`opt-${optId}`]?.[ingredientId] ?? '0') || 0;
  setDeltaSaveStates((prev) => ({ ...prev, [saveKey]: 'saving' }));
  try {
    const res = await fetch(`/api/product-options/${optId}/ingredients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ingredientId, deltaQty: val }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save ingredient quantity');
    }
    setDeltaSaveStates((prev) => ({ ...prev, [saveKey]: 'saved' }));
    // Clear the draft so the input falls back to the server value (now correct)
    setDeltaDrafts((prev) => {
      const key = `opt-${optId}`;
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key][ingredientId];
      if (Object.keys(next[key]).length === 0) delete next[key];
      return next;
    });
    // Re-fetch to show the server-confirmed value
    refreshProductOptions(productId);
    window.setTimeout(() => {
      setDeltaSaveStates((prev) => {
        const next = { ...prev };
        delete next[saveKey];
        return next;
      });
    }, 1800);
  } catch (error) {
    setDeltaSaveStates((prev) => ({ ...prev, [saveKey]: 'error' }));
    alert(error instanceof Error ? error.message : 'Failed to save ingredient quantity');
  }
}
```

### Step 5 — Update JSX call sites in `GroupDetail`

**Ingredient delta input (line 495–503):**

```jsx
<input
  type="number"
  step="0.1"
  value={deltaVal(opt.id, ing.id, currentDelta)}
  onChange={(e) => setDeltaVal(opt.id, ing.id, e.target.value)}
  onBlur={() => saveDelta(p.id, opt.id, ing.id)}  // Add p.id, type="button" not needed for input
  className="w-16 rounded border border-slate-200 px-1.5 py-1 text-xs text-center"
  placeholder={`+${ing.baseUnit}`}
/>
```

**Option Save button (line 473–478):** Add `type="button"` and call `refreshProductOptions`.

**Option Delete button (line 479–484):** Add `type="button"`.

**All other buttons:** Add `type="button"`.

## Validation

1. Start the dev server: `npm run dev`
2. Navigate to `/admin/products` → **Options** tab
3. Expand an option group, add a product, create an option
4. Enter an ingredient quantity delta (e.g., `3.5`)
5. Click outside the input (blur) or click another field
6. Verify:
   - The input shows "Saved" briefly
   - The value persists after any UI re-render (e.g., switching between groups and back)
   - The value is correct in the database (check via `npx prisma studio` or the API)
7. Edit the option name/price and click **Save**
   - Verify the updated name/price is shown
   - No page reload occurs
   - No unhandled errors in the console

## Risks

- **API response shape change**: Adding `ingredients` to the GET response is additive; existing
  consumers (the customer-facing order page) only read `name`, `priceDelta`, and `id` from
  options, so they are unaffected.
- **Stale drafts**: After clearing drafts post-save, the input falls back to `currentDelta`.
  This is now correct because the GET endpoint returns saved values.
