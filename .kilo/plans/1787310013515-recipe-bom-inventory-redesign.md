# Plan: Recipe/BOM Ingredient Inventory Redesign

## Status: PLANNING → READY FOR IMPLEMENTATION
## Owner: Poolside Laguna S 2.1 (implementation agent)

## Goal

Replace the current **dual stock model** (per-product `Inventory.quantity` + ingredient `Ingredient.currentStock`) with a single **Recipe/BOM model** where:

- `Ingredient.currentStock` is the **only** source of truth for stock.
- Each product defines a **recipe** (`ProductIngredient`) listing each ingredient's consumption per serving, marked **Required** or **Optional**.
- **Sellable Quantity** for a product = `floor(min over required ingredients of (currentStock / quantityPerProduct))`.
- Orders **consume ingredients** (decrement `currentStock`); sellable quantity is **calculated automatically** — never allocated/distributed upfront.
- The `Inventory` (per-product) table is **repurposed as a derived cache** of sellable quantity that the menu/terminal keep reading, so "Sold Out" reflects real ingredient availability.

This directly implements the user's 11-point spec (sections 1–11 of their request).

---

## Current-State Analysis (the bug)

The codebase already has ingredient deduction on orders (`app/api/orders/route.ts:212-239`) and restore on cancel (`app/api/orders/[id]/route.ts:106-134`), plus unit conversion in `lib/ingredient-utils.ts`. **But these are undermined by a conflicting per-product model:**

- `Inventory` model (`prisma/schema.prisma:283`) gives every product its own `quantity`/`lowStockThreshold`/`unit`.
- `/api/inventory` PATCH (`app/api/inventory/route.ts:63-79`) **overwrites** ingredient stock with `ingredient.currentStock = productQuantity × recipeQty` — this is the "equal distribution / auto-allocation" anti-pattern. It destroys the shared pool.
- Orders check **per-product** `inventory.quantity` for availability (`orders/route.ts:186-196`) and decrement **both** `inventory` and `ingredient` (`orders/route.ts:204-239`).
- Menu (`app/menu/page.tsx:499`) and terminal (`app/admin/terminal/page.tsx:1059`) decide "Sold Out" from `product.inventory.quantity === 0`.

**Net effect:** ingredient stock is treated as a derivative of product stock, not the other way around. The redesign inverts this.

---

## Architecture Decisions

