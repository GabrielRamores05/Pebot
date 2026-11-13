# CaféOS — Full-System QA Plan

Author: Kilo (DeepSeek harness) · Date: 2026-11-03 · Target: `my-app/` on http://localhost:3000

---

## 0. Objective

Screenshot **every page**, exercise the **whole system** (customer, kitchen, staff/admin), and return a
prioritised QA report with evidence and repro steps. No product behavior is changed except reversible
test data.

---

## 1. How the system works (recon)

### Runtime
- **Next.js 14.2.35 / React 18.2.0**, App Router, served by a **custom `server.js`** (not `next dev` directly).
- `server.js`: HTTP server on `0.0.0.0:3000`, **Socket.IO** on path `/api/socket`, mDNS advertise
  `SMART CafeOS` (`smartcafeos.local`), and a best-effort redirect server on port 80 (often `EADDRINUSE`).
- **SQLite** via Prisma 5.22.0 (`prisma/dev.db`); generated client at `lib/prisma-client`.
- Local-first: no cloud backend; all data on the location PC.

### Roles & gating
- JWT payload roles: `ADMIN`, `STAFF`, `KITCHEN` (+ `permissions` map for STAFF/KITCHEN).
- `lib/auth.ts`: `cafeos-token` cookie, HS256, 12h; `requireRole`, `requirePermission`, `withSubscriptionCheck`.
- Subscription features (`lib/subscription.ts`): `analytics, inventory, staff, settings, kitchen, loyalty`.
  ADMIN bypasses; STAFF/KITCHEN need the permission flag.
- `/admin/layout.tsx` → client guard (`AdminLayoutClient`); `/kitchen` redirects to `/login?next=/kitchen`.

### Primary flows
1. **Customer**: `GET /menu?table=<slug>` → add to cart (`store/cartStore.ts`) → `/cart` → place order →
   `/order/<orderNumber>` → optional `/menu/reviews`, `/loyalty`. QR endpoint `/api/tables/qr` mints
   `…/menu?table=<slug>`.
2. **Staff/Admin**: `/login` → `/admin` and 22 admin sub-pages.
3. **Kitchen**: `/kitchen` live board (Socket.IO `join-room`, `order-status-update`).

### Data model (47 models, key ones)
User, Subscription, POSLicense, Category, Product, ProductOption/Group, Ingredient + transactions,
Supplier, RestaurantTable, TableSession, TableGuest, Order/OrderItem/OrderMessage, Review,
Inventory, Setting/BusinessSettings/LoyaltySetting, LoyaltyCard/Transaction/Voucher/RewardHistory,
PaymentTransaction, StaffStationControl, AuditEvent, AI* (consultant), Expense*, Shift, Schedule,
Attendance, Leave*, Payroll, PerformanceReview, StaffDocument, Training/StaffTraining.

### Seed state (verified via Prisma probe)
- Users: `admin@cafeos.local` / `admin123` (ADMIN), `staff@cafeos.local` / `staff123` (STAFF).
- Categories **1** (Coffee), Products **2** (e.g. Americano ₱120), Tables **8** (`t1`…`t7`, `4-top-round-table`),
  TableSessions **3**, Ingredients **3**, Orders **0**, LoyaltyCards **0**.
  → **Thin dataset**: customer-flow tests will rely on the 2 products and must create/cleanup their own data.

---

## 2. Scope

**In scope**: all 33 web pages; ~95 API route files; customer / kitchen / staff / admin flows; DB writes &
cleanup; console errors, failed requests, a11y-basic, desktop + mobile viewports; existing test suites.

**Out of scope (noted, not driven)**: Android tablet app `cafeos-tablet/` (Gradle/APK) — only its
`/api/tablet/*` contract is checked; Electron packaging; real QR-scan hardware; mDNS on other devices.

---

## 3. Tools & skills (from skills.sh)

| Skill (skills.sh) | Repo | Use |
|---|---|---|
| **agent-browser** | `vercel-labs/agent-browser` | Primary driver: navigate, click, type, **screenshot**, a11y snapshot, `@eN` refs, JS eval, cookies/session |
| webapp-testing | `anthropics/skills` | Test-design reference (unit/integration/e2e) |
| playwright-cli | `microsoft/playwright-cli` | Fallback/adjacent live-browser control |
| verification-before-completion | `obra/superpowers` | Final verification pass before reporting |

