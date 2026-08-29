# Plan — order-type-persistence

*Derived from `spec.md` plus the project constitution and locked technical
decisions. Nobody asked the builder to author this and nobody should. It exists
so that a build survives this session ending, or the builder switching to a
different AI tool halfway through.*

*Written during `/clarify`, once the spec is settled.*

## Recipes used

- `crud-resource.md` — the order-create API path already follows this pattern;
  this build extends an existing resource rather than creating a new one.

## Data

- **`Order`** (Prisma model): add
  - `orderType String @default("DINE_IN")` with Zod enum `DINE_IN|TAKEOUT|DELIVERY` (unknown values → `400 "Invalid order type"`)
  - `deliveryAddress String?` — set only for delivery orders
- No new tables. The existing `Order` row already carries `tableId` for dine-in.
- Access rules (from "Who uses it"):
  - Counter staff create orders, so they set `orderType` and `deliveryAddress`.
  - QR-menu orders send neither; the `DINE_IN` default covers them (they already
    send a `tableId`).
  - Read access to the new fields rides on existing order-read paths — no new
    roles or permissions.
- Migration: `npx prisma migrate dev --name order-type-persistence`.

## Screens

- **Counter terminal** (`app/admin/terminal/page.tsx`):
  - Send `orderType` and `deliveryAddress` in the `POST /api/orders` body (it
    already collects both in state; they just aren't sent).
  - Block placing a DELIVERY order with no `deliveryAddress` (client-side guard +
    rely on the server check below).
  - Receipt view already shows `orderType` from local state; that stays, and the
    saved value is the source of truth going forward.
- **Kitchen screen** (`app/admin/kitchen/page.tsx`): show the order type badge next
  to the table for each order card.
- **Staff order lists / admin dashboard** (`app/admin/page.tsx`): show order type
  where the table is shown today.
- **Customer order page** (`app/order/[orderNumber]/page.tsx`): show order type,
  and the delivery address for delivery orders, in the order-details block.
- **Order-create API** (`app/api/orders/route.ts`):
  - Accept `orderType` (default `DINE_IN`, validated via Zod enum) and `deliveryAddress`.
  - Refuse if `deliveryAddress == null || deliveryAddress.trim() === ""` for `DELIVERY` → `400 {error: "Delivery address is required"}`.

## Outside connections

- None. No email, payments, uploads, or third-party APIs involved.

## Not covered by the standard

- None. This is a standard persisted-field extension; no escalation needed.