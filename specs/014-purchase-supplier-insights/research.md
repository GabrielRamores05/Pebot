# Research Notes â€” Inventory & Purchasing Intelligence (014)

Phase 0 output for `specs/014-purchase-supplier-insights`. Format per feature:
`Decision` / `Rationale` / `Alternatives considered`. No web research was needed â€”
all decisions are grounded in the existing codebase (CafÃ©OS offline-first domain)
and the locked scope decisions from the spec.

## R1: Where a purchase and its supplier live

**Decision**: The existing `IngredientTransaction` rows of `type = 'PURCHASE'` are the single source of truth for purchases. Each purchase row links its supplier through the existing `referenceType = 'supplier'` / `referenceId = <supplierId>` columns (already added in the tablet migration 17â†’18 and mirrored for web). No second "purchase" table.

**Rationale**: Purchase history, per-ingredient detail, and per-supplier aggregations are all projections over the same append-only rows. Reusing `IngredientTransaction` means zero new money tables, keeps the ledger append-only by construction, and makes exports/imports/bridge payloads (which already carry `ingredientTransactions`) carry supplier linkage almost for free.

**Alternatives considered**: a dedicated `Purchase` table with supplier FK â€” cleaner SQL joins but duplicates the money/stock ledger and forces migration of existing purchase rows on both platforms; `SupplierIngredientPrice` used as the purchase record â€” that table is a price snapshot per supplier/ingredient, not a dated purchase with quantity, so it cannot serve as history.

## R2: Ingredient "latest supplier" and latest cost display

**Decision**: Add a nullable `lastSupplierId` column to `Ingredient` (Room v20 / Prisma mirror). It is set inside the same transaction as the purchase. `costPerUnit` already holds the latest unit cost and continues to be replaced on each purchase (locked decision: latest purchase price).

**Rationale**: Ingredient lists show latest supplier + cost for every row; a denormalized cached column gives one indexed read instead of a correlated "latest purchase" subquery per row, which matters when the list grows to hundreds of ingredients with thousands of purchase rows. Written transactionally it can never disagree with the ledger.

**Alternatives considered**: pure derived query (no schema change, but per-row subqueries or a grouping window per list render); `SupplierIngredientPrice.updatedAt` as a proxy for "latest" (breaks when the same supplier is used twice or a different supplier wins). The column is small, nullable (never purchased yet â†’ null, UI shows "No supplier yet"), and trivially mirrored on the web Prisma schema.

## R3: Price-change math (per ingredient and per supplier)

**Decision**: "Previous" for an ingredient = the prior PURCHASE row for the same ingredient ordered by row id (auto-increment, strictly chronological per ledger writes). "Previous" for a supplier page = the prior PURCHASE row for the same ingredient AND supplier. Change = `latest.unitCost âˆ’ previous.unitCost` displayed in â‚± and `%` relative to previous (0.00 shown when equal; omitted for first purchase).

**Rationale**: Row-id ordering is stable even when two purchases share a millisecond timestamp; id auto-increment is monotonic in Room/Prisma. Same math on both platforms yields identical numbers.

**Alternatives considered**: ordering by `createdAt` (tie hazards); ordering by insertion time only (id) â€” chosen; computing change as ratio to latest instead of previous â€” rejected (user asked "increase from before").

## R4: Purchase unit conversion

**Decision**: A small, explicit conversion table maps purchase units onto the ingredient's base unit: `1 kg = 1000 g`, `1 L = 1000 ml`, and `pcs = pcs`; the ingredient base unit remains one of g/ml/pcs. When the chosen purchase unit cannot convert into the base unit, the form rejects the entry with the supported-unit message before any write.

**Rationale**: The user enters what they physically bought ("5 kg") and the total â‚±; stock is stored in base units (grams etc.), so conversion is required and must be explicit, testable, and rejectable. No third-party units library is needed for a cafÃ©'s unit set.

**Alternatives considered**: auto-detect unit from a free-text field (error-prone); store purchase in its own unit and convert only on display (complicates every stock query and trend comparison); allowing arbitrary conversion ratios configurable by the user (out of scope â€” YAGNI until a cafÃ© actually needs it).

## R5: Void + re-enter

**Decision**: Purchases are not editable/deletable. Voiding appends a **compensating row** (`VOID_PURCHASE`, negative quantity, `referenceType='void-of'` â†’ original row id); the original purchase row is never modified, preserving the append-only rule literally. One transaction reverses the stock effect and â€” only when the voided row is the latest non-void purchase of that ingredient â€” reverts `costPerUnit` and `lastSupplierId` to the previous non-void purchase (or null); an audit event is written. The corrected purchase is then entered fresh.

**Rationale**: Satisfies the locked Q3 decision and the constitution's append-only money rule without an in-place record mutation (the original VOID-by-rewrite design conflicted with "records are never modified"). Latest-only rollback keeps the current cost/latest-supplier truthful when an old purchase is voided.

**Alternatives considered**: physical delete (violates constitution); direct UPDATE (same violation); rewriting the original row's type to a VOID marker (rejected post-analysis: mutates an append-only record); a negative compensating row with a `void-of` reference â€” chosen.

## R6: Bulk adjust = stock corrections only

**Decision**: One bulk screen (ingredient rows with current stock + target/delta inputs and a per-row reason note) supports increase and decrease. Saving runs one transaction writing an `ADJUSTMENT` (increase) / `ADJUSTMENT`-with-negative-quantity (decrease) row per ingredient, referencing the batch (`notes`/batch id). No supplier, no cost, no unit cost change (locked Q1 decision). Resulting low-stock flags appear immediately from the shared threshold logic. Batch identity = a shared batch token in every row's `notes`. Manual corrections may not push stock below zero (validated pre-transaction).

**Rationale**: Matches the locked decision, keeps bulk out of the money ledger, and can reuse the existing adjust-stock DAO path in a loop inside one transaction. A zero floor keeps inventory counts meaningful; the transaction guard prevents partial batches.

## R7: Analytics reflection of low-stock thresholds

**Decision**: The analytics inventory summary shows three counts â€” healthy / low (stock â‰¤ threshold, stock > 0) / out (stock â‰¤ 0) â€” plus total stock value (Î£ currentStock Ã— costPerUnit) and per-ingredient low/out flags computed from the same threshold rule used by the ingredient page and alerts (locked Q2 decision: no restock guidance).

**Rationale**: One threshold rule in one domain service, consumed by every surface, guarantees the "change it once, reflected everywhere" acceptance criterion and keeps analytics free of procurement suggestions for v1. The rule is explicit at the boundary (stock equal to the threshold is LOW) and unit-tested on both platforms so the ingredient page, alerts, and analytics can never disagree.

**Alternatives considered**: restock suggestions with supplier/latest price (deferred by Q2 decision); duplicating the low-stock rule inside analytics (rejected â€” drift risk, violates the consistency criterion).

## R8: Parity across the two apps

**Decision**: The tablet and the web app implement the identical domain operations and calculations; the export/import JSON and the tabletâ†”PC bridge contract carry the new supplier linkage (`referenceType='supplier'`, `referenceId`) and the `Ingredient.lastSupplierId` field so the PC ledger can replay the same state. `quickstart.md` includes a cross-app parity scenario.

**Rationale**: The constitution and spec require one ledger with no silent divergence; both surfaces are staff/admin UIs, so feature scope is identical by the owner's earlier decision (both apps).

