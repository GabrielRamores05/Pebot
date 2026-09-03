---

description: "Task list for inventory & purchasing intelligence (spec 014)"

---

# Tasks: Inventory & Purchasing Intelligence

**Input**: Design documents from `/specs/014-purchase-supplier-insights/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/bridge-schema.md, quickstart.md

**Tests**: Included where the project constitution requires tests as deliverables (unit tests for conversion, trend math, void, analytics) and the plan's Technical Context names them. Write test tasks first and watch them fail before implementation.

**Organization**: Tasks are grouped by user story so each story is an independently implementable, testable increment. Every story is implemented on BOTH surfaces â€” the Android tablet (`cafeos-tablet/`) and the Windows cafÃ© web app (`my-app/`) â€” with identical behavior and numbers (owner decision).

## Format: `[ID] [P?] [Story] Description`

## Path Conventions

- Android tablet: `cafeos-tablet/app/src/main/java/com/cafeos/tablet/` (Room entities/DAO in `data/`, state in `ui/CafeViewModel.kt`, screens in `ui/screens/`)
- Android tests: `cafeos-tablet/app/src/test/java/com/cafeos/tablet/`
- Web app: `my-app/modules/**` (domain), `my-app/app/**` (UI/routes), `my-app/prisma/schema.prisma`
- Web tests: `my-app/tests/` or `*.test.ts` beside modules (existing convention)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Confirm a clean, gated baseline before touching anything.

- [X] T001 Establish green baseline: run `npm run lint`, `npx tsc --noEmit`, `npm run test:unit` in `my-app/` AND `.\gradlew.bat :app:lintDebug :app:testDebugUnitTest :app:assembleDebug` in `cafeos-tablet/`; record results

**Checkpoint**: Baseline green on both platforms.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema + write-path primitives every user story depends on.

**âš ï¸ CRITICAL**: No user story work starts until this phase is complete.

- [X] T002 [P] Add nullable `lastSupplierId` to Ingredient in `cafeos-tablet/app/src/main/java/com/cafeos/tablet/data/Entities.kt` and a Room migration 19â†’20 (add column) in `cafeos-tablet/app/src/main/java/com/cafeos/tablet/data/CafeDatabase.kt`
- [ ] T003 [P] Add nullable `lastSupplierId` to Ingredient in `my-app/prisma/schema.prisma` and create/apply its migration
- [X] T004 [P] Add purchase-unit conversion object (kgâ†”g, Lâ†”ml, pcs; rejects non-convertible pairs) at `cafeos-tablet/app/src/main/java/com/cafeos/tablet/data/PurchaseUnits.kt` with unit tests in `cafeos-tablet/app/src/test/java/com/cafeos/tablet/data/PurchaseUnitsTest.kt`
- [ ] T005 [P] Web equivalents: unit conversion util under `my-app/modules/inventory/` (pure function + `*.test.ts`) â€” same rules as T004

**Checkpoint**: Foundation ready â€” schema migrated on both platforms and conversion math tested. User story implementation can begin in parallel.

---

## Phase 3: User Story 1 â€” Record purchase with automatic unit cost (Priority: P1) ðŸŽ¯ MVP

**Goal**: Record a purchase with quantity in a real-world unit + total peso amount; system computes unit cost, replaces the ingredient's latest cost-per-unit, links the supplier, and stores the append-only purchase row â€” one transaction.

**Independent Test**: quickstart QS-1 on either app (stock + unit cost + latest supplier + history entry with change vs previous appear together after one save).

### Implementation for User Story 1

- [ ] T006 [US1] Purchase row links supplier via `referenceType='supplier'`/`referenceId`; extend DAO insert/query helpers in `cafeos-tablet/app/src/main/java/com/cafeos/tablet/data/CafeDao.kt`
- [X] T007 [US1] Make purchase transactional in `cafeos-tablet/app/src/main/java/com/cafeos/tablet/ui/CafeViewModel.kt` (`purchaseIngredient`): convert quantity to base unit, stock += qty, `costPerUnit` = total Ã· converted qty (replace), `lastSupplierId` = supplier when given, insert PURCHASE row â€” all in one `db.withTransaction`; reject quantity â‰¤ 0 and unconvertible units
- [ ] T008 [US1] Web purchase write: implement record-purchase in `my-app/modules/inventory/service.ts` (same math/transaction semantics) with Prisma access only via `my-app/modules/inventory/repository.ts`
- [ ] T009 [P] [US1] Tablet UI: Record Purchase in `cafeos-tablet/app/src/main/java/com/cafeos/tablet/ui/screens/InventoryScreen.kt` â€” purchase-unit selector (real-world unit), auto-calculated unit-cost preview line, supplier picker (existing inline lists)
- [ ] T010 [P] [US1] Web UI: purchase form with unit selector + auto unit-cost in `my-app/app/admin/inventory/page.tsx` (and any route handler in `my-app/app/api/` for it)
- [ ] T011 [P] [US1] Unit tests for purchase math (conversion, unit cost replace, no-trust validation) on both platforms: `cafeos-tablet/app/src/test/.../PurchaseMathTest.kt` and `my-app/modules/inventory/*.test.ts` â€” write first, confirm they fail, then implement

**Checkpoint**: US1 works end-to-end on both apps (QS-1). MVP is complete and demoable.

---

## Phase 4: User Story 2 â€” Latest supplier + purchase history with price trend (Priority: P1)

**Goal**: Ingredient page shows latest supplier and latest unit cost; tapping purchase history opens full detail incl. â‚±/% change vs the previous purchase of that ingredient.

**Independent Test**: quickstart QS-2 â€” after two purchases of the same ingredient, detail shows the exact â‚± and % change.

- [ ] T012 [US2] Tablet data: DAO queries for latest purchase per ingredient and previous purchase per ingredient (row-id ordering, ignoring VOID) in `cafeos-tablet/app/src/main/java/com/cafeos/tablet/data/CafeDao.kt` + ViewModel accessors in `cafeos-tablet/app/src/main/java/com/cafeos/tablet/ui/CafeViewModel.kt`
- [ ] T013 [US2] Tablet UI: ingredient card shows latest supplier name (from `lastSupplierId`) in `cafeos-tablet/app/src/main/java/com/cafeos/tablet/ui/screens/InventoryScreen.kt`; clicking a history row opens a detail dialog with supplier, entered/base quantities, total, unit cost, â‚± and % change vs previous
- [ ] T014 [US2] Web: trend queries in `my-app/modules/inventory/repository.ts` + service, UI for ingredient detail/history in `my-app/app/admin/inventory/page.tsx`
- [ ] T015 [P] [US2] Trend-math unit tests (first purchase â†’ no comparison; equal price â†’ â‚±0.00/0%; increase and decrease cases) on both platforms

**Checkpoint**: US1 + US2 function independently (QS-2).

---

## Phase 5: User Story 3 â€” Supplier page with ingredient prices and trends (Priority: P2)

**Goal**: Each supplier page lists all ingredients purchased from them with latest price from that supplier and â‚±/% change vs the previous price from the same supplier.

**Independent Test**: quickstart QS-2 supplier half â€” two purchases from the same supplier show the correct change; suppliers without purchases show an empty list note.

- [ ] T016 [US3] Tablet data: per-supplier ingredient aggregation (latest + previous same-supplier purchase per ingredient) in `cafeos-tablet/app/src/main/java/com/cafeos/tablet/data/CafeDao.kt` + ViewModel accessors
- [ ] T017 [US3] Tablet UI: Suppliers page at `cafeos-tablet/app/src/main/java/com/cafeos/tablet/ui/screens/SuppliersScreen.kt` (new) showing ingredient rows with latest price and â‚±/% change; wire into navigation in `cafeos-tablet/app/src/main/java/com/cafeos/tablet/MainActivity.kt`
- [ ] T018 [US3] Web: supplier page data (repository/service) and UI in `my-app/app/admin/suppliers/page.tsx` (or existing suppliers area) with the same change figures
- [ ] T032 [P] [US3] Supplier-deletion safety on both apps: warn when a supplier has purchase history; on delete, recompute-or-clear `lastSupplierId` on every affected ingredient from remaining non-void purchases (tablet: `cafeos-tablet/.../ui/CafeViewModel.kt` + `data/CafeDao.kt`; web: `my-app/modules/inventory/service.ts`)

**Checkpoint**: QS-2 supplier scenario passes on both apps; US3 independently testable.

---

## Phase 6: User Story 4 â€” Bulk-adjust ingredient stock (Priority: P2)

**Goal**: One screen adjusts stock up/down for many ingredients in a single save; rows write ADJUSTMENT history entries (stock-only corrections â€” no supplier, no cost change; locked decision).

**Independent Test**: quickstart QS-3 â€” 3 ingredients adjusted in one batch; levels and ADJUSTMENT history rows update immediately; low flags refresh.

- [ ] T019 [US4] Tablet data/state: batch-adjust in one transaction writing ADJUSTMENT rows with `referenceType='batch'` in `cafeos-tablet/app/src/main/java/com/cafeos/tablet/ui/CafeViewModel.kt`; batch id = first ADJUSTMENT row id on every row; reject any row that would push stock below zero (validate the whole batch before writing)
- [ ] T020 [US4] Tablet UI: bulk-adjust screen (multi-row edit + single save) in `cafeos-tablet/app/src/main/java/com/cafeos/tablet/ui/screens/InventoryScreen.kt`
- [ ] T021 [US4] Web: bulk-adjust service + UI in `my-app/modules/inventory/` and `my-app/app/admin/inventory/page.tsx` (same single-transaction semantics; batch identity and below-zero rejection identical to T019)

**Checkpoint**: QS-3 passes on both apps; US4 independently testable.

---

## Phase 7: User Story 5 â€” Low-stock thresholds in analytics (Priority: P3)

**Goal**: One threshold rule drives the ingredient page, alert lists, AND an analytics inventory summary (healthy/low/out counts + total stock value; no restock suggestions â€” locked decision).

**Independent Test**: quickstart QS-5 â€” raising a threshold flips the ingredient to Low everywhere at once; lowering clears it everywhere.

- [ ] T022 [US5] Tablet: shared low/out rule + analytics inventory summary (counts + Î£ currentStockÃ—costPerUnit) in `cafeos-tablet/app/src/main/java/com/cafeos/tablet/ui/CafeViewModel.kt` and `cafeos-tablet/app/src/main/java/com/cafeos/tablet/ui/screens/AnalyticsScreen.kt`
- [ ] T023 [US5] Web: same rule + summary in `my-app/modules/analytics/` (or inventory) and `my-app/app/admin/analytics/page.tsx`
- [ ] T024 [P] [US5] Unit tests for the shared low/out rule and stock-value math on both platforms, including the boundary `currentStock == minStock â†’ LOW` and healthy/low/out transitions (tablet `app/src/test/.../`; web `my-app/modules/*.test.ts`)

**Checkpoint**: QS-5 passes on both apps; US5 independently testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Ledger-safety features and parity glue that span all stories.

- [ ] T025 [P] Export/import both platforms: carry `Ingredient.lastSupplierId`, purchase rows' `referenceType='supplier'`/`referenceId`, and `VOID_PURCHASE` type end-to-end (`cafeos-tablet` export/import in `CafeViewModel.kt`/`MenuImportParser.kt`; `my-app` tablet ingest + import/export services per `contracts/bridge-schema.md`)
- [ ] T026 [P] Void + re-enter on the tablet: voiding **appends a compensating `VOID_PURCHASE` row** (`referenceType='void-of'` â†’ original row id; the original is never modified), reverses stock in the same transaction, reverts `costPerUnit`/`lastSupplierId` **only when the voided row is the latest non-void purchase**, writes an audit event (`cafeos-tablet/app/src/main/java/com/cafeos/tablet/ui/CafeViewModel.kt`); UI entry in history detail
- [ ] T027 [P] Void + re-enter on the web: identical additive compensation semantics in `my-app/modules/inventory/service.ts` + admin UI
- [ ] T028 [P] Unit tests for void reversal math (incl. voiding the only/latest purchase) on both platforms
- [ ] T029 [P] Tabletâ†”PC bridge payload fields per `specs/014-purchase-supplier-insights/contracts/bridge-schema.md` (`cafeos-tablet/.../data/PcBridgeClient.kt`, `SocketSyncManager.kt`, `my-app` tablet ingest service)
- [ ] T030 Audit events for purchase/void/bulk writes on both platforms (tablet `logAuditEvent`; web audit log)
- [ ] T031 Run full gates (Android lintDebug/testDebugUnitTest/assembleDebug; web lint/tsc/test:unit) and execute `quickstart.md` QS-1..QS-6 on both apps; resolve any parity mismatch; update `specs/014-purchase-supplier-insights/` and `status.md`; commit

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: after Setup; BLOCKS all user stories
- **User Stories (Phases 3â€“7)**: after Foundational; may proceed in parallel or in priority order
- **Polish (Phase 8)**: after desired user stories are complete

### User Story Dependencies

- **US1 (P1)**: none beyond Foundational â€” MVP
- **US2 (P1)**: builds on US1 data (purchases) but is independently testable once Foundational + any purchase rows exist
- **US3 (P2)**: depends on purchase rows (US1); independently testable
- **US4 (P2)**: independent of US1â€“US3 (adjustments only)
- **US5 (P3)**: independent (works on existing stock/threshold data)

### Within Each User Story

- Write the story's unit-test tasks first and watch them fail
- Data/state before UI
- Core implementation before integration/checkpoint

### Parallel Opportunities

- Phase 2 tasks T002â€“T005 marked [P] can run in parallel
- Story implementation tasks marked [P] (UI vs data vs web vs tablet) can run in parallel
- US4 and US5 are fully independent of US1â€“US3 once Foundational is done
- Tablet (cafeos-tablet) and web (my-app) halves of each story can be built by different agents in parallel

---

## Parallel Example: User Story 1

```bash
Task: "Purchase math unit tests (T011) â€” cafeos-tablet PurchaseMathTest.kt"
Task: "Purchase math unit tests (T011) â€” my-app inventory *.test.ts"
Task: "Tablet transactional purchase (T007) in CafeViewModel.kt"
Task: "Web purchase write (T008) in modules/inventory/service.ts"
Task: "Tablet UI (T009) in InventoryScreen.kt"
Task: "Web UI (T010) in app/admin/inventory/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (T001 baseline)
2. Phase 2 (T002â€“T005 foundational schema + conversion)
3. Phase 3 (T006â€“T011) â€” US1 complete
4. **STOP and VALIDATE**: QS-1 on both apps
5. Demo-ready MVP: auto unit-cost purchase with supplier, ledger-safe

### Incremental Delivery

1. Foundation ready (T002â€“T005)
2. US1 (MVP) â†’ validate QS-1 â†’ demo
3. US2 â†’ QS-2 â†’ demo (history + trends)
4. US3 â†’ supplier page â†’ demo
5. US4 â†’ bulk â†’ demo
6. US5 â†’ analytics summary â†’ demo
7. Phase 8 â†’ void/export/bridge/audit â†’ full gates + quickstart

### Parallel Team Strategy

- Tablet developer implements every task in `cafeos-tablet/â€¦`; web developer implements the `my-app/â€¦` halves in parallel
- Same task IDs on both halves; parity checkpoint after each story

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps the task to its user story
- Each user story is independently completable and testable via its QS scenario
- Money and stock writes are append-only and single-transaction (constitution); VOID replaces edit/delete
- Unit costs are always computed from stored quantity + total â€” never accepted from the client
- Commit after each task or logical group; stop at checkpoints to validate the story independently

