# Data Model — Inventory & Purchasing Intelligence (014)

Phase 1 output. Mirrors the existing CaféOS domain on both surfaces (Room schema
on the tablet, Prisma schema on the web/PC). Existing rows remain valid; all
changes are additive except the semantics described below.

## Entities

### Ingredient (existing, extended)

Represents one stocked item whose stock is tracked in a single **base unit**.

| Attribute | Type | Notes |
|-----------|------|-------|
| id | PK | |
| name | string | |
| category | string | e.g. General |
| baseUnit | enum-ish string | `g` / `ml` / `pcs` — the unit every stock amount and trend is expressed in |
| currentStock | double | mutable only through append-only transactions |
| minStock | double | the adjustable **low-stock threshold** (single source of truth for all low flags) |
| costPerUnit | double | **latest purchase unit cost** (replaced on each purchase; Q3 decision) |
| **lastSupplierId** (NEW) | nullable FK → Supplier | latest supplier of this ingredient; set transactionally on purchase; null = never purchased |
| updatedAt | timestamp | |

### Supplier (existing, unchanged)

| Attribute | Notes |
|-----------|-------|
| id, name, contact/phone/email/address, notes | unchanged |
| status | ACTIVE / INACTIVE |

### IngredientTransaction (existing — now the full purchase/adjustment ledger)

Append-only; every stock movement is one row. `type` values used: `PURCHASE`,
`ADJUSTMENT`, `USAGE`, `OPENING`, and `VOID_PURCHASE` (an appended compensating
row that reverses a purchase — the original row is never modified).

| Attribute | Type | Notes |
|-----------|------|-------|
| id | PK | auto-increment; **row-id order = ledger order** (used for "previous purchase") |
| ingredientId | FK → Ingredient | |
| type | string | PURCHASE / ADJUSTMENT / USAGE / OPENING / VOID_PURCHASE |
| quantity | double | base-unit amount; positive for stock in, negative for stock out |
| referenceId | nullable int | NEW meaning: when `referenceType='supplier'` this is the Supplier id; batch id for bulk adjustments |
| referenceType | nullable string | `'supplier'` (purchase vendor) or `'batch'` (bulk adjustment) or null (order usage, opening) |
| notes | nullable string | free text: product/notes for purchases; batch reference for bulk |
| createdAt | timestamp | human-visible time; ordering for trends still uses id |

**Rules**: PURCHASE rows carry optional `referenceType='supplier'`. Trend and
latest-value queries ignore `VOID_PURCHASE` rows. A purchase row is never
updated or deleted.

### SupplierIngredientPrice (existing — price snapshot table)

Kept for any legacy/quick price display, but it is **not** the source of truth
for purchase history or trends in this feature; those are derived from
`IngredientTransaction` rows. (Documented to avoid two definitions of "latest
price".) If a supplier-ingredient snapshot is written alongside a purchase for
back-compat, it is updated in the same transaction as the purchase.

### Bulk adjustment batch (derived concept, no new table)

A bulk action creates one `ADJUSTMENT` row per ingredient whose
`referenceType='batch'` and `referenceId` = the batch's first row id (or a
generated batch token stored in `notes`). Display groups rows by batch token.

### Analytics inventory summary (derived, no new table)

Projection over Ingredient rows:
- healthy: `currentStock > minStock`
- low: `0 < currentStock <= minStock`
- out: `currentStock <= 0`
- stock value: `Σ (currentStock × costPerUnit)`

## Relationship map

```text
Supplier 1 ───< IngredientTransaction (PURCHASE via referenceType='supplier') >─── Ingredient 1
Supplier 1 ───< SupplierIngredientPrice >─── Ingredient 1
Ingredient.lastSupplierId ──────────────────→ Supplier (denormalized latest)
Ingredient 1 ───< IngredientTransaction (all types) ─── order consumption, purchases, adjustments, voids
```

## State transitions

- Purchase: draft (form) → `PURCHASE` row written; ingredient `currentStock += qty`;
  `costPerUnit = total/qty(base)`; `lastSupplierId = supplier` (when given).
  All inside one transaction.
- Void purchase: a **compensating row** is appended: `type = 'VOID_PURCHASE'`,
  `quantity = -qty`, `referenceType = 'void-of'`, `referenceId = <original row id>`.
  The original `PURCHASE` row is **never modified**. In the same transaction:
  stock subtracts back; if the voided row was the latest non-void purchase of that
  ingredient, `costPerUnit` and `lastSupplierId` revert to the previous non-void
  purchase (or null when none); an audit event is written. Voiding a purchase
  that is NOT the latest only reverses stock.
- Bulk adjustment: per row → new `ADJUSTMENT` row; stock changed; one transaction
  for the whole batch. Batch identity = the first `ADJUSTMENT` row's id, written
  into every row's `referenceId` with `referenceType = 'batch'`. No batch row may
  push an ingredient's stock below zero (validated before the transaction).

## Invariants

- Every purchase/void/bulk write happens in exactly one DB transaction
  (stock + ledger + cached latest supplier/cost can never disagree).
- A purchase row is never updated or deleted; voiding appends a compensation row.
- Trend/latest queries ignore VOID rows; row-id order defines "previous".
- `lastSupplierId` is derived-only-consistent: any recompute path must reproduce
  "latest non-void purchase's supplier" exactly, and deleting a supplier
  recomputes (or clears) it for every affected ingredient.
- The low/out rule is implemented once per platform and shared by ingredient
  page, alerts, and analytics: healthy = `currentStock > minStock`, low =
  `0 < currentStock <= minStock` (stock equal to the threshold is low), out =
  `currentStock <= 0`.
- Client-submitted unit costs are never accepted; unit cost = stored total ÷
  stored converted quantity.
- Manual stock corrections (bulk or single) never push stock below zero.