- **D1 — Single source of truth:** `Ingredient.currentStock` is the only stock truth. Purchases, order usage, waste, and adjustments all write here.
- **D2 — Required vs Optional (spec §3):** Add `ProductIngredient.required Boolean @default(true)`. Only **required** ingredients gate sellable quantity. **Optional** ingredients are consumed on order **only if sufficient stock exists** (clamped, never negative) — they never block a sale.
- **D3 — Derived cache (spec §1+3):** `Inventory.quantity` is repurposed as a **derived, persisted** value = sellable quantity, computed by the availability engine and written after every stock change. Menu/terminal keep reading `product.inventory.quantity` with **no display-logic change**. `Inventory.lowStockThreshold` keeps its meaning ("warn when quantity ≤ threshold") — now quantity = sellable count. Manual `quantity` setting via `/api/inventory` PATCH is **disabled** for recipe products.
- **D4 — Out of stock (spec §9):** Sellable quantity = 0 → product is "Sold Out" (red). Reflected in customer menu + admin terminal.
- **D5 — Low stock (spec §10):** `0 < sellableQty ≤ capacityThreshold` → amber "Low stock". `sellableQty = 0` → red "Out of stock".
- **D6 — Recalculate on every change (spec §8):** Purchases, order create/cancel, waste, recipe edits all trigger a recompute of affected products' derived `Inventory.quantity` + emit `ingredients-update`/`inventory-update` socket events.
- **D7 — Recipe-less products:** A product with **no** required ingredients is treated as **always available** (sellable = unlimited). Its `Inventory.quantity` is **not overwritten** by the engine (legacy/manual value preserved). If finite stock is needed for such a product, model it as a 1-ingredient recipe (e.g. "Bottled Drink → 1× Bottled Drink pcs"). *(Known limitation — documented.)*
- **D8 — Order stock check:** Orders refuse when requested qty > sellable qty (raises `InsufficientStockError`), unless `overrideStock`. Override bypasses the check; required-ingredient decrement may then go negative (manager's explicit authorization) — matching existing override semantics. *(Future refinement: clamp required decrement on override.)*
- **D9 — Unit-aware purchase costing (spec §11):** Reuse existing `lib/ingredient-utils.ts` (`convertToBase`, `calcWeightedAverage`). Purchase records `unitCost = purchaseCost / qtyInBase`; selling price still comes from `Product.capitalCost` + `lib/pricing.ts` (no auto-sync of `capitalCost` — avoids circular dependency, per existing plan D7 at `1787294605861`).

---

## Data Flow (new)

```
SUPPLIER PURCHASE
   ↓  POST /api/ingredients/purchases
   ↓  currentStock += qtyInBase ; costPerUnit = weightedAvg
   ↓
INGREDIENTS (source of truth)
   ↓
RECIPES  (ProductIngredient: qty + required)
   ↓
AVAILABILITY ENGINE  →  derived Inventory.quantity (sellable)
                        + limiting ingredient per product
   ↓
CUSTOMER ORDER  →  decrement required (+optional-if-available) ingredients
                        → recompute affected Inventory.quantity
                        → emit ingredients-update / inventory-update
   ↓
MENU / TERMINAL  (read derived Inventory.quantity → Sold Out / Low / qty)
```

---

## Schema Changes

### 1. `prisma/schema.prisma` — `ProductIngredient` (lines 181-189)
Add a required/optional flag:

```prisma
model ProductIngredient {
  id           Int      @id @default(autoincrement())
  productId    Int
  ingredientId Int
  quantity     Float    // units consumed per 1 product (base units)
  required     Boolean  @default(true)  // NEW: false = optional add-on
  product      Product    @relation(fields: [productId], references: [id], onDelete: Cascade)
  ingredient   Ingredient @relation(fields: [ingredientId], references: [id], onDelete: Cascade)
  createdAt    DateTime   @default(now())
}
```

No new tables. `Inventory.quantity`/`lowStockThreshold` columns stay (semantics only change to "derived sellable / capacity threshold").

### 2. Generate + push
```
npx prisma generate
npx prisma db push     # adds `required` (default true) to existing ProductIngredient rows
```

---

## New Module: Availability Engine

Create `lib/availability.ts` (pure + DB-backed helpers). **No source edits elsewhere can proceed without it.**

```ts
// Pure, DB-free — trivially unit-testable
interface RecipeItem { quantity: number; required: boolean; currentStock: number; name: string; baseUnit: string; ingredientId: number }

export function calcSellableQuantity(recipe: RecipeItem[]): {
  sellable: number;          // floor-min servings
  limitingIngredientId: number | null;
  breakdown: { ingredientId: number; name: string; baseUnit: string; perProduct: number; available: number; servings: number }[];
}

export function calcStatus(sellable: number, capacityThreshold: number):
  'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'

// DB-backed: fetch a product's recipe + ingredient stock, compute, persist to Inventory (cache)
export async function recomputeProduct(tx, productId: number): Promise<InventoryRow>
export async function recomputeProducts(tx, productIds?: number[]): Promise<void>  // all if omitted
export async function calcProductionCapacity(tx): Promise<ProductionCapacityEntry[]>  // spec §7
```

- `servings = Math.floor(currentStock / quantityPerProduct)` per required ingredient; `sellable = min(...)`.
- Optional ingredients are **excluded** from the min but included in `breakdown`.
- For products with no required ingredients → `sellable = Infinity`; `Inventory.quantity` is **not overwritten** (D7).

---

## API Changes

### A. `app/api/ingredients/product/[productId]/route.ts` (lines 1-63)
- **GET**: include `required` on each `ProductIngredient` row; include `ingredient.currentStock` and `sellableContribution`.
- **PUT**: accept `required` per ingredient (current contract only sends `{ ingredientId, quantity }`). Update body to `{ ingredients: [{ ingredientId, quantity, required }] }`.

### B. `app/api/ingredients/[id]/adjust/route.ts` (verify exists — UI calls it)
Confirm it prevents negative stock and emits `ingredients-update`. If missing, create it (POST: `{ quantity(signed), reason, notes }`, transaction, `ADJUSTMENT` record, clamp to ≥ 0).

### C. `app/api/orders/route.ts` (rewrite stock logic — lines 146-261)
1. Remove per-product `inventory` fetch (line 116-117 still needs `products` for price); keep product fetch for price.
2. Stock check (replace lines 184-199): for each item, call `calcSellableQuantity` via the recipe+stock in the transaction. If `sellable < quantity` and `!overrideStock` → push to `unavailable` (with name, requested, available). Throw `InsufficientStockError` as before.
3. Remove the per-product `inventory.updateMany({ decrement })` block (lines 204-209) — **Inventory.quantity is derived now**.
4. Keep ingredient deduction (lines 212-239) — but **only decrement required ingredients unconditionally**; for optional ingredients, decrement `min(totalNeeded, currentStock)` (D2). Guard required decrement against `gte` only in non-override mode (the sellable check already guarantees sufficiency).
5. After deduction, call `recomputeProducts(tx, affectedProductIds)` to refresh derived `Inventory.quantity`.
6. Emit `inventory-update` + `ingredients-update` (already emits both at lines 281-282). Add affected productIds to `inventory-update` payload.

### D. `app/api/orders/[id]/route.ts` (cancel path — lines 99-134)
1. Remove per-product `inventory.updateMany({ increment })` restore (lines 100-105) — derived now.
2. Keep ingredient restore (lines 107-134); restore **required** ingredients by `item.quantity × pi.quantity`; for optional, restore the same amount that was actually consumed (track consumed? simplest: restore full `item.quantity × pi.quantity` — slight over-restore of optional is harmless since it only affects the optional pool). Use reverse `USAGE` transaction records.
3. `recomputeProducts(tx, affectedProductIds)` after restore.
4. Keep existing emit + loyalty restore.

### E. `app/api/inventory/route.ts` (remove the bug — lines 63-79)
- **DELETE** the "Auto-calculate ingredient stock based on product stock" block entirely. This is the root of the equal-distribution problem.
- PATCH accepts `lowStockThreshold` (capacity threshold) only. If `quantity` is sent for a **recipe product**, reject/ignore (it's derived). For a **recipe-less product**, accept `quantity` (manual override, D7).
- After any PATCH, `recomputeProducts` for affected products if recipes changed (none on threshold change).

### F. NEW: `app/api/ingredients/production-capacity/route.ts` (spec §7)
- **GET** `/api/ingredients/production-capacity` — returns array: `{ productId, productName, sellable, limitingIngredient, status, ingredients: [{name, perProduct, available, servings, required}] }` for **all** products (with recipes). Auth: `requirePermission('inventory')`.
- Used by inventory page "Production Capacity" section and admin products page availability panel.

### G. `app/api/products/route.ts` GET + `app/api/categories/route.ts` GET
- Products already include `inventory`. After D3, `inventory.quantity` = derived sellable. **No code change needed** — the value is now correct. (Verify `products` query still includes `inventory: true` — it does, line 8.)

### H. `app/api/ingredients/[id]/route.ts` PUT (lines 28-61)
- Already accepts `currentStock`. When `currentStock` changes → caller must trigger recompute. The inventory page calls this for manual ingredient edits; after save, emit `ingredients-update` and the frontend recompute happens via a new endpoint call (see I) or the frontend refetches production-capacity. **Add an emit of `ingredients-update`** after the PUT success (currently does not emit). Optionally trigger server-side `recomputeProducts` (needs prisma tx — PUT is not in a tx; add one wrapping the update + recompute).

### I. Recompute trigger endpoint (optional helper)
Add `POST /api/ingredients/availability/recompute` (auth: inventory) that runs `recomputeProducts` for all products — for manual/recovery use. No required call sites, but handy.

---

## Frontend Changes

### 1. `app/menu/page.tsx` (customer menu — spec §9)
- Line 499-503 `outOfStock`/`lowStock` already read `product.inventory.quantity` — **correct now** (it's derived sellable). No logic change.
- **Add** socket refresh: in the `useSocket` (line 1200), add `'ingredients-update': () => refreshCategories()` and `'inventory-update': () => refreshCategories()` so stock changes propagate instantly (currently only polls 30s + `product-update`).
- `maxQty` (line 503) = `inventory.quantity` (sellable) — already caps the cart (+ button disabled at max). Correct.
- Detail modal "Add to Order" disabled when `inventory.quantity === 0` (line 2065) — correct now.

### 2. `app/admin/terminal/page.tsx` (admin terminal — spec §9)
- `outOfStock` (line 1059) reads `inventory.quantity === 0` — correct now (derived).
- **Add** socket refresh for `ingredients-update`/`inventory-update` to refetch categories (so terminal reflects live ingredient changes), mirroring the menu. Currently terminal has no `useSocket` for these.

### 3. `app/admin/products/page.tsx` — Product modal redesign (spec §6)
- Ingredient section (lines 1877-1924): add a **Required / Optional** toggle per ingredient (checkbox → `required` field). Persist via the updated PUT (API change A).
- After `fetchProductIngredients`, load `required` state.
- Add an **"Inventory Availability"** panel in the modal (when editing a product with recipe): call `/api/ingredients/production-capacity` (filtered to this product) → show per-ingredient servings breakdown + **Current Sellable Quantity** + **Limiting Ingredient** (spec §6).
- On recipe save, emit `ingredients-update` (the modal's `saveProductIngredients` should call the production-capacity recompute or emit; currently emits nothing). Add `emitEvent`? Frontend can't emit socket from client easily — instead the PUT route (API A/B) persists and the client calls `fetchAll()`. Simplest: after save, refetch + the PUT route triggers recompute server-side.

### 4. `app/admin/inventory/page.tsx` — Production Capacity section (spec §7)
- "Products" tab: the `saveEdit` (line 198) currently PATCHes `/api/inventory { quantity }`. With D3, `quantity` is derived → **disable manual quantity input** for recipe products; replace the Products table quantity column with **read-only "Sellable Qty"** (derived) + show limiting ingredient.
- Keep `lowStockThreshold` editing (now = capacity threshold).
- **Add a "Production Capacity" view** (new tab or section) calling `/api/ingredients/production-capacity`: table of `Product | Can Make | Limiting Ingredient | Status`.
- `useSocket` already handles `ingredients-update`/`inventory-update` (lines 182-190) → refresh is in place.

---

## Migration / Data

1. `npx prisma generate && npx prisma db push` — adds `required` column (default `true`, backfills all existing recipe rows as required).
2. **Backfill derived `Inventory.quantity`** from current ingredient stock: run a one-off recompute (`POST /api/ingredients/availability/recompute`) or a migration script that, for each product with recipes, sets `inventory.quantity = sellableQty`. (Plan an ad-hoc node script using the new engine if endpoint isn't ready at migration time.)
3. **Verify demo data:** ensure at least Americano (Coffee Beans required, Sugar optional) and Latte (Coffee Beans + Milk required, Sugar optional) exist with recipes + ingredients in `dev.db`. The seed (`prisma/seed.ts`) creates **no** products/ingredients — add a seed step or confirm UI-created demo data. Without recipes, sellable quantity is meaningless and the new tests can't run.
4. Existing `Inventory.quantity` (the old manually-set / auto-derived values) is **overwritten** by the backfill recompute. Acceptable — it's now a cache.

---

## Tests (acceptance + unit)

### Rewrite `tests/acceptance/inventory-blocking.spec.ts`
- `setStock(page, productId, N)` helper → changed to `setSellable(page, productId, N)`: find the product's **required** ingredients, set each ingredient's `currentStock` to `N × perProductQty` via `PUT /api/ingredients/[id]` (so sellable = N). 
  - `stockOf` helper → read sellable via `/api/ingredients/production-capacity` or the product's `inventory.quantity`.
- Test products **must have recipes** for these to be meaningful.
- Update assertions: "refuses order that oversells" now driven by ingredient stock.

### Add new acceptance tests (map to spec §§)
- **§3 Required vs Optional:** Latte requires Milk; Milk = 0 → Latte sold out, Americano still available. Sugar optional → setting Sugar = 0 does NOT block Americano/Latte.
- **§7 Production Capacity:** `/api/ingredients/production-capacity` returns correct sellable + limiting ingredient per product.
- **§4 Order consumes ingredients:** placing an order reduces ingredient `currentStock` by exactly `qty × recipeQty`; derived sellable updates; menu reflects it within seconds (socket).
- **§8 Recalculation on every change:** purchase → sellable increases; order → sellable decreases; waste adjustment → sellable decreases; stock adjustment → sellable updates.
- **§9 Out-of-stock blocks customer menu:** sellable = 0 → "Sold Out", no Add button.
- **§10 Low stock threshold:** sellable between 1 and capacityThreshold → amber "Low".

### Unit tests for `lib/availability.ts`
Pure function tests for `calcSellableQuantity` (min across required, optional excluded, floor division, no-recipe = Infinity) and `calcStatus`.

---

## Validation Commands

```
npx prisma generate
npx prisma db push
npx tsc --noEmit          # must be zero errors (Next.js app at my-app)
npm run build             # must succeed
# Run acceptance + unit tests:
npx playwright test tests/acceptance/inventory-blocking.spec.ts
npx vitest run lib/availability.test.ts   # if vitest is configured; else node test
```

> Note: `tsc` and `prisma` must run from `my-app/`. Confirm the working-directory for validation commands during `/check`.

---

## Risks & Notes

- **R1 — Orders route is high-risk:** it currently decrements BOTH `inventory` and `ingredient`. Removing the `inventory` decrement and switching the stock check to ingredient-derived sellable is the most behavior-changing edit. Do it inside the existing `$transaction` so recompute is atomic with deduction.
- **R2 — Negative ingredient stock on override:** preserved-existing behavior (override bypasses check). Documented in D8; not fixed here.
- **R3 — Menu/terminal "Sold Out" depends on derived `inventory.quantity` being fresh.** If a recompute isn't triggered somewhere, the menu shows stale availability for up to 30s (polling). Mitigate: ensure every write path (purchase, order, cancel, adjust, recipe edit) calls `recomputeProducts` + emits socket events; add socket refresh to menu + terminal.
- **R4 — Optional-ingredient consumption semantics:** D2 consumes optional ingredients when available and skips when insufficient. Alternative (never consume optional) is simpler but diverges from "recipe is the standard build." Flag in code comments.
- **R5 — Recipe-less products (D7):** remain always-available. If the business later needs finite non-recipe stock, add a recipe entry. Do not re-enable the per-product manual stock setter as a truth source.
- **R6 — `Inventory` PATCH `quantity`:** disabling it for recipe products is a **breaking API change**. Audit any other caller of `PATCH /api/inventory` with `quantity`... (inventory page `saveEdit` is the only caller; it will be updated in step 4.)

---

## Task List (ordered)

1. Schema: add `required Boolean @default(true)` to `ProductIngredient`.
2. `npx prisma generate && npx prisma db push`.
3. Create `lib/availability.ts` (pure calc + DB-backed `recomputeProduct(s)`, `recomputeProducts`, `calcProductionCapacity`).
4. Create `app/api/ingredients/production-capacity/route.ts` (GET, auth: inventory).
5. Update `app/api/ingredients/product/[productId]/route.ts` — GET includes `required`+`ingredient.currentStock`; PUT accepts `required`.
6. Update `app/api/ingredients/[id]/route.ts` PUT — after save, run `recomputeProducts` (wrap in tx) + emit `ingredients-update`.
7. Update `app/api/ingredients/[id]/adjust/route.ts` (create if missing) — transaction, ADJUSTMENT record, clamp ≥0, recompute + emit.
8. Rewrite `app/api/orders/route.ts` stock logic (D3/D4/D8/D2) inside `$transaction`; remove per-product inventory decrement; recompute after deduction.
9. Rewrite `app/api/orders/[id]/route.ts` cancel path — remove per-product inventory restore; keep+improve ingredient restore; recompute after restore.
10. Update `app/api/inventory/route.ts` — **delete** the auto-derivation block (the bug); PATCH accepts threshold only for recipe products.
11. Menu (`app/menu/page.tsx`) — add `ingredients-update`/`inventory-update` socket handlers → `refreshCategories`.
12. Terminal (`app/admin/terminal/page.tsx`) — add socket refresh for ingredient/inventory updates; verify Sold-Out uses derived quantity (no logic change needed).
13. Products page (`app/admin/products/page.tsx`) — Required/Optional toggle in recipe section; Availability panel (sellable + limiting ingredient).
14. Inventory page (`app/admin/inventory/page.tsx`) — disable manual quantity for recipe products; add Production Capacity view.
15. Backfill: recompute all derived `Inventory.quantity` from current ingredient stock (one-off script or endpoint).
16. Rewrite `tests/acceptance/inventory-blocking.spec.ts` + add new acceptance tests (§3, §4, §7, §8, §9, §10) + unit tests for `lib/availability.ts`.
17. Validate: `tsc --noEmit`, `npm run build`, test suite.
