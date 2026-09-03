# Implementation Plan: Inventory & Purchasing Intelligence

**Branch**: `014-purchase-supplier-insights` | **Date**: 2026-09-04 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/014-purchase-supplier-insights/spec.md`

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Summary

Give both the Android tablet app (`cafeos-tablet`) and the Windows café app (`my-app`) the same purchasing toolchain: purchases are recorded with a real-world unit + total peso amount and auto-computed unit cost; each ingredient shows its latest supplier; purchase history rows open into full details with ₱/% price change vs the previous purchase of that ingredient; supplier pages list every ingredient they supplied with latest price and change vs that supplier's previous price; bulk stock corrections update several ingredients in one action (adjustments only, no supplier/cost); and low-stock thresholds drive one consistent low/high state across the ingredient page, alerts, and an analytics low-stock + stock-value summary. Mistakes are corrected by an audited void + re-enter flow, never by editing the ledger.

Technical approach (from [research.md](research.md)): reuse the existing purchase transaction rows as the single source of truth, link each purchase to its supplier through the existing `referenceType`/`referenceId` columns (`supplier`), cache the latest supplier id on the ingredient for cheap list reads, derive trends by ordering purchase rows per ingredient, and add no second purchase table. Analytics low-stock counts/stock value aggregate from the same current-stock and threshold fields already displayed elsewhere.

## Technical Context

**Language/Version**: Kotlin 2.x (Android/Compose, Room) in `cafeos-tablet`; TypeScript/Next.js 14 + Prisma in `my-app`.

**Primary Dependencies**: Room + SQLite (tablet), Prisma + SQLite (web). Existing UI stacks: Jetpack Compose screens, Next.js admin pages. No new runtime dependencies required (unit conversion is a small local mapping; trends are SQL/query-side).

**Storage**: SQLite in both apps (Room schema on tablet; Prisma schema on the web). One schema addition on each side (see data-model) plus reuse of existing transaction columns.

**Testing**: Android — `:app:testDebugUnitTest`, `:app:lintDebug`, `:app:assembleDebug`. Web — `npm run lint`, `npx tsc --noEmit`, `npm run test:unit` (422 tests). Add focused unit tests for unit conversion, trend math (₱ and % incl. 0% and first-purchase cases), void reversal, and analytics counts.

**Target Platform**: Android tablet (Galaxy Tab A9+, API 35+) and the Windows-hosted web app (both must show identical numbers).

**Project Type**: Two coordinated local-first applications (Android client + web app) sharing one offline-first domain model via export/import and the tablet↔PC bridge.

**Performance Goals**: Ingredient and supplier lists (tens to a few hundred rows) render within 1s on the tablet; analytics inventory summary computes instantly for the store's ingredient count; no perceptible delay when opening purchase detail.

**Constraints**: Offline-first (no cloud); PC is the single café ledger; money and stock records are append-only; client-supplied pesos never trusted — unit cost is always computed from stored quantity + total; both apps must produce identical numbers after the same history.

**Scale/Scope**: Single café; tens of suppliers, tens to ~100 ingredients, thousands of purchase rows over time. Bulk adjustment targets up to ~20 rows per batch.

**Constraints notes**: No [NEEDS CLARIFICATION] remain in the spec; all scope decisions (bulk=stock-only, analytics=counts+value, void+re-enter) are locked.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution gates applied (from `.specify/memory/constitution.md`):

1. **Never trust client pesos** → unit cost is computed by the app from the stored purchase quantity and the stored total; clients only submit quantity/unit/total/supplier. PASS (no violation).
2. **Money & stock append-only** → purchases and adjustments are always new rows; corrections are VOID + re-enter with an audit event; no UPDATE/DELETE of purchase rows in v1. PASS.
3. **Grant+consume atomicity** → purchase write (stock + cost + transaction + supplier link + ingredient last-supplier cache) is one DB transaction; bulk adjust writes all rows in one transaction. PASS.
4. **Tests are deliverables** → unit tests for conversion/trends/void/analytics + platform gates run before done. PASS.
5. **Thin routes → service → repository (web)** → new web endpoints/actions only call domain services; Prisma stays in repository modules. PASS.
6. **Parity & no silent divergence** → identical behavior/numbers specified for both apps; cross-app check in quickstart. PASS.

## Project Structure

### Documentation (this feature)

```text
specs/014-purchase-supplier-insights/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
# Repo layout (existing, extended by this feature)

cafeos-tablet/                                  # Android tablet app
└── app/src/main/java/com/cafeos/tablet/
    ├── data/
    │   ├── Entities.kt                         # Ingredient, Supplier, IngredientTransaction, ... (+ Ingredient.lastSupplierId)
    │   ├── CafeDatabase.kt                     # Room v20 migration (add lastSupplierId)
    │   ├── CafeDao.kt                          # purchase/trend/latest-supplier queries
    │   ├── PurchaseUnits.kt                    # NEW: unit conversion table (kg/g, L/ml, pcs)
    │   └── (existing export/import, bridge payloads extended)
    ├── ui/CafeViewModel.kt                     # purchase/bulk/void/analytics state ops (transactional)
    └── ui/screens/
        ├── InventoryScreen.kt                  # Ingredient grid w/ latest supplier; purchase detail dialog; bulk adjust
        ├── SuppliersScreen.kt                  # NEW supplier page (per-supplier ingredient prices + trends)
        └── AnalyticsScreen.kt                  # low-stock counts + stock value summary

my-app/                                         # Windows café app (web)
├── modules/
│   ├── inventory/                             # repository + service (purchase, trends, supplier view, analytics aggregation)
│   ├── suppliers/                             # supplier page data (existing admin area reuse)
│   └── analytics/                             # inventory summary wiring
├── prisma/schema.prisma                       # Ingredient.lastSupplierId (+ any web-only mirror)
└── app/admin/
    ├── inventory/page.tsx                     # bulk adjust, purchase w/ auto unit cost, purchase detail
    ├── suppliers/page.tsx                     # per-supplier ingredient price trends
    └── analytics/page.tsx                     # low-stock + stock value summary
```

**Structure Decision**: extend the existing modular structure on both sides rather than adding new top-level projects — the domain already has Ingredient/Supplier/IngredientTransaction/SupplierIngredientPrice and inventory screens on both platforms. The plan follows the "one domain, two surfaces" rule used by spec 013 and avoids third-party dependencies (minimal-change ladder).

## Complexity Tracking

> No constitution violations to justify — leave empty.
