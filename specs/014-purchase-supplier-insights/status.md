# Spec 014 — Implementation Status

**Feature**: Purchase & Supplier Insights (bulk stock corrections, auto unit-cost
purchases, latest supplier, purchase-history trends, supplier page, low-stock
analytics, void + re-enter).
**Last updated**: 2026-09-04 — **COMPLETE**. All 32 tasks marked `[X]` in
`tasks.md`.

## Final gate state (authoritative, run in this session)

- **my-app (web)**: `npm run lint` 0 errors (249 pre-existing warnings) ·
  `npx tsc --noEmit` clean · `npm run test:unit` **464 passed** (33 files;
  baseline 427 + 37 added).
- **cafeos-tablet (Android)**: `.\gradlew.bat :app:lintDebug :app:testDebugUnitTest
  :app:assembleDebug` **BUILD SUCCESSFUL** · **81 unit tests / 0 failures** (12 suites).

## What is implemented

Completion round covered the remaining tasks on **both** surfaces (tablet = the
Android app, web = `my-app`), keeping every prior green gate green. The earlier
session had already shipped foundation + US1–US5 tablet halves + most tablet UI;
this session finished the web parity halves and the cross-cutting ledger work.

- **T010 US1 web**: purchase form restricts the unit selector to the ingredient's
  base-unit family and previews auto unit cost (`total ÷ converted base qty`)
  plus per-purchase-unit price; server rejects quantity ≤ 0, negative totals, and
  unconvertible unit/base pairs; supplierless purchase clears the latest-supplier
  cache (tablet parity). QS-1 math unit-tested.
- **T014 US2 web**: ingredient purchase history with supplier, entered/base
  quantity, total, unit cost, and ₱/% change vs the previous priced purchase
  (pure `priceChangeByPurchaseId`; row-id order); first-purchase → no comparison,
  equal price → ₱0.00/0%. History modal added to the admin inventory page.
- **T017 US3 tablet**: **verified satisfied** (no code change). US3 is reached
  via Inventory → Suppliers tab → supplier card → detail dialog: every ingredient
  that supplier has purchase rows for, with latest price, ₱/% vs that supplier's
  previous price, and an empty state ("No purchases from this supplier yet.").
- **T018 US3 web**: per-supplier ingredient rows derive from supplier-linked
  PURCHASE ledger rows (`aggregateSupplierPurchasePrices`), showing latest price
  + ₱/% change vs the previous price from the same supplier; "no purchases yet"
  empty note. `GET /api/suppliers/insights`.
- **T021 US4 web**: `bulkAdjustIngredients` — one transaction, whole-batch
  zero-floor validation (any below-zero row → nothing written), ADJUSTMENT rows
  with `referenceType='batch'` sharing a batch token (first row id) in
  `referenceId`, stock-only. Thin `POST /api/ingredients/bulk-adjust` + Bulk
  Adjust modal in the inventory page.
- **T023 US5 web**: analytics inventory summary (healthy/low/out counts + total
  stock value) reusing the single `getStockStatus`/`calcInventoryValue` rule
  (boundary: stock == threshold → LOW); `GET /api/analytics/inventory` + summary
  card in the analytics Overview, live-refreshed on stock/threshold events
  (ingredient PUT now emits events on `minStock` change).
- **T025 export/import (both)**: tablet export already serialized the fields
  (`@Serializable`, `encodeDefaults`) — fixed the **import** side with pure
  `SnapshotImportRules`: suppliers import parents-first, unknown-supplier
  purchases keep their row but have the link cleared (never dropped),
  dangling `lastSupplierId` cache cleared, legacy/void-of/batch rows pass through.
  Web snapshot now carries `ingredientTransactions`; import upserts suppliers
  first, maps `lastSupplierId`→`supplierId`, imports VOID rows idempotently, and
  clears unknown-supplier links. Round-trip + tablet-ingest tests on both sides.
- **T026/T027 void + re-enter (web UI)**: the void route already existed; the
  admin history UI now has a Void action (with confirm) that calls it. Void
  appends a compensating `VOID_PURCHASE` row (`referenceType='void-of'`,
  referenceId = original id; original never modified), reverses stock in the same
  transaction, and rolls back cost/latest supplier only when the voided row was
  the latest non-void purchase. Already-voided rows are shown as such and
  re-void from the UI is disabled.
- **T028 void-reversal tests (both)**: pure decision logic extracted — tablet
  `data/VoidReversal.kt`, web `computeVoidRollback` in `lib/ingredient-utils.ts` —
  shared by the transactional write and its tests. Cases: void the only purchase
  (cost/supplier → none), void the latest (roll back to previous non-void), void
  an older one (stock-only), VOID rows never count as latest/previous, unknown
  id. Tablet 7 tests; web cases added.
- **T029 bridge payload (both)**: tablet `PcBridgeClient` gained pure
  `ingredientPayload` (incl. `lastSupplierId`), `transactionPayload`
  (`referenceType`/`referenceId`, VOID rows flow with their type) and
  `inventorySnapshotPayload` builders keyed to `contracts/bridge-schema.md`; web
  snapshot/ingest (`modules/tablet`) carries the same fields. (No live tablet→PC
  transport caller existed on the tablet to rewire; the payload layer is
  contract-complete and unit-tested.)
- **T030 audit (both)**: purchases, void, and bulk writes emit audit events
  inside their write transactions with aligned tokens
  `PURCHASE_RECORD` / `VOID_PURCHASE` / `BULK_ADJUST` — tablet via `logAuditEvent`
  (entityType `ingredient_transaction`, entityId = ledger row id; bulk uses
  entityType `ingredient`/id 0 + batch token), web via the existing audit log
  (resource `ingredient_transaction`). No read-path auditing.
- **T032 supplier-delete safety (review fix, both)**: fixed a latent bug found in
  review — after deleting a supplier, the latest-supplier recompute could re-point
  an affected ingredient at the just-deleted id (violating the web FK / leaving a
  dangling cache on the tablet). Both apps now recompute **excluding** the deleted
  supplier's own purchase rows so each ingredient falls back to its prior supplier
  (or none). Web `deleteSupplier`; tablet `deleteSupplier` + new DAO
  `latestSupplierIdForIngredientExcluding`.

## Notes / known manual-only steps

- Quickstart **QS-1..QS-6** describe on-device/on-browser click-through runs. The
  scenario math and edge cases are covered by the added unit tests on both
  platforms (purchase, history trend, bulk zero-floor, void rollback, threshold
  boundary, shared supplier/ingredient math for parity). Live UI walk-throughs on
  a physical tablet + the running web app were not executable in this
  build/verify session and remain the owner's manual acceptance step; no parity
  number mismatch is expected because both apps share the same pure math.
- **Batch identity** is stored per an explicit `data-model.md` choice: the web
  bulk writes the shared batch token (first row id) into `referenceId`; the
  tablet (pre-existing T019) writes a text token into `notes`. Both are sanctioned
  by `data-model.md` and internally consistent; cross-import treats rows as-is.
- Audit token names were aligned across the two platforms (see T030).
