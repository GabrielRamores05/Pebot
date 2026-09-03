# Implementation Plan: Tablet Full Staff/Admin/Kitchen Parity

**Spec**: `specs/013-tablet-full-staff-parity/spec.md` | **Approved**: 2026-09-04 | **Branch**: main (or feature branch when collaborating)

**Summary**: bring `cafeos-tablet/` to complete, behavior- and visually-identical parity with the staff/admin/kitchen surfaces of `my-app/` (the Windows CaféOS app), with the Windows PC as store host and single ledger. Owner decisions (see `decisions.md`): (1) tablet = staff/admin/kitchen parity only, PC serves customers; (2) PC is the single café ledger with tablet real-time push + offline provisional-receipt fallback.

## Verified baseline (2026-09-04)

- Web app: 89 API routes, 45 Prisma models; gates green (lint 0 errors/248 warnings, `tsc --noEmit`, 422 unit tests). Live admin UI = light amber/cream/stone Tailwind theme, mixed with some `--pos-*` moss tokens → per-screen screenshot reference required.
- Tablet app: Kotlin/Compose/Room; builds green on this machine (`assembleDebug`, `testDebugUnitTest`, `lintDebug`). 44 Room entities, DB v17, `fallbackToDestructiveMigration()`. 13 reachable nav screens; 11 screens orphaned (FloorPlan, GuestManagement, Loyalty, CustomerManagement, CustomerAnalytics, Reviews, AuditLog, AIConsultant, OptionGroup, StockHistory, StationAssignment); HR data+VM exist with zero screens. Sync = bespoke WebSocket :3001 (cannot reach web Socket.IO `/api/socket`). Known bugs: unavailable products sellable; kitchen station filter no-op; PWD/Student hardcoded 20%; VAT hardcodes 12%; order type hardcoded DINE_IN; receipt-preview precedence bug; plaintext PINs + master PIN `123456`; non-transactional order/import; inert analytics exports; Expenses dialog wrong columns; VM tests test re-implemented logic copies.

---

## Matrix A — screens/modules parity (✅ implemented · 🟡 partial · ❌ missing)

| # | Windows surface | Tablet current | Status |
|---|---|---|---|
| A1 | Shell & navigation (14 rail items + Live Orders home with Staff Queue/Tables/Stations top tabs; role+10-flag gating) | Different rail (13 items incl. tablet-only Connection/Vouchers/POS labels; route-CSV permissions) | 🟡 |
| A2 | Login & sessions (email+password → JWT on PC; auto clock-in/out; rate-limit) | 6-digit PIN, plaintext, master PIN, extra roles MANAGER/BARISTA | 🟡 |
| A3 | Live Orders kanban (Pending/Preparing/Ready/Cancelled, drag, detail slide-over w/ invoice + message thread + voice, sounds) | Kanban w/o READY, no messages/invoice/sounds | 🟡 |
| A4 | Terminal / New Order (3 panes; order types + address; Student/PWD % from settings; loyalty member picker/auto-apply; cash pad/quick chips; GCash/PayMaya + QR/proof; BIR receipt PNG/thermal) | Grid+cart, table picker, voucher dropdown, hardcoded 20%, no order type, no member picker, unavailable sellable | 🟡 |
| A5 | Kitchen display (station filter by product.stationType + counts, messages thread/voice, follow-up, badges, sounds) | Station filter no-op; no threads/follow-up | 🟡 |
| A6 | Products (4 tabs incl. All-with-reviews, Categories w/ images/emoji, Options w/ per-option ingredient deltas; sellable-qty readout) | Full CRUD; no reviews summary/sellable-qty; option ingredient deltas weak | 🟡 |
| A7 | Inventory (4 tabs: product stock + threshold/adjust + recipe-managed grey-out, ingredients CRUD/purchases, suppliers, capacity, purchase planner) | 7 tabs; Products tab read-only name-join; no planner; dead success box | 🟡 |
| A8 | Stock History (ledger, badges, summaries, filters) | Standalone screen orphaned; inline History tab only | ❌ |
| A9 | Expenses (category/supplier/payment/date CRUD ledger) | Basic; wrong-column + missing selectors bugs | 🟡 |
| A10 | Analytics suite (Overview/Revenue/Customers/Fulfillment/Vouchers tabs; per-chart PNG) | Single screen; exports inert; Customers/Fulfillment/Vouchers tabs missing | 🟡/❌ |
| A11 | Loyalty admin (modules builder, milestone mode, card designer, card grid/details, vouchers mgmt) | Loyalty screen orphaned; only vouchers reachable | 🟡 |
| A12 | Staff & HR (8 tabs: Team/Schedule/Time Clock/Time Off/Payroll/Reviews/Documents/Training) | Team-subset CRUD only | ❌ |
| A13 | Tables (card grid, status cycle, guests/moods, visit peek, occupancy alerts, QR modal) | CRUD + sections; occupancy never auto-set; FloorPlan/Guest orphaned | 🟡 |
| A14 | Stations (station-staff CRUD w/ emoji picker) | Assignment screen orphaned; no station CRUD UI | ❌ |
| A15 | Order History (filters/pagination + Official Receipt modal) | Flat list + CSV extras; no filters/receipt modal | 🟡 |
| A16 | Reviews admin (list + Taste Suggestions + filters, delete moderation) | Orphaned | ❌ |
| A17 | Audit Logs (paged, filters, JSON, user/IP) | Orphaned; nothing writes audit events | ❌ |
| A18 | Consultant (ADMIN AI chat via PC OpenRouter proxy) | Orphaned; stub reply | ❌ |
| A19 | Settings (Business/Loyalty/Payments/Branding/AI/Account&Data + AdminTools QR/backup/restore/tablet import) | System/Business/Payments/Receipts/Voice; gaps | 🟡 |
| A20 | All reachable screens have identical UI/UX vs web (screenshot oracle) | Mixed theme/divergences | 🟡 |

