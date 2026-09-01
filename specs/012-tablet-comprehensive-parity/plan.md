# Implementation Plan: Tablet Comprehensive Feature Parity

**Branch**: `12-tablet-comprehensive-parity` | **Date**: 2026-09-01 | **Spec**: `specs/012-tablet-comprehensive-parity/spec.md`

**Input**: Feature specification from `specs/012-tablet-comprehensive-parity/spec.md`

## Summary

Create a comprehensive development roadmap for the Pebot tablet APK that achieves
full feature parity with the Windows web application, excluding the customer menu.
The tablet already implements core POS, live orders, kitchen display, inventory,
product management, analytics, and finance. This plan fills remaining gaps for
staff/HR, audits, AI consultant, reviews, table management, and ensures all
data models align with the Windows Prisma schema via Room entities.

## Technical Context

**Language/Version**: Kotlin 1.9.22, JVM target 17

**Primary Dependencies**:
- AndroidX Compose Material 3 (UI)
- Room 2.6.1 (SQLite ORM)
- Socket.IO 2.5.1 (real-time sync — added in prior session)
- kotlinx.serialization-json 1.6.3 (export/import)
- okio 3.9.0 (file I/O)

**Storage**: Room database (single SQLite file per tablet), file-based export/import

**Testing**: JUnit 4 (unit tests), no existing test framework for Android instrumentation

**Target Platform**: Android 8.0+ (minSdk 26, targetSdk 34)

**Project Type**: Mobile app (Android tablet)

**Performance Goals**: Sub-200ms screen transitions, instant cart updates during ordering

**Constraints**: Must work offline (Principle I); no cloud backend; local LAN only for sync

**Scale/Scope**: ~14 tablet screens, 25+ entity types, 40+ DAO methods

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Local-first offline | PASS | Room DB is local; Socket.IO is async, not blocking |
| II. Two trust zones | PASS | Staff PIN auth, role-based access already implemented |
| III. Money append-only | PASS | Order totals from line items; receipt numbering sequential |
| IV. Thin routes, domain modules | PASS | All `dao.*` in DAO layer; ViewModel calls DAO only |
| V. Electron is a shell | PASS | Tablet is native Android, not Electron |
| VI. Tests are deliverable | WARNING | Need to add unit tests for new ViewModel logic |
| VII. No silent data loss | PASS | Export validates all entities; import confirms with checksum |

**Gate Status**: PASS (with test coverage requirement noted)

## Project Structure

### Documentation (this feature)

```text
specs/012-tablet-comprehensive-parity/
├── spec.md              # Feature specification
├── plan.md              # This file (implementation plan)
├── research.md          # Phase 0 output (researched decisions)
├── data-model.md        # Phase 1 output (entity alignment)
├── quickstart.md        # Phase 1 output (validation guide)
├── contracts/           # Phase 1 output
│   ├── data-sync.md     # Sync protocol contract
│   └── export-format.md # Export/import format spec
└── tasks.md             # Phase 2 output (created by /speckit.plan → /speckit.tasks)
```

### Source Code (repository)

```text
cafeos-tablet/
├── app/src/main/java/com/cafeos/tablet/
│   ├── data/
│   │   ├── Entities.kt        # All data entities (extended)
│   │   ├── CafeDao.kt         # All DAO queries
│   │   ├── CafeDatabase.kt    # Database (version bumped as needed)
│   │   ├── SocketSyncManager.kt  # Socket.IO client (added)
│   │   └── ReceiptPrinter.kt     # PDF receipt printing (added)
│   ├── ui/
│   │   ├── CafeViewModel.kt   # Business logic + cart management
│   │   └── screens/
│   │       ├── POSScreen.kt
│   │       ├── LiveOrdersScreen.kt
│   │       ├── KitchenScreen.kt
│   │       ├── InventoryScreen.kt
│   │       ├── ProductScreen.kt
│   │       ├── OrderHistoryScreen.kt
│   │       ├── AnalyticsScreen.kt
│   │       ├── ExpensesScreen.kt
│   │       ├── CustomerManagementScreen.kt
│   │       ├── StaffManagementScreen.kt
│   │       ├── VoucherManagementScreen.kt
│   │       ├── LoginScreen.kt
│   │       ├── SettingsScreen.kt
│   │       ├── OptionGroupScreen.kt
│   │       ├── TablesManagementScreen.kt     # TO CREATE
│   │       ├── AuditLogScreen.kt             # TO CREATE
│   │       ├── AIConsultantScreen.kt         # TO CREATE
│   │       └── ReviewsScreen.kt              # TO CREATE
│   └── MainActivity.kt  # Navigation host (updated)
├── app/build.gradle.kts  # Dependencies (Socket.IO, Print added)
└── .gitignore            # Added (excludes build artifacts, .hprof)
```