Install: `npm i -g agent-browser && agent-browser install` then `agent-browser skills get core`.
Also in-repo: `npm run test:unit` (Vitest) and `tests/acceptance/*.spec.ts` (Playwright specs — **no
`playwright.config.*` currently present**, so these are checked for runnability as a finding).

---

## 4. Page inventory (screenshot list)

**Customer / public (10)**: `/`, `/menu`, `/menu?table=t2`, `/cart`, `/order/<num>`, `/loyalty`,
`/menu/reviews`, `/login`, `/unauthorized`, `/exit`
**Kitchen (1)**: `/kitchen`
**Admin (22)**: `/admin`, `/admin/analytics`, `/admin/audit-logs`, `/admin/consultant`, `/admin/customers`,
`/admin/expenses`, `/admin/fulfillment`, `/admin/inventory`, `/admin/kitchen`, `/admin/loyalty`,
`/admin/order-history`, `/admin/products`, `/admin/revenue`, `/admin/reviews`, `/admin/settings`,
`/admin/settings/loyalty`, `/admin/settings/subscription`, `/admin/staff`, `/admin/stations`,
`/admin/stock-history`, `/admin/tables`, `/admin/terminal`, `/admin/vouchers`

Each page captured at **desktop (1440×900)** and **mobile (390×844)**, full-page, in both
**unauthenticated** and (where relevant) **authenticated** states.

---

## 5. Test matrix

| # | Area | What to verify | Method |
|---|---|---|---|
| A | Availability | Every route renders; no 500/blank; correct redirect matrix | agent-browser navigate + capture console/network errors |
| B | AuthN/AuthZ | login success/fail; `/admin/*` & `/kitchen` blocked when logged out; STAFF vs ADMIN differences; `/unauthorized` | cookies + direct nav; assert redirects |
| C | Customer flow | table select (`?table=`), add product + options, cart totals, place order, `/order/<num>` status | full interaction pass |
| D | Kitchen | new order appears (Socket.IO), status transitions, customer↔kitchen messages | two sessions (customer + kitchen) |
| E | Admin modules | products, categories, tables, stations, inventory/ingredients, staff, expenses, vouchers, loyalty, customers, order-history, analytics/revenue/fulfillment, audit-logs, reviews, terminal, settings(+loyalty/subscription), stock-history, consultant | read every page; write on a **copied disposable record** then revert/delete |
| F | API contract | auth guards return 401/403; zod validation 400s; enum/ID errors; happy paths | targeted calls (curl/Invoke-RestMethod) |
| G | POS invariants (AGENTS.md) | no `prisma.*` outside `modules/**`; **no client-supplied peso trusted**; grant+consume in one transaction; audit events written | static grep + behavior probes |
| H | Data integrity | created records visible via API; orphan/mismatch checks; **cleanup** | DB re-probe after flows |

---

## 6. Evidence & reporting

- Screenshots → `.qa/<YYYY-MM-DD>/desktop/<route>.png`, `.qa/<YYYY-MM-DD>/mobile/<route>.png`.
- Per-page JSON log (URL, status, console errors, failed requests, screenshot path) → `.qa/<date>/log.json`.
- Findings table (id, **severity** Blocker/Critical/Major/Minor/Trivial, area, steps, expected, actual,
  evidence, suspected cause `file:line`).
- Final report: `docs/qa/cafeos-qa-report-<date>.md` (or chat summary if docs not desired).

---

## 7. Exit criteria

1. All 33 routes reachable + screenshotted at both widths.
2. Flows C & D pass end-to-end, or each failure has a repro + evidence.
3. `npm run test:unit` executed; acceptance-spec runnability determined.
4. Every finding has severity, evidence, and repro.
5. **No test artifacts left** (orders/products/tables/scripts reverted; temp scripts deleted).
6. Report delivered.

---

## 8. Safety / constraints

- Never weaken a test to pass; never commit; restore or delete all test data.
- Do not touch financial records destructively; prefer create→verify→delete on disposable rows.
- Delete temporary scripts (e.g. DB probes) before calling it done.
- The running dev server is a managed background process (`bgp_1a3574d5a001zi17UBMkQO3E9S`).

---

## 9. Execution order

1. Install + init **agent-browser**; load `skills get core`.
2. Confirm server health; capture redirect matrix (A) + screenshots.
3. AuthN/AuthZ (B).
4. Customer flow (C) → Kitchen (D) with Socket.IO evidence.
5. Admin sweep (E) — read all, write on disposable records.
6. API contract (F) + invariants (G) + unit suite.
7. Re-probe DB, clean up, write report.
