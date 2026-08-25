# Plan: Ingredient Inventory Management Module

## Status: PLANNING

## Goal

Add a complete Ingredient Inventory Management module that tracks ingredient purchases, automatically calculates unit cost via weighted average, records every stock movement as a transaction, supports waste/adjustments, and provides a dashboard — all integrated with the existing POS, product, and order systems.

## What Already Exists (No Change Needed)

| Component | Location | Status |
|---|---|---|
| `Ingredient` model: `currentStock`, `minStock`, `costPerUnit`, `baseUnit`, `supplierId` | `prisma/schema.prisma:122` | Keep; add `category` + `purchaseUnit` fields |
| `Supplier` model: `notes`, `status` (ACTIVE/INACTIVE) | `prisma/schema.prisma:137` | Already complete |
| `ProductIngredient` link with per-product quantity in base units | `prisma/schema.prisma:155` | Already complete |
| Ingredient deduction at order creation | `app/api/orders/route.ts:212-226` | Keep; add transaction record |
| Ingredient restore on order cancellation | `app/api/orders/[id]/route.ts:106-120` | Keep; add transaction record |
| `/api/ingredients/calculate` (purchase planning) | `app/api/ingredients/calculate/route.ts` | Already complete |
| CRUD: `/api/ingredients`, `/api/ingredients/[id]` | `app/api/ingredients/` | Keep; extend with new fields |
| Product-ingredient linking | `app/api/ingredients/product/[productId]/route.ts` | Already complete |
| Auth: `requirePermission(req, 'inventory')`, JWT `userId` | `lib/auth.ts:91-102` | Reuse for all new endpoints |
| Admin inventory page (Products/Ingredients/Suppliers tabs) | `app/admin/inventory/page.tsx` | Extend ingredient tab with new features |
| Admin products page (ingredient assign modal) | `app/admin/products/page.tsx` | Keep; auto-feed capitalCost if feasible |
| Peso formatting pattern: `₱${amount.toFixed(2)}` | Across all pages | Standardize via shared helper |

**Key finding:** The existing system already handles ingredient deduction, cancellation restore, and recipe costing. No new deduction logic is needed — only transaction audit records around the existing deduction/restore points.

## Decisions (Technical — Resolved Without Escalation)

### D1. Deduction timing — at order creation
**Chose:** Keep existing creation-time deduction. Confirmed by user.
**Because:** User selected "at order placement" — matches existing `app/api/orders/route.ts:212-226` behavior that already prevents overselling. Adding creation-time transaction records without changing the flow.
**Reversible:** Partially — moving to payment-confirmation-based deduction later would require modifying `orders/route.ts` and `orders/[id]/route.ts`, but the transaction layer would remain valid.

### D2. Weighted average costing
**Chose:** Weighted average for `costPerUnit`.
**Because:** Explicitly specified in the user's requirements (section 9). Formula: `newCostPerUnit = (oldTotalCost + purchaseCost) / (oldTotalStock + purchaseQtyInBaseUnits)` where `oldTotalCost = oldCostPerUnit * oldCurrentStock`.

### D3. Unit conversion — base units stored, purchase units converted at input
**Chose:** Store all stock in `baseUnit` (g, ml, pcs). Add `purchaseUnit` field on Ingredient to record how the user buys it (kg, L, etc.). Convert at purchase recording time.
**Because:** The existing `Ingredient` model already stores `baseUnit` + `currentStock` in base units, and `ProductIngredient.quantity` is already in base units. This is the right place to convert.
**Conversion pairs:** kg→g (×1000), L→ml (×1000), ton→kg (×1000), oz→g (×28.3495), lb→lb→g (×453.592). All count units (pcs, bottle, pack, box, sachet) are stored 1:1 as base.

### D4. Money precision
**Chose:** Follow existing pattern — `Float` in SQLite/Prisma, `Math.round(x * 100) / 100` for display.
**Because:** The entire existing schema uses `Float` (e.g. `costPerUnit Float`, `totalAmount Float`, `amount Float`). The Edgepoint `standard/data.md` recommends centavos-as-integer, but the existing codebase consistently uses Float. Introducing a new convention now would be inconsistent and require a massive refactor.
**Risk:** Floating-point drift. Mitigation: round all monetary displays to 2 decimals, round division results with `Math.round(x * 100) / 100`.