## Matrix B — cross-cutting behavior/data/integrity (✅ 🟡 ❌)

| # | Concern | Status | Required |
|---|---|---|---|
| B1 | Order status model incl. READY + per-role cancel rules | 🟡 | Shared tested rules function; mirror web |
| B2 | Order types + delivery address, persisted/displayed | 🟡 | Add + show in kitchen/kanban |
| B3 | Messages & follow-up (text + voice, read state) | ❌ | UI + sync via PC |
| B4 | Discounts/money: settings-driven Student/PWD %, vouchers, loyalty server-derived; one transaction | 🟡 | PC derives online; same logic offline; never client pesos |
| B5 | Receipts & numbering: PC sequence online; provisional prefix series offline; `vatRate` respected | 🟡 | Bridge + numbering module + tests |
| B6 | Realtime vocabulary: web Socket.IO events/rooms | ❌ | Socket.IO client; mirror registry |
| B7 | Catalog/settings/loyalty/staff/vouchers mirror from PC | ❌ | Pull + delta events; full ledger mirror for analytics |
| B8 | Roles/permissions = web 10 flags + ADMIN/STAFF/KITCHEN | 🟡 | Align + permission editor parity |
| B9 | Data integrity: real migrations, `@Transaction`, import id-remap, cancel restores | ❌ | Foundations phase |
| B10 | Export/import parity + new fields (deliveryAddress etc.) | 🟡 | Field diff schema.prisma ↔ Entities.kt |
| B11 | Security: hashed PINs, no master PIN, keystore secret out of source, device pairing | ❌ | Foundations phase |
| B12 | Known tablet bugs fixed (see baseline list) | ❌ | Foundations + per-screen phases |

## Phases (each ends green on §No-errors gates; fully specified in spec/decisions)

- **Phase 0 Foundations**: spec/plan/tasks docs; Room migrations (drop destructive fallback), `@Transaction` order/import, import id-remap + new fields, audit insert points, PIN hashing, remove master PIN + keystore password from source, rewrite VM unit tests against real methods, seed field-diff report.
- **Phase 1 Shell/roles/nav**: Windows nav order + home top tabs; role/permission alignment; access decisions; permission editor.
- **Phase 2 PC ledger bridge**: device pairing; Socket.IO client; push/pull + delta; offline queue + provisional receipts; idempotent reconcile; thin PC routes/services.
- **Phase 3 Order lifecycle + Terminal parity** (statuses, order types, discounts, loyalty assignment, payment, receipts, cancel, unavailable-product fix).
- **Phase 4 Catalog/Inventory parity** (products incl. reviews/sellable-qty; inventory web model + planner; stock history reachable; option ingredient deltas).
- **Phase 5 Analytics suite** (5 tabs, working exports, fulfillment metrics over mirrored ledger).
- **Phase 6 Staff/HR + Stations + Tables** (7 missing HR screens, stations CRUD, tables parity incl. sessions/guests/QR).
- **Phase 7 Reviews/Audit/Consultant/Order-History + Kitchen/Live-Orders flows** (reachable + parity + audit emission + consultant via PC bridge).
- **Phase 8 Settings/AdminTools parity** (+ QR tools, backup/restore/import adapted, voice, bug fixes).
- **Phase 9 UI/UX unification** (screenshot-oracle parity pass, states/labels/colors, performance, accessibility).
- **Phase 10 Acceptance & release** (full gates + QA matrix + real-device owner items + docs cleanup + release APK).

## No-errors gates (all phases)

- Web: `npm run lint` (0 errors), `npx tsc --noEmit`, `npm run test:unit`.
- Android: `gradlew :app:lintDebug`, `:app:testDebugUnitTest`, `:app:assembleDebug` (+ `assembleRelease` at end).
- New unit tests exercise real ViewModel/business functions; no stubs/TODO in reachable paths; no orphaned screens; every module × role run-through passes with web-identical error/validation text; offline drill + reconciliation passes.
- Owner-run hardware items (real sync/printer/mic/TTS) documented in spec acceptance.

## References

- `spec.md`, `decisions.md`, `escalations.md` (this folder)
- Web reference: `my-app/app/**`; contracts: `specs/012-tablet-comprehensive-parity/contracts/`
- Constitution: `.specify/memory/constitution.md`
