# Spec 013 — Progress Status

Last updated: 2026-09-04 (goal rounds 0–18). Gates last verified (round 18):
Android lintDebug/testDebugUnitTest/assembleDebug green; web lint (0 errors)/
tsc clean/test:unit (422) green.

## Latest increments (rounds 40–42)

- Kitchen station tabs show live per-station order counts (All total too).
- Full Android gates green at round 40.

## Latest increments (rounds 37–39)

- Order-detail receipt reprint (Live Orders & Order History) via receipt printer.
- Expense Categories management UI (add/delete) — feeds the expense editor's
  category-id linking.
- Full Android gates green at each checkpoint; commits through `888ee8f`.

## Latest increments (rounds 34–36)

- Kitchen order cards: order-type badge + elapsed time, red/bold after 10 min in
  PENDING/PREPARING (web urgent coloring).
- Order-detail dialog (Live Orders & Order History) can reprint the official
  receipt via the receipt printer.
- `AccessControl` unit coverage extended for the stations route.

## Latest increments (rounds 32–33)

- Receipt printer honors the configured footer message; Settings ▸ Receipts can
  edit it.
- Tables card quick actions: guest −/+ (0…capacity) and one-tap status cycle
  AVAILABLE → OCCUPIED → NEEDS_CLEANING → AVAILABLE (web behavior).
- Full Android gates green at round 32; commit `fce2a39` (rounds 29–31).

## Latest increments (rounds 19–31)

- HR module UI completed: Staff now has all eight tabs — Team, Time Clock,
  Time Off, Training, Documents, Performance Reviews, Schedule (weekly rota),
  Payroll (generate + Mark Paid). Previously the HR layer had zero screens.
- Stations management screen (web stations parity) reachable under Management,
  gated by the tables permission.
- DINE_IN sales auto-occupy an AVAILABLE table in the same transaction.
- Tables editor + status colors include NEEDS_CLEANING (web status set).
- Settings ▸ Receipts: receipt footer message editor; the receipt printer now
  prints the configured footer.
- Checkpoint commits: `3cea69c` (rounds 0–15), `dd3bb73` (rounds 16–28).

## Latest increments (rounds 12–18)

- Audit emission wired into key tablet actions (order status, staff CRUD,
  voucher CRUD, business-settings saves) — the reachable Audit Log screen now
  shows real append-only events.
- PWD/Student discountReason unified to the web's `STUDENT_PWD`.
- Order History: search + status chips + date presets + count + empty state.
- Expense editor: payment-method selector (CASH/GCASH/BANK) and categoryId
  linkage when the item name matches a configured Expense Category.
- Staff editor: never echoes the hashed PIN; blank PIN on edit keeps the current
  credential; role vocabulary favors ADMIN/STAFF/KITCHEN (legacy roles stay
  editable and are still mapped by AccessControl).
- Voucher editor: start/expiry dates are editable (yyyy-MM-dd) with safe
  fallbacks.

## Implemented & verified (this program so far)

**Phase 0 — Foundations (done)**
- Spec docs: `spec.md`, `plan.md`, `decisions.md`, `escalations.md`,
  `field-diff-summary.md`, `contracts/bridge.md`.
- Security: keystore password out of source (local `keystore.properties`,
  gitignored); staff PINs PBKDF2-hashed (`PinHasher`), master-PIN `123456`
  removed → first-run admin setup; plaintext PIN lookup removed from DAO.
- Integrity: DB real migrations start at v17→v18 (Windows-parity columns batch)
  and v18→v19 (OutboxQueue); `placeOrder` is one transaction incl. receipt
  number/stock/payment/voucher; cancellations restock + release voucher
  atomically; import is one transaction with orderNumber merge + child remap and
  error-visible result; status changes stamp `updatedAt`.
- Schema v18/v19 field/entity additions (see `field-diff-summary.md`).

**Phase 1 — Shell/roles (mostly done)**
- `AccessControl` module: web roles (ADMIN/STAFF/KITCHEN, tablet-only mapped),
  10 permission flags, legacy CSV/blank-permission tolerance, admin-only areas;
  unit-tested; wired into every NavHost route.