### D5. Soft delete for new models
**Chose:** Add `deletedAt` soft-delete field to `IngredientTransaction` (new model only).
**Because:** Edgepoint `standard/data.md` requires reversible deletes. The existing `Ingredient` model is hard-deleted, but that's pre-existing. For the new `IngredientTransaction` model, soft-delete protects audit history.
**Reversible:** Yes.

### D6. Auth on new endpoints
**Chose:** Use `requirePermission(req, 'inventory')` — same pattern as `app/api/suppliers/route.ts:8`.
**Because:** Ingredient management is already gated by the `inventory` permission. Admins bypass; staff need the flag. Consistent with existing suppliers/inventory APIs.

### D7. Product capitalCost sync
**Chose:** Do NOT auto-overwrite `Product.capitalCost` from ingredient costs in v1.
**Because:** `capitalCost` feeds the BIR-compliant pricing engine (`lib/pricing.ts`). The existing `/api/ingredients/calculate` endpoint already computes total ingredient cost per order. Auto-setting `capitalCost` from ingredient costs would create a circular dependency if the pricing engine feeds back into ingredient costs. The ingredient cost-of-goods is available via the existing calculate endpoint and new transactions — product costing integration is a future step.
**Reversible:** Yes — a future migration can sync `capitalCost` from the latest ingredient costs.

## Schema Changes

### Add fields to existing `Ingredient` model

```prisma
model Ingredient {
  id            Int                @id @default(autoincrement())
  name          String
  category      String             @default("General") // Coffee, Dairy, Syrup, Powder, Food, Packaging, etc.
  baseUnit      String             // g, ml, pcs (internal storage)
  purchaseUnit  String             @default("g") // Unit used when purchasing (kg, L, pcs, etc.)
  currentStock  Float              @default(0)    // in base units
  minStock      Float              @default(0)    // in base units
  costPerUnit   Float              @default(0)    // per base unit
  supplierId    Int?
  supplier      Supplier?          @relation(fields: [supplierId], references: [id])
  transactions  IngredientTransaction[]
  createdAt     DateTime           @default(now())
  updatedAt     DateTime           @updatedAt
  products      ProductIngredient[]
}
```

### New model: `IngredientTransaction`

```prisma
model IngredientTransaction {
  id            Int      @id @default(autoincrement())
  ingredientId  Int
  ingredient    Ingredient @relation(fields: [ingredientId], references: [id], onDelete: Cascade)
  type          String   @default("PURCHASE") // PURCHASE | USAGE | ADJUSTMENT | OPENING
  quantity      Float    // signed: positive for additions, negative for usage/adjustments; in BASE units
  purchaseCost  Float?   // total pesos paid (PURCHASE only)
  unitCost      Float?   // per-base-unit cost recorded at transaction time (PURCHASE only)
  referenceId   Int?     // order ID for USAGE transactions; null otherwise
  referenceType String?  // "order" | null
  notes         String?  // e.g. "Waste: spoiled milk" for ADJUSTMENT
  userId        Int?     // who made the change (for manual adjustments)
  createdAt     DateTime @default(now())

  @@index([ingredientId])
  @@index([createdAt])
  @@index([type])
  @@index([referenceId, referenceType])
}
```

### No changes needed to existing models
- `ProductIngredient` already links products to ingredients with base-unit quantities — recipe costing works.
- `Order` / `OrderItem` already exist — deduction hooks into order creation.
- `Supplier` already has `notes` and `status`.
- `Inventory` (product-level stock) is separate and untouched.

## New Utility: `lib/ingredient-utils.ts`

Create a shared utility file (per `standard/structure.md` "No `utils.ts`" — place next to feature):

