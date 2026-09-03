# Spec 014 — Implementation Status

**Feature**: Purchase & Supplier Insights (bulk stock corrections, auto unit-cost
purchases, latest supplier, purchase-history trends, supplier page, low-stock
analytics, void + re-enter).
**Last updated**: 2026-09-04 — round cap (60/60) reached; continuation handoff below.
**Commits**: ccdf813, d5742e0, 7494afc, 0b74a47, 956b20b, 63aecfa, 4ebd938, 0d8a348, 0b78e7e (+ final gate commit).

## What is implemented and gated green (21/32 tasks marked [X])

Tablet (`cafeos-tablet`) and web (`my-app`) both keep gates green (Android
lintDebug/testDebugUnitTest/assembleDebug; web lint 0 errors/tsc/test:unit 427).

- **Foundation**: `Ingredient.lastSupplierId` (Room v20 metadata-only migration);
  `IngredientTransaction.purchaseUnit/purchaseCost/unitCost` columns on the
  tablet (mirrors web). Web reuses `Ingredient.supplierId` as latest-supplier.
- **US1 purchase**: unit-aware purchase entry with auto unit cost — tablet
  `PurchaseUnits` conversion (kg/g, L/ml, pcs) + dialog with unit chips and
  auto per-base/per-purchase-unit preview; transactional write (`commitPurchase`)
  updates stock + latest cost (replaces) + supplier link in one transaction;
  web purchase write aligned to latest-cost-replaces via thin route → repository.
- **US2**: ingredient cards show latest supplier + History dialog (supplier,
  entered/base quantity, total, unit cost, ₱/% change vs previous, row-id
  order); pure `PriceTrends` (tablet) and `calcPriceChange` (web) with tests on
  both platforms.
- **US3**: tablet supplier detail dialog (per-supplier ingredient list with
  latest price + ₱/% change); web supplier aggregation page T018 pending.
- **US4**: tablet bulk adjust (one transaction, zero-floor, batch token);
  web bulk T021 pending.
- **US5**: tablet Analytics Inventory Health panel (healthy/low/out counts +
  stock value) via shared `StockSummaryRule` + tests; web summary T023 pending.
- **Void + re-enter (FR-009, additive)**: tablet UI (admin-passcode gated) +
  `voidPurchase` appending VOID_PURCHASE compensation rows (original untouched,
  latest-only rollback); web repository + `POST /api/ingredients/purchases/:id/void`
  (admin UI trigger pending).
- **Supplier-delete safety (T032)**: both apps recompute latest supplier from
  remaining history on supplier delete.

## Remaining work (tasks not marked [X]) — next session continuation

Run `/speckit-implement` from a new session ("continue spec 014 from status.md"),
or continue task IDs directly in `specs/014-purchase-supplier-insights/tasks.md`:

1. **T010** — web admin inventory purchase form polish: unit selector already
   present; confirm latest-cost label/flow fully aligned.
2. **T014** — web latest-supplier + per-ingredient history/trend UI (repository
   trend queries exist in spirit; wire into admin inventory ingredient view using
   `calcPriceChange`).
3. **T018** — web supplier page (aggregate per-supplier ingredient rows with
   latest price + change; reuse `referenceType='supplier'` transactions).
4. **T021** — web bulk adjust (single-transaction repository fn + admin UI,
   mirror tablet zero-floor/batch token).
5. **T023** — web Analytics inventory summary (healthy/low/out + stock value via
   `getStockStatus`/`calcInventoryValue`, counts across `Ingredient`).
6. **T027 (UI)** — wire the void action into web admin inventory history UI
   (call the new void route; admin confirm).
7. **T028** — void-reversal unit tests on both platforms (pure decision helper +
   cases incl. voiding only/latest/older purchases).
8. **T025** — confirm export/import carries `lastSupplierId` + purchase-detail +
   VOID rows end-to-end on BOTH platforms (tablet export serializes entity
   fields; add web import/export coverage + verify tablet import mapping).
9. **T029** — tablet↔PC bridge payload fields per
   `contracts/bridge-schema.md` (PcBridge/SocketSync/ingest supplier + void rows).
10. **T030** — audit events for purchase/void/bulk on both platforms (tablet
    void writes AUDIT via `logAuditEvent`; web void/bulk audit via `lib/audit-log`).
11. **T031** — final full gates + run `quickstart.md` QS-1..QS-6 on both apps
    (device/web), fix parity mismatches, close this file.

Note: `feature.json` points at this feature; `.dsh/skills` provides the full
speckit chain (`/speckit-implement`, etc.) for the continuation session.