**Structure Decision**: Single Android project with feature-based package structure.
New screens added to `ui/screens/` following existing conventions. All entities
in `data/Entities.kt`, all queries in `data/CafeDao.kt`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Multiple new entity types (Review, AuditEvent, Attendance, etc.) | Windows schema has 30+ entities; tablet currently has 20+ | Reducing scope would leave modules non-functional and break sync compatibility |
| Socket.IO client | Constitution Principle I requires sync without blocking; LAN-only Socket.IO is the established pattern (Windows uses it) | REST polling would add latency and battery drain without solving offline needs |
| PDF receipt printing | BIR-compliant receipts require formatted print output; Android PrintManager via PDF is the standard approach | Simple text printing lacks formatting control needed for compliance |
| In-memory product cache | POS screen needs sub-200ms product lookups during high-volume ordering | Direct DB queries for every lookup would cause UI jank |

## Implementation Roadmap (Module-by-Module)

### Phase 1: Data Model Alignment
- [x] **ProductIngredient** entity (recipe linkage) ✅ already in DAO
- [x] **OptionGroup/Option/ProductOptionGroup** entities ✅ already in DAO
- [x] **LoyaltyVoucher** entity ✅ already in DAO
- [x] **Staff** entity with roles ✅ already in DAO
- [x] **BusinessSettings** entity ✅ already in DAO
- [x] **Expense** entity ✅ already in DAO
- [x] **Review** entity — customer product reviews ✅ (Entities.kt:305)
- [x] **OrderMessage** entity — order notes/messages ✅ (Entities.kt:317)
- [x] **ExpenseCategory** entity — categorization ✅ (Entities.kt:330)
- [x] **AuditEvent** entity — append-only audit trail ✅ (Entities.kt:339)
- [x] **ProductOption** entity — product-specific option price deltas ✅
- [x] **TableSession** entity — tracks table occupancy sessions ✅
- [x] **LoyaltyCard** entity — customer loyalty cards ✅ (Phase 3)
- [x] **LoyaltyTransaction** entity — loyalty point transactions ✅ (Phase 3)
- [x] **LoyaltySetting** entity — global loyalty configuration ✅ (Phase 3)
- [x] **Attendance/LeaveRequest/Schedule/Payroll** — HR modules ✅ (Phase 2)
- [x] **StaffDocument/StaffTraining/PerformanceReview** — staff development ✅ (Phase 2)
- [x] **AIConversation/AIMessage** — AI consultant chat history ✅ (Phase 3)
- [x] **Dao methods** — CRUD for Review, OrderMessage, ExpenseCategory, AuditEvent ✅
- [x] **Dao methods** — CRUD for ProductOption, TableSession ✅
- [x] **Dao methods** — CRUD for LoyaltyCard, LoyaltyTransaction, LoyaltySetting ✅
- [x] **Dao methods** — CRUD for AIConversation, AIMessage ✅
- [x] **Dao methods** — CRUD for Attendance, LeaveType, LeaveRequest, Schedule, Payroll, StaffDocument, StaffTraining, PerformanceReview ✅
- [x] **ViewModel methods** — addOrderMessage, addReview, addExpenseCategory, logAuditEvent ✅
- [x] **ViewModel methods** — addProductOption, openTableSession, closeTableSession ✅
- [x] **ViewModel methods** — createLoyaltyCard, addLoyaltyPoints, redeemLoyaltyPoints ✅
- [x] **ViewModel methods** — clockIn, requestLeave, approveLeaveRequest, generatePayroll ✅
- [x] **ViewModel methods** — createAIConversation, addAIMessage ✅
- [x] **ExportData extended** — all new entities for round-trip ✅
- [x] **DB v11** — all Phase 1-3 entities registered ✅

### Phase 2: Staff/HR Module <span style="color:green">(COMPLETED)</span>
- [x] **Login** (PIN auth with default fallback) ✅
- [x] **Staff Management** (CRUD, roles) ✅
- [x] **Attendance** — clock in/out, break tracking ✅ (Entities.kt, DAO, ViewModel)
- [x] **Leave Requests** — request/approve with types ✅ (LeaveType entity added)
- [x] **Schedule** — shift scheduling ✅
- [x] **Payroll** — Philippine statutory calculations (SSS/PhilHealth/Pag-IBIG) ✅
- [x] **LeaveType** — leave type definitions ✅
- [x] **Performance Reviews** — review CRUD ✅
- [x] **Documents** — staff document storage ✅
- [x] **Training** — training program tracking ✅

### Phase 3: Customer/Loyalty & AI Module <span style="color:#ff9900">(IN PROGRESS)</span>
- [x] **Customer Management** (list, add, loyalty points) ✅
- [x] **Loyalty Voucher Management** (CRUD) ✅
- [x] **Loyalty Card Management** — card CRUD ✅ (entities + DAO + ViewModel)
- [x] **Loyalty Settings** — global config, milestone mode ✅
- [x] **Loyalty Redemption** — apply at checkout ✅ (addLoyaltyPoints, redeemLoyaltyPoints)
- [x] **AI Conversations** — chat interface ✅ (entities + DAO + ViewModel)
- [ ] **Customer Analytics** — tiers, LTV, retention
- [ ] **Loyalty Redemption UI** — integrate voucher application in POS checkout