```ts
// Unit conversion to base units
export const UNIT_CONVERSIONS: Record<string, { toBase: number }> = {
  kg: { toBase: 1000 },     // → g
  g:  { toBase: 1 },
  ton: { toBase: 1000000 }, // → g
  L:  { toBase: 1000 },     // → ml
  ml: { toBase: 1 },
  oz: { toBase: 28.3495 },  // → g
  lb: { toBase: 453.592 },  // → g
  // count units: 1:1
};

export function convertToBase(quantity: number, fromUnit: string): number {
  const factor = UNIT_CONVERSIONS[fromUnit];
  if (!factor) return quantity; // assume already base or unknown unit, pass through
  return Math.round(quantity * factor.toBase * 1000) / 1000; // avoid floating drift
}

export function parseUnitCostDisplay(costPerBaseUnit: number, baseUnit: string): string {
  const rate = baseUnit === 'g' ? costPerBaseUnit * 1000 :
               baseUnit === 'ml' ? costPerBaseUnit * 1000 :
               costPerBaseUnit;
  const displayUnit = baseUnit === 'g' ? 'kg' :
                      baseUnit === 'ml' ? 'L' : baseUnit;
  return `₱${rate.toFixed(2)}/${displayUnit}`;
}

export function formatPeso(amount: number): string {
  return `₱${Math.round(amount * 100) / 100}`;
}

export function calcWeightedAverage(
  oldCostPerUnit: number,
  oldStock: number,
  purchaseCost: number,
  purchaseQtyInBase: number,
): number {
  const totalCost = oldCostPerUnit * oldStock + purchaseCost;
  const totalQty = oldStock + purchaseQtyInBase;
  if (totalQty <= 0) return 0;
  return Math.round((totalCost / totalQty) * 100) / 100;
}
```

## New API Endpoints

### `app/api/ingredients/purchases/route.ts` (NEW)
- **POST** `/api/ingredients/purchases` — Record a purchase
- Auth: `requirePermission(req, 'inventory')`
- Body: `{ ingredientId, quantity, purchaseUnit, purchaseCost, supplierId, purchaseDate, notes }`
- Steps (all in one transaction):
  1. Fetch ingredient + current stock + current costPerUnit
  2. Convert `quantity` from `purchaseUnit` to `baseUnit` via `convertToBase()`
  3. Validate: quantity > 0, cost > 0
  4. Calculate `unitCost = purchaseCost / quantityInBaseUnits`
  5. Calculate new weighted-average `costPerUnit` via `calcWeightedAverage()`
  6. Create `IngredientTransaction` (type=PURCHASE, quantity=converted, purchaseCost, unitCost)
  7. Update `Ingredient.currentStock` (increment by converted qty) and `costPerUnit` (weighted avg)
  8. Emit `ingredients-update` event
  9. Return: `{ ingredient, transaction, pricePerUnit: unitCost, newStock, newWeightedCost }`

### `app/api/ingredients/transactions/route.ts` (NEW)
- **GET** `/api/ingredients/transactions?ingredientId=X&limit=50` — List transaction history for an ingredient
- Auth: `requirePermission(req, 'inventory')`
- Returns transactions with: date, type, quantity (with original unit context), cost, unit cost, notes, user

### `app/api/ingredients/dashboard/route.ts` (NEW)
- **GET** `/api/ingredients/dashboard` — Dashboard stats
- Auth: `requirePermission(req, 'inventory')`
- Returns: `{ totalIngredients, inStock, lowStock, outOfStock, totalInventoryValue, recentPurchases[], recentUsage[], highestCostIngredients[] }`

### `app/api/ingredients/[id]/adjust/route.ts` (NEW)
- **POST** `/api/ingredients/[id]/adjust` — Record waste/spoilage/manual adjustment
- Auth: `requirePermission(req, 'inventory')`
- Body: `{ quantity (signed), reason, notes }`
- Steps:
  1. Fetch ingredient + current stock
  2. Validate: new stock would be >= 0 (prevent negative)
  3. Create `IngredientTransaction` (type=ADJUSTMENT, quantity=signed)
  4. Update `Ingredient.currentStock` (increment by signed qty)
  5. Emit `ingredients-update` event
  6. Return updated ingredient

### Update existing: `app/api/orders/route.ts`
- At the existing ingredient deduction block (lines 212-226), add transaction creation:
  - For each `pi` (product ingredient), create an `IngredientTransaction` with type=USAGE, quantity = `-(item.quantity * pi.quantity)`, referenceId=order.id, referenceType="order"
  - These go inside the existing `$transaction` — if the order fails, transactions roll back too

