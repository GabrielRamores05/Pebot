# Tasks: Restaurant Checkout Money

**Input**: [plan.md](plan.md), [spec.md](spec.md)

## Phase 1: Foundation

- [x] T001 Test first: `tests/unit/checkout.test.ts` (the spec's worked examples), then `lib/checkout.ts`.
- [x] T002 Schema: `Order` breakdown columns, `discountHolders`, `cashSessionId`; `BusinessSettings` `vatRegistered`, `serviceChargeRate`, `serviceChargeOrderTypes`; `CashSession`, `CashMovement`.

## Phase 2: US1 + US2 (P1): discounts and one bill

- [x] T003 `modules/orders/schema.ts`: `discount` input (STATUTORY with diners + holders, or STUDENT); legacy `discountRate` capped at 100.
- [x] T004 `modules/orders/service.ts`: staff-only fields (403), `planDiscount`, bill input, drawer flag; tablet import passes `{ staff: true, source: 'tablet' }`.
- [x] T005 `modules/orders/repository.ts`: `findCheckoutSettings`; `computeCheckout` inside the order transaction; store the breakdown; add-items keeps VAT figures in step.
- [x] T006 `app/api/orders/route.ts`: pass `staff` from the session; 403; validation errors as 400.
- [x] T007 Tests: `tests/unit/modules/orders-service.test.ts` (staff-only refusal, Senior/PWD recorded, mixed table, loyalty conflict, holder count, Student rate, service charge by order type, drawer counting, tablet).
- [x] T008 Terminal: `DiscountPicker.tsx`; totals from `computeCheckout`; send `discount`; receipts from the saved breakdown; reset discount after each order.

## Phase 3: US3 (P2): service charge

- [x] T009 Settings API and screen: VAT-registered, service charge rate and order types; Student label. Hide the AI key from callers without Settings access.

## Phase 4: US4 (P1): cash drawer

- [x] T010 Test first: `tests/unit/cash-drawer.test.ts`, then `lib/cash-drawer.ts`.
- [x] T011 `modules/cash-drawer/*` and `/api/cash-drawer` (open, movements, close, by id); audit log; `tests/unit/modules/cash-drawer-service.test.ts`.
- [x] T012 Count cash orders when paid later (payment confirmation, `/api/payments`).
- [x] T013 Terminal `CashDrawerPanel.tsx` with printable shift report.

## Phase 5: US5 (P1): end of day

- [x] T014 Test first: `tests/unit/end-of-day.test.ts`, then `lib/end-of-day.ts`.
- [x] T015 `modules/reports/*`, `GET /api/reports/end-of-day`, `tests/unit/report-day-range.test.ts`.
- [x] T016 `app/admin/end-of-day/page.tsx` and the admin menu entry.

## Phase 6: Finish

- [x] T017 Apply the new schema to a scratch database built on the old schema with an existing order: no data-loss prompt, order unchanged.
- [x] T018 `npm run test:unit`, `npx tsc --noEmit`, `npm run lint`.
- [ ] T019 Owner: click through a Senior sale, a drawer open/close and End of Day in the browser.
- [ ] T020 Owner's accountant: confirm the Senior/PWD computation, the group-meal headcount split and the service charge base.