- MainScreen rail mirrors the Windows admin sidebar order/labels/groups; home =
  Live Orders; Kitchen for kitchen-role staff; previously orphaned screens are
  now reachable: Loyalty (customers/vouchers/settings), Stock History, Reviews,
  Consultant, Audit Logs; Vouchers folded into the Loyalty module.

**Phase 2 — Ledger bridge (foundations, mid-build)**
- Contract: `contracts/bridge.md`.
- PC: Setting-kv device credentials (`modules/system/service.ts`, repo helpers,
  `app/api/tablet/devices/route.ts` + `[id]/route.ts`) — create/list/revoke,
  bcrypt-hashed secrets, audit-logged. Web gates green.
- Tablet: `PcBridgeClient` (HTTP transport + pure payload builders, unit-tested),
  `PcBridgeConfig`, outbox `OutboxQueue` entity/DAO/migration, provisional
  receipt prefix helpers (`ReceiptNumbers`).

**Phase 3 — Terminal/order parity (in progress)**
- PWD/Student discount rate is settings-driven (was hard-coded 20%); Settings ▸
  Business edits it; POS label shows the live percent.
- Order-type selector (Dine-in/Takeout/Delivery) + delivery address + validation
  at terminal checkout; order stores `deliveryAddress`; reset after sale.
- POS hides `available=false` products (web parity).
- Receipt next-number preview precedence bug fixed.

**Phase 5 target fixes pulled forward**
- Kitchen station filter actually filters by product.stationType (was a no-op).

## Not yet implemented (next work, in priority order)

1. Phase 2 finish: PC `POST /api/tablet/orders` + status/stock/attendance/audit
   ingest routes and `GET /api/tablet/snapshot`; tablet outbox flush service +
   connectivity status in Settings; Socket.IO vocabulary subscription replacing
   the bespoke `:3001` websocket; provisional-receipt wiring for offline orders.
2. Phase 3 remainder: loyalty member picker + per-line assignment + auto-apply;
   GCash/PayMaya proof parity decision; BIR official-receipt modal parity
   (PNG/thermal) on the tablet checkout; per-role cancel-rule alignment with the
   web orders service (staff vs customer rules; cancel allowed states).
3. Phase 4: Inventory restructure to the web product-stock model (thresholds,
   adjustments, recipe-managed grey-out), purchase planner (PNG/PDF), suppliers
   parity, stock-history ledger parity; product option-ingredient delta editor;
   category emoji/images parity; product reviews summary.
4. Phase 5: 5-tab Analytics parity (Overview/Revenue/Customers/Fulfillment/
   Vouchers), working per-chart exports, fulfillment metrics over the mirrored
   ledger.
5. Phase 6: HR screens (7 missing: Schedule, Time Clock, Time Off, Payroll, HR
   Reviews, Documents, Training) + Team editor parity (roles/10-flag JSON);
   Stations screen parity; Tables screen parity (occupancy, moods, visit peek,
   QR download) incl. sessions/guests; staff-role vocabulary cleanup.
6. Phase 7: Reviews/Audit (reachable + web vocab + audit emission),
   Order-History filters + Official Receipt modal, Live Orders READY column
   handling + message threads + invoice modal; OrderMessage voice support.
7. Phase 8: Settings/AdminTools parity (branding, payments QR tooling, AI config,
   Account & Data), backup/restore/import adaptation.
8. Phase 9: UI/UX unification vs the live web screens (screenshot oracle),
   including removing/hiding tablet-only extras, fonts/colors/spacing/labels,
   empty/loading/error states, performance pass.
9. Phase 10: acceptance gates incl. `assembleRelease`, orphan-screen cleanup,
   destructive-fallback removal (v17 baseline), docs cleanup, owner hardware
   checklist execution.

## Evidence of verification (each round end)

- Android: `gradlew :app:testDebugUnitTest` (all unit tests incl. PinHasher,
  AccessControl, ReceiptNumbers, PcBridge payloads), `lintDebug`, `assembleDebug`.
- Web: `npm run lint` (0 errors), `npx tsc --noEmit`, `npm run test:unit` (422).
- Owner-run hardware acceptance is documented in `spec.md` (real-device sync,
  printer, mic/camera/TTS).