### Update existing: `app/api/orders/[id]/route.ts`
- At the existing ingredient restore block (lines 106-120), add transaction creation:
  - For each restored ingredient, create `IngredientTransaction` with type=USAGE (reverse), quantity = `+(restored amount)`, referenceId=order.id, referenceType="order", notes="Order cancelled: stock restored"
  - These go inside the existing `$transaction`

### Update existing: `app/api/ingredients/[id]/route.ts`
- PUT: accept and save `category` and `purchaseUnit` fields (currently only handles name, baseUnit, currentStock, minStock, costPerUnit, supplierId)

## Admin UI Changes

### Extend `app/admin/inventory/page.tsx` — Ingredients tab
The existing Ingredients tab (inventory page) is read-only-ish — it shows name, stock, threshold, supplier, and an Edit button. Extend it to:

1. **Add "Add Purchase" button** — opens a modal with:
   - Ingredient selector (dropdown of all ingredients)
   - Quantity input (number)
   - Purchase unit selector (dropdown, defaults to ingredient's purchaseUnit)
   - Purchase cost input (₱)
   - Auto-calculated "Price Per Unit" display (non-editable, computed client-side as cost/quantity)
   - Supplier selector (dropdown)
   - Purchase date (defaults to today)
   - Notes textarea
   - Save button → POST to `/api/ingredients/purchases`

2. **Add "Adjust Stock" button** — opens a modal for waste/spoilage:
   - Ingredient selector
   - Quantity (signed — negative for waste, positive for correction)
   - Reason dropdown (Waste, Spoilage, Damaged, Other)
   - Notes textarea
   - Save → POST to `/api/ingredients/[id]/adjust`

3. **Add columns to ingredient table**: Category, Purchase Unit, Unit Cost, Inventory Value, Status
   - Inventory Value = `currentStock × costPerUnit` (formatted as pesos)
   - Status: "In Stock" / "Low Stock" / "Out of Stock" with color badges (green/red)

4. **Add dashboard stats** at the top of the Ingredients tab (matching the Products tab pattern):
   - Total Ingredients
   - In Stock
   - Low Stock
   - Out of Stock
   - Total Inventory Value

5. **Add "Purchase History" sub-tab** or expandable section per ingredient showing `IngredientTransaction` records

### Add to admin nav (`app/admin/layout.tsx`)
The existing inventory nav item (`/admin/inventory`) already covers ingredients. No new nav item needed — the enhancements go on the existing inventory page's Ingredients tab. (Alternatively, if the user prefers a dedicated `/admin/ingredients` page, that's a separate file. Recommended: extend existing to avoid fragmentation.)

## Migration Steps

1. **Edit `prisma/schema.prisma`** — add `category`, `purchaseUnit` fields to Ingredient; add `IngredientTransaction` model with relation to Ingredient
2. **Run `npx prisma generate`** — regenerate client
3. **Run `npx prisma db push`** — apply schema to SQLite (backfill `category`='General', `purchaseUnit`='g' for existing rows)
4. **Verify**: `npx tsc --noEmit` — zero type errors
5. **Build**: `npm run build` — succeeds
6. **No data migration needed** for existing ingredients — defaults handle it

## Tasks (Ordered)

