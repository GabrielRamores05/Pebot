# Plan: Ingredient Inventory Module + Loyalty/Consultant Fixes

## Status
- **Inspected**: Full codebase analysis complete

## Existing Findings (no changes needed)
- Product reviews in `/app/menu/page.tsx` already has "Write a Review" button, 1-5 star picker, review API, display below description — **already works**
- Order creation already deducts ingredient stock (orders/route.ts:212-226) and cancellation restores it (orders/[id]/route.ts:106-120) — **already works**
- Prisma `Ingredient` model exists with `name`, `baseUnit`, `currentStock`, `minStock`, `costPerUnit`, `supplierId`
- `ProductIngredient` join table exists linking products to ingredients with `quantity`
- `Ingredients/calculate` API exists for computing recipe costs

## Bugs Found

### BUG-1: Loyalty registration button missing (`app/loyalty/page.tsx`)
The loyalty page has a search form but **no Register button**. When a customer enters their name and no card is found, there's no way to create a new card. Need to add a "Register as New Member" button that POSTs to `/api/loyalty/register`.

### BUG-2: `user.id` instead of `user.userId` in conversations/[id] route (`app/api/consultant/conversations/[id]/route.ts`)
Lines 21, 62, 100 use `user.id` but `JWTPayload` from `@/lib/auth` has `userId`, not `id`. All three must change to `user.userId`. This breaks conversation loading from the server.

## New Features

### FEATURE-1: Ingredient Inventory Module
**Schema additions needed:**
1. `IngredientTransaction` model — tracks every stock movement (PURCHASE, USAGE, WASTE, ADJUSTMENT)
2. `category` field on `Ingredient` (for Coffee, Dairy, Syrup, Powder, Food, Packaging, etc.)
3. `purchaseUnit` and `purchaseQuantity` fields — record the original purchase unit (e.g., "kg") independently from `baseUnit` (e.g., "g")

**Unit conversion table** (constants, not DB):
- kg → g (×1000)
- L → ml (×1000)

**API endpoints:**
1. `POST /api/ingredients/purchases` — Record a purchase:
   - Fields: ingredientId, quantity, purchaseUnit (e.g., "kg"), purchaseCost, supplierId, purchaseDate, notes
   - Auto-calculates `pricePerUnit = purchaseCost / quantity`
   - Converts purchaseUnit → baseUnit (e.g., 2 kg → 2000 g)
   - Adds converted quantity to `Ingredient.currentStock`
   - Creates an `IngredientTransaction` record
   - Recalculates `costPerUnit` using weighted average: `totalCost / totalQuantity`
2. `GET /api/ingredients/purchases?ingredientId=X` — List purchase history
3. `POST /api/ingredients/transactions/adjust` — Record waste/spoilage/adjustment:
   - Fields: ingredientId, quantity, type (WASTE|ADJUSTMENT), notes
   - Deducts from `currentStock`
   - Creates `IngredientTransaction` record
4. `GET /api/ingredients/[id]` — Include `transactions`, `purchases`, `category` in response

**Frontend `/admin/ingredients` page additions:**
1. "Add Purchase" workflow form (ingredient, quantity, purchase unit, cost, supplier, date)
2. Live "Price per unit" display (auto-calculated, read-only)
3. Purchase history table below the ingredient list
4. Waste/adjustment modal for manual corrections
5. Status indicators: In Stock / Low Stock / Out of Stock

### FEATURE-2: Consultant full business context
Update `GET /api/consultant/chat` to include suppliers and expenses alongside existing products/ingredients/orders/loyalty/staff (when `aiFolderAccess` is enabled).

### FEATURE-3: Consultant document export
Add `POST /api/consultant/conversations/[id]/export` — generates a markdown/text doc of the conversation that the user can download.

## Implementation Order
1. Fix BUG-1 (loyalty register button)
2. Fix BUG-2 (`user.id` → `user.userId`)
3. Schema migration for `IngredientTransaction` + `Ingredient.category`
4. Purchase history API endpoints
5. Consultants chat context: add suppliers/expenses
6. Consultant conversation export API
7. Admin ingredients page: purchase form, history, waste adjustment
8. Type-check + build + NSIS rebuild

## Validation
1. `tsc --noExit` — zero errors
2. `prisma db push` — migration succeeds
3. `next build` — succeeds (with env var fix)
4. Manual testing: loyalty register, conversation load/save, ingredient purchase calc, waste adjustment
