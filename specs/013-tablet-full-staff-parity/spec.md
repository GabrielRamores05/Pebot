# Spec 013: Tablet Full Staff/Admin/Kitchen Parity

## Status

- **Type**: Feature parity / platform port (brownfield, `cafeos-tablet/` vs `my-app/`)
- **Status**: APPROVED (2026-09-04, session plan approval)
- **Priority**: High — the tablet is the second product surface of CaféOS and must behave and look like the web app.
- **Scope decisions (owner, 2026-09-04)**:
  1. Full **staff/admin/kitchen** parity only. The Windows PC stays the store host and keeps serving customers' phones; the customer QR channel (`/menu`, `/cart`, `/order/[n]`, `/exit`, review walls) is **out of scope** for the tablet.
  2. **PC is the single café ledger.** The tablet mirrors shared business data from the PC, pushes every order/status/stock movement to the PC in real time over the LAN, and falls back to a clearly-marked offline mode (tablet-prefixed provisional receipt series) that syncs when the PC returns.

## What this is for

Today the Android tablet (`cafeos-tablet/`) looks and behaves differently from the
Windows/web CaféOS app (`my-app/`): its navigation, theme, and many screens diverge;
eleven screens are compiled but not reachable; the whole HR module, stations, reviews,
audit log, AI consultant, stock history, and floor-plan/session surfaces have no usable
UI; known functional bugs exist (unavailable products sellable, kitchen station filter
no-op, non-transactional writes, destructive DB migration, plaintext PINs); and its
sync channel cannot talk to the Windows server at all. Spec 013 closes every one of
those gaps so a café can run the tablet as a full staff terminal next to the PC host
with **the same screens, the same behavior, the same look, and no errors**.

## Who uses it

- **Admin** — full access: everything below, plus Staff, Settings, Consultant, Audit Logs.
- **Staff (counter)** — Live Orders, New Order (terminal), Analytics, Products, Inventory, Stock History, Expenses, Loyalty, Order History, Reviews, Tables, Stations, per the same 10 permission flags the web uses.
- **Kitchen** — the Kitchen Display and Live Orders read view; cannot open staff/admin management.
- **Customers** — unaffected (they keep using the PC-hosted menu on their phones).

## What it does

- Mirrors the Windows staff/admin/kitchen surfaces 1:1 on the tablet: same navigation order and home-tab model, same screens, same fields/actions/dialogs, same wording and validation messages, same colors/layout.
- Keeps the PC as the store's single ledger: tablet orders, status changes, messages, stock movements, attendance, and audit events are pushed to the PC over the LAN; catalog/settings/loyalty/staff/vouchers are pulled from the PC and kept current; when the PC is unreachable the tablet keeps working offline with provisional receipts and syncs on reconnect.
- Enforces the web's role/permission model (ADMIN / STAFF / KITCHEN + the 10 flags: liveOrders, terminal, tables, analytics, products, inventory, kitchen, loyalty, staff, settings).
- Behaves identically on order lifecycle (PENDING → PREPARING → READY → COMPLETED, CANCELLED rules), order types (Dine-in / Takeout / Delivery + address), discounts (settings-driven Student/PWD %; vouchers), receipts (single PC sequence online; prefix series offline), kitchen messages, follow-ups, analytics, audit, and payroll.
- Treats "no errors" as a hard requirement: §How we'll know below and the parity matrices in `plan.md` drive every task; nothing fails silently; every write path is transactional; the app never destroys data on schema change.

## What it does not do

- It does **not** put the customer QR ordering channel on the tablet (per scope decision 1) — customers keep ordering through the Windows PC host.
- It does **not** turn the tablet into the store's host by default. The existing tablet "Host POS"/customer-menu web server stays in code behind a Settings toggle, default off.
- It does **not** process real payments or add PCI-scope features — payments remain recorded (Cash / GCash / PayMaya with QR + proof screenshot), never gateway-integrated.
- It does **not** weaken or replace the PC's security model: the tablet bridge uses revocable admin-issued device credentials scoped to the acting staff role, and every PC API guard stays in place.

## Rules the business cares about (parity invariants)

1. One store, one ledger on the PC. A tablet sale appears on the PC kitchen/live-orders/analytics in real time; tablet and PC totals always agree after sync.
2. Receipt numbers stay sequential and immutable. Online: PC assigns the number in the finalize transaction. Offline: the tablet prints its own clearly-prefixed provisional series (never reused, never renumbered) and the PC imports those records as a separate documented series.
3. Money and value are never computed from a client's pesos. The tablet sends items and discount identities; the PC derives totals, voucher redemptions, loyalty points, and change — in one transaction. Offline tablet rules are the same logic, run locally and re-validated on sync (server-wins).
4. Staff can only see/do what the web would let them: identical roles, identical 10 permission flags, identical admin-only areas.
5. Nothing destructive happens without the same confirmation the web shows (e.g. restore countdown), and nothing is ever deleted from the append-only audit trail.

## How we'll know (acceptance criteria)

1. **Matrix A (screens)** — every row is ✅: for each Windows staff/admin/kitchen surface there is a reachable tablet screen with the same layout, labels, fields, flows, states, and colors (side-by-side against reference screenshots of the live web app).
2. **Matrix B (cross-cutting)** — every row is ✅: status model, order types, messages/follow-up, discount & value rules, receipts/numbering, realtime event vocabulary, catalog mirroring, permissions, data integrity (migrations, transactions, import id-remap), security fixes, and known-bug fixes all match the web behavior.
3. **No-errors gates green**: web `npm run lint` (0 errors), `npx tsc --noEmit`, `npm run test:unit`; Android `gradlew :app:lintDebug`, `:app:testDebugUnitTest`, `:app:assembleDebug` (+ `assembleRelease` at the end); new unit tests exercise the real ViewModel/business functions; no stub/TODO code in reachable paths; no orphaned screens in the final app.
4. **Ledger integration**: with the PC reachable, a tablet order/status/stock change appears on the PC in real time; with the PC unreachable, the tablet sells offline with provisional receipts and a clear "offline — will sync" state; on reconnect the reconciliation report matches exactly.
5. **Run-through**: per module × per role (ADMIN, partial-permission STAFF, KITCHEN), every screen opens, loads real data, and every action succeeds or shows the web-identical validation/error message; an end-to-end order lifecycle and an offline drill pass.
6. **Owner-run hardware acceptance** (documented in the checklist, cannot run on this machine): real tablet ↔ PC sync on hardware, receipt printing to a real printer, camera/mic, and TTS voices.

## Exclusions

- Customer QR ordering channel (scope decision 1).
- Tablet "Host POS" customer serving, default off (Settings toggle).
- Anything that would add a cloud backend or gateway payments.

## Reference documents

- Approved plan with full parity matrices A/B and phases 0–10: `plan.md` (approved 2026-09-04).
- Constitution: `.specify/memory/constitution.md`.
- Prior tablet parity specs: `specs/008..012`; sync/export contracts: `specs/012-tablet-comprehensive-parity/contracts/`.
- Owner decisions and technical decisions log: `decisions.md`.
- Live design reference: web screens in `my-app/app` (screenshot oracle per `plan.md` §6).