- [ ] 1. Schema: Add `category` (String, default "General") and `purchaseUnit` (String, default "g") to `Ingredient` model
- [ ] 2. Schema: Add `IngredientTransaction` model with fields + relation to `Ingredient`
- [ ] 3. Run `npx prisma generate && npx prisma db push` to apply schema
- [ ] 4. Create `lib/ingredient-utils.ts` — unit conversion, weighted average, peso formatting, display helpers
- [ ] 5. Create `app/api/ingredients/purchases/route.ts` — POST purchase: validate, convert, calc unit cost, weighted avg, create transaction, update stock
- [ ] 6. Create `app/api/ingredients/transactions/route.ts` — GET purchase/usage/adjustment history
- [ ] 7. Create `app/api/ingredients/dashboard/route.ts` — GET dashboard stats
- [ ] 8. Create `app/api/ingredients/[id]/adjust/route.ts` — POST waste/adjustment with transaction record
- [ ] 9. Update `app/api/ingredients/[id]/route.ts` — PUT accepts `category` and `purchaseUnit`
- [ ] 10. Update `app/api/orders/route.ts` — add USAGE transaction records inside existing deduction block (lines 212-226)
- [ ] 11. Update `app/api/orders/[id]/route.ts` — add reverse USAGE transaction records inside existing restore block (lines 106-120)
- [ ] 12. Update `app/admin/inventory/page.tsx` — extend Ingredients tab: add category/unitCost/inventoryValue/status columns, Add Purchase modal, Adjust Stock modal, dashboard stats, purchase history
- [ ] 13. Validate: `npx tsc --noEmit` passes
- [ ] 14. Validate: `npm run build` succeeds
- [ ] 15. Manual test: Add purchase for Coffee Beans (2kg @ ₱1,200) → verify unit cost ₱600/kg, stock +2kg, transaction recorded
- [ ] 16. Manual test: Add second purchase (5kg @ ₱2,750) → verify weighted avg ₱564.29/kg, total stock 7kg
- [ ] 17. Manual test: Place order → verify USAGE transaction created with correct quantity
- [ ] 18. Manual test: Cancel order → verify reverse transaction created, stock restored
- [ ] 19. Manual test: Waste adjustment → verify ADJUSTMENT transaction, stock decreases, no negative
- [ ] 20. Manual test: Insufficient stock on adjustment prevented

## Data Flow Summary

```
Supplier Purchase
  ↓
[POST /api/ingredients/purchases]
  ↓
Convert purchaseUnit → baseUnit
  ↓
Calculate unitCost = purchaseCost / convertedQty
  ↓
Recalculate costPerUnit = weightedAverage(old, purchase)
  ↓
Ingredient.currentStock += convertedQty
IngredientTransaction(PURCHASE) created
  ↓
[GET /api/ingredients/dashboard] reads all data
[GET /api/ingredients/transactions] lists history

Customer Sale
  ↓
[POST /api/orders] (existing)
  ↓
Ingredient.currentStock -= (quantity × pi.quantity) [existing]
IngredientTransaction(USAGE) created [NEW]
  ↓
[PATCH /api/orders/[id]] cancel (existing)
  ↓
Ingredient.currentStock += restored [existing]
IngredientTransaction(USAGE, reverse) created [NEW]
```

## Validation Plan

| Test | Method | Expected Result |
|---|---|---|
| Schema generates | `npx prisma generate` | No errors |
| Types check | `npx tsc --noEmit` | Zero errors |
| Build succeeds | `npm run build` | No errors |
| Purchase unit cost calc | Manual: ₱1,200 ÷ 2kg → 1,820g base | unitCost = ₱0.60/g, display ₱600/kg |
| Weighted average | Two purchases: 2kg@₱600 + 5kg@₱550 | costPerUnit = ₱564.29/kg |
| Duplicate purchase history | Second purchase recorded as new row | Two transactions, original prices preserved |
| Order deduction + transaction | Place order with 18g recipe | Stock -18g, USAGE transaction recorded |
| Cancel restores stock + transaction | Cancel the order | Stock +18g, reverse USAGE transaction recorded |
| Waste adjustment | Adjust -50g | Stock decreases, ADJUSTMENT transaction created |
| Prevent negative stock | Adjust more than available | 400 error, no transaction created |
| Division by zero | Quantity = 0 | 400 error, no calculation |
| Dashboard stats | After above tests | Total=count, inStock/lowStock/outOfStock correct, totalValue correct |

## Out of Scope (Future Work)

- **Auto-sync `Product.capitalCost`** from ingredient costs — noted in D7. The existing BIR pricing engine manages `capitalCost` as an input field; auto-overwriting it would create a circular dependency with the pricing system. The `/api/ingredients/calculate` endpoint already provides ingredient-level cost data for purchase planning.
- **Real-time low-stock alerts** — beyond the existing WebSocket `low-stock-alert` event pattern. Could add ingredient-level emission.
- **Bulk purchase import** (CSV) — single-purchase workflow first, bulk import later.
- **Purchase order generation** — the `calculate` endpoint already produces a purchase request; automating PO creation from low-stock + deficit is a future enhancement.
