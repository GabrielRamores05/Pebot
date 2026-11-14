# Implementation Plan: Restaurant Checkout Money

**Branch**: `017-restaurant-money` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

## Summary

One pure bill calculation (`lib/checkout.ts`) used by both the POS terminal and the server, covering Senior Citizen / PWD (VAT removed, then 20%), Student, loyalty rewards and service charge. Each order stores its breakdown. A per-shift cash drawer and a printable end-of-day summary come with it.

## Technical Context

**Language/Version**: TypeScript (strict)

**Primary Dependencies**: Next.js 14 App Router, Prisma 5.22 + SQLite, Zod 4

**Storage**: Additive schema changes only: new `Order` columns with defaults, new `BusinessSettings` columns with defaults, new `CashSession` and `CashMovement` tables. Installed apps apply them with `prisma db push` at startup.

**Testing**: Vitest. Pure functions first, then services with mocked repositories.

**Constraints**: Offline, LAN-only. Money rounded to the centavo once per order, with parts that add up to the total.

## Constitution Check

| Principle | Result |
|-----------|--------|
| I. Local-first, offline | Pass. |
| II. Access checks | Pass. Drawer routes need POS Terminal; end-of-day needs Analytics; discounts, payment confirmation and stock override on `POST /api/orders` now need a signed-in staff member. |
| III. Thin routes, repositories own the database | Pass. New `modules/cash-drawer` and `modules/reports`. The settings route still queries Prisma directly, as before; it is listed for the cleanup spec. |
| IV. Tests first | Pass. `checkout`, `cash-drawer`, `end-of-day` and the drawer service tests were written before the code they cover. |
| VII. No silent data loss | Pass. Additive schema, checked against a scratch database built on the old schema with an existing order (see quickstart). Old orders are not rewritten. |
| VIII. Licensing | Not touched. |

## Decisions

1. **One calculation, two callers.** `computeCheckout` runs in the browser for the live total and in the order transaction on the server. The server never trusts amounts from the browser; it gets only the discount *kind*, the diner count and the ID holders.
2. **Order of steps**: items → loyalty reward → discount → service charge. This matches what the server already did; the terminal was the one out of step.
3. **Senior/PWD**: share = holders ÷ diners. On the share of VAT-able items: VAT removed, then 20% off the VAT-exclusive price, and the rest is a VAT-exempt sale. Not VAT-registered: 20% off the price. Refused together with a loyalty reward.
4. **Rounding**: discount and VAT removed are rounded once; VAT-able sales and VAT are derived from what is left, so VAT-able + VAT + exempt always equals the bill before service charge.
5. **Service charge** on the bill after discounts, outside the VAT breakdown, only for the order types the owner picks.
6. **Cash drawer**: one open session per location, created in a transaction. A cash order is counted when it is paid at this PC: at creation with payment confirmed, on later payment confirmation, or through `/api/payments`. Tablet imports are never counted. Expected cash is frozen at close.
7. **End of day** groups by the PC's local day. Orders saved before this spec are rebuilt as gross = total + discount and reported as having no VAT breakdown.
8. **Two security fixes found on the way** (in scope because they touch the money path):
   - `POST /api/orders` accepted `discountRate` with no limit, `paymentConfirmed` and `overrideStock` from anyone. These fields now need a signed-in staff member.
   - `GET /api/settings/business` returned the AI service key to anyone. It now leaves the key out unless the caller has Settings access.

## Project Structure

```text
my-app/
├── lib/checkout.ts, lib/cash-drawer.ts, lib/end-of-day.ts   # pure, tested
├── modules/orders/{schema,service,repository}.ts           # discount input, staff check, bill in transaction
├── modules/cash-drawer/{repository,service}.ts
├── modules/reports/{repository,service}.ts
├── app/api/cash-drawer/**, app/api/reports/end-of-day/
├── app/api/orders/route.ts, app/api/settings/business/route.ts
├── app/admin/terminal/{page,DiscountPicker,CashDrawerPanel}.tsx
├── app/admin/end-of-day/page.tsx, app/admin/settings/page.tsx
└── prisma/schema.prisma
```

## Not verified

- The terminal, drawer and End of Day screens have not been clicked through in a browser. They are covered by type checks, and the calculations behind them are unit-tested.
- Not checked against a real accountant's computation. See the spec's assumptions.