### Phase 4: Inventory & Finance
- [x] **Ingredient Management** (CRUD, adjustments) ✅
- [x] **Purchase Tracking** (Record Purchase dialog) ✅
- [x] **Stock History** (all transactions) ✅
- [x] **Supplier Management** (CRUD) ✅
- [x] **Expense Tracking** (CRUD) ✅
- [x] **Production Capacity** ✅
- [ ] **Low-stock alerts** — visual indicators
- [ ] **Supplier pricing** — per-supplier ingredient costs

### Phase 5: Analytics & Reporting
- [x] **Revenue Charts** (bar chart, time filters) ✅
- [x] **Payment Method Breakdown** ✅
- [x] **Category Revenue** ✅
- [x] **Top Products** ✅
- [ ] **Customer Analytics** — spending percentiles, churn rates
- [ ] **Fulfillment Analytics** — order prep time, queue length
- [ ] **Voucher Analytics** — redemption rates, savings
- [ ] **Export to CSV/PDF** — report generation

### Phase 6: Tables & Stations
- [x] **Table Management** (DAO methods exist) ✅
- [ ] **Floor Plan UI** — visual table layout
- [ ] **Guest Management** — add/remove guests, mood tracking
- [x] **Station Management** (DAO methods exist) ✅
- [ ] **Station Assignment** — kitchen station routing

### Phase 7: Order Management
- [x] **POS Ordering** with options, table selector ✅
- [x] **Payment Screenshot Upload** ✅
- [x] **Order Confirmation Dialog** with barcode ✅
- [x] **BIR Receipt Numbering** ✅
- [x] **Kanban Live Orders** (drag-and-drop) ✅
- [x] **Kitchen Display** (station filtering) ✅
- [x] **Order History** (filterable) ✅
- [ ] **Order Messaging** — customer/staff messages on orders
- [ ] **Order Follow-up** — text + voice notifications
- [ ] **Invoice Download** — BIR-compliant invoice with barcode

### Phase 8: Settings & Configuration
- [x] **System Settings** (export/import, version) ✅
- [x] **Business Settings** (BIR, VAT, receipt) ✅
- [x] **Payment Settings** (GCash/PayMaya accounts) ✅
- [x] **Receipt Settings** (prefix, numbering) ✅
- [ ] **Branding Settings** — shop name, logo, theme colors
- [ ] **Voice Settings** — TTS volume/speed

### Phase 9: Real-time Sync & Printing
- [x] **Socket.IO Client** (connects, listens, broadcasts) ✅
- [x] **Receipt Printing** (PDF via PrintManager) ✅
- [ ] **Cross-device sync test** — verify tablet ↔ web sync
- [ ] **Print testing** — verify output on actual printer

### Phase 10: Audit & Compliance
- [ ] **Audit Logs** — append-only event viewer
- [ ] **Review Management** — product reviews moderation
- [ ] **AI Consultant** — context-aware chat interface

### Phase 11: Polish & Performance
- [x] **Product Caching** in ViewModel ✅
- [ ] **Image caching** — disk cache for loaded images
- [ ] **Performance profiling** — identify slow queries/screens
- [ ] **UI/UX refinement** — match Windows styling
- [ ] **Unit tests** — coverage for all new logic

## Phase Timeline

| Phase | Duration | Focus | Status |
|-------|----------|-------|--------|
| Phase 1 | 1-2 days | Data model alignment | Done (3 phases complete) |
| Phase 2 | 2-3 days | Staff/HR management | Done |
| Phase 3 | 1-2 days | Customer/Loyalty | In Progress |
| Phase 4 | 2-3 days | Inventory & Finance | Done |
| Phase 5 | 2-3 days | Analytics & Reporting | Partial |
| Phase 6 | 1-2 days | Tables & Stations | Partial |
| Phase 7 | 2-3 days | Order Management | Mostly done |
| Phase 8 | 1-2 days | Settings & Configuration | Mostly done |
| Phase 9 | 2-3 days | Sync & Printing | Done (implementation, needs testing) |
| Phase 10 | 2-3 days | Audit & Compliance | Partial |
| Phase 11 | 1-2 days | Polish & Performance | In Progress |

## Next Steps

1. ✅ Phase 1 entities complete (Review, OrderMessage, ExpenseCategory, AuditEvent)
2. Phase 2: Create HR module entities (Attendance, LeaveRequest, Schedule, Payroll, StaffDocument, StaffTraining, PerformanceReview, LeaveType)
3. Phase 3: Loyalty & AI entities (LoyaltyCard, LoyaltyTransaction, LoyaltySetting, AIConversation, AIMessage)
4. Create new screens for all modules
5. Write unit tests for all new ViewModel/DAO logic
6. Configure sync URL in tablet Settings screen
7. Test on Android device with actual printer
