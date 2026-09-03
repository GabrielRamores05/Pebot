# Decisions — tablet-full-staff-parity (spec 013)

*Technical decisions made on the builder's behalf, and business decisions the owner
made. Written for a developer who joins later and asks "why is it like this?"*

*The owner is not expected to read this file.*

---

## Scope: tablet = staff/admin/kitchen parity; PC stays the host

- **Chose:** the Android tablet replicates the Windows staff/admin/kitchen surfaces
  (Live Orders, New Order/terminal, Analytics, Products, Inventory, Stock History,
  Expenses, Loyalty, Order History, Reviews, Staff/HR, Tables, Stations, Kitchen,
  Settings, Consultant, Audit Logs) with identical UI/UX. The customer QR channel
  (`/menu`, `/cart`, `/order/[n]`, `/exit`, review walls) stays on the Windows PC.
- **Because:** owner chose this deployment (asked 2026-09-04): "the Windows PC remains
  the store host that serves customers' phones; the tablet becomes a 100%-parity staff
  terminal." Spec 012's customer-menu exclusion therefore stands, but now everything
  else must reach 100%.
- **Reversible:** yes — the tablet can later add standalone host mode behind a toggle.

## Ledger authority: the PC is the single café ledger

- **Chose:** the PC database is the canonical store ledger. Online, the tablet pushes
  every order, status change, message, stock movement, attendance, and audit event to
  the PC over the LAN and pulls catalog/settings/loyalty/staff/vouchers + deltas. Offline,
  the tablet keeps selling with a clearly-marked state and a tablet-prefixed provisional
  receipt series; on reconnect it syncs (idempotent by orderNumber; server wins on
  conflict) and the PC imports offline records as a documented separate series.
- **Because:** owner chose this (asked 2026-09-04). It keeps one book of record for
  receipts/analytics/kitchen, preserves the local-first rule (nothing depends on the
  WAN), and avoids dual-master conflict risk in a single café.
- **Rule:** constitution §III — value (discounts, vouchers, loyalty) is derived
  server-side on the PC from records, never from tablet-sent pesos; the tablet's offline
  path runs the same logic locally and is re-validated at sync.
- **Reversible:** yes with effort — flipping to full bidirectional sync later is the
  harder option that was explicitly not chosen.

## Touch login stays PIN-based but role semantics match the web

- **Chose:** keep the tablet's 6-digit PIN login (faster on a kiosk touchscreen; prior
  tablet research decision D4) while making its semantics identical to the web: roles
  ADMIN/STAFF/KITCHEN and the same 10 permission flags; auto clock-in on login and
  clock-out on logout exactly like the web; PINs stored hashed; no insecure fallback
  master PIN.
- **Because:** the owner asked for the same UI/UX, but typing an email+password on a
  cash-register tablet is a worse UX for the same authorization intent; the semantics,
  not the input method, are what must not diverge.
- **Reversible:** yes — the login screen can be swapped later without touching rules.

## Tablet-only UI is hidden by default; the web is the reference

- **Chose:** the tablet's default experience mirrors the web app's navigation and
  screens exactly. Tablet-only extras with no web counterpart (floor-plan view, CSV
  tools, daily-quota card, standalone stock-history route, "Host POS" customer serving)
  stay in code behind Settings toggles, default off.
- **Because:** "the UI/UX should be the same" means a staff member switching between PC
  and tablet sees the same thing; hidden extras avoid confusing drift while keeping
  existing tablet capabilities available.
- **Reversible:** yes — flip toggles or promote extras later.

## Visual identity = the live web app, screen by screen

- **Chose:** the UI/UX parity reference is the **current rendering of the web app**
  (warm amber/cream/stone Tailwind look), not the moss-green `docs/design-system.md`
  tokens alone — the live web is internally mixed (≈300 `amber-*` vs 50 `pos-accent`
  usages in admin), so a screenshot oracle per screen is the only faithful source.
- **Because:** "the same UI/UX" can only mean matching what staff actually see on the
  PC today.
- **Reversible:** yes — if the web is later unified onto the design-system tokens, the
  screenshot oracle is regenerated and the tablet follows.

## DB integrity fixes precede feature work

- **Chose:** remove `fallbackToDestructiveMigration` and write real Room migrations
  (data preserved), wrap order placement and import in single `@Transaction`s with id
  remapping, hash PINs, and delete the committed keystore password before any new
  feature work.
- **Because:** constitution §III/§VII (no silent data loss, append-only records) — a
  tablet schema bump currently wipes the café's local POS data.
- **Reversible:** n/a (bug fix).

## Tablet ↔ PC bridge uses the web's Socket.IO vocabulary

- **Chose:** replace the tablet's bespoke WebSocket (`:3001/pebot-sync`) client with a
  Socket.IO client against the web server (`/api/socket`, events per the registry in
  `specs/012-tablet-comprehensive-parity/contracts/data-sync.md`), plus REST for pulls
  and ledger writes, authenticated by an admin-issued, revocable device credential
  scoped to the operating staff's role.
- **Because:** the web server already speaks Socket.IO (`my-app/server.js`); the tablet's
  current raw-WebSocket protocol cannot reach it, so no live tablet↔PC behavior exists
  today. Device pairing keeps the PC's two-trust-zone model intact (a PIN-locked tablet
  never weakens the PC's role checks).
- **Reversible:** yes — protocol behind one sync module.

## DB v18 field-parity batch (Phase 0, 2026-09-04)

- **Chose:** one Room migration 17→18 adding the Windows-parity columns that staff/admin
  screens and the PC ledger bridge need immediately: Orders (deliveryAddress, notes,
  loyaltyCustomerName, loyaltyPromo, queueNumber, updatedAt, unique orderNumber),
  Payment.amount (charged amount = tendered − change), OrderMessage.type (text|voice),
  BusinessSettings (footerMessage, loyaltyEnabled, studentPwdDiscountRate, AI block),
  Staff HR profile fields (address, DOB, hire date, position, department, photo,
  emergency contacts, hourlyRate, monthlySalary, paymentType, updatedAt), Review
  (customerName, tasteSuggestion, imageUrl), CafeTable (slug, updatedAt),
  Expense.categoryId, IngredientTransaction (referenceId/referenceType).
- **Because:** the field-level diff (spec 013 plan.md §0 evidence, Prisma↔Room) shows
  these are the columns the web UI/API and a tablet↔PC sync need; adding them with
  defaults/nullability keeps the migration metadata-only (no table rebuilds).
- **Deferred (own later migrations when their screens are built):** option-cluster
  remodel, LoyaltyVoucher/LoyaltySetting semantics, date-based Schedule/Shift, typed
  LoyaltySetting, Inventory product-stock rows, Training catalog, locationId columns
  (single-location store; the PC normalizes).
- **Reversible:** no (migration), but reversible in the sense of forward-only additive.

## Migration fallback policy (Phase 0)

- **Chose:** keep `.fallbackToDestructiveMigration()` only as the path for upgrades from
  pre-v17 builds (which have no migration history), while every versioned change from
  v17 onward ships as a real Room migration. Remove the fallback in Phase 10 once the
  v17 baseline is confirmed in the field.
- **Because:** pre-v17 installs cannot be migrated without reconstructing 16 historical
  schema states from git; the historical behavior was destructive anyway. Data on any
  current (v17+) install is now preserved across schema changes.
- **Reversible:** yes.
