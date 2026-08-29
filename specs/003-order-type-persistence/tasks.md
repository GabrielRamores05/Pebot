# Tasks — order-type-persistence

*Ordered. Tick as you go — if the session ends, the next one starts here.*

*Internal. The builder is not expected to read or approve this.*

- [x] Create spec folder, spec.md, decisions.md, plan.md.
- [x] Settle the `TO CLARIFY` items with the builder (/clarify).
- [x] Checkpoint before building.
- [x] Add `orderType` and `deliveryAddress` to the `Order` Prisma model and run a
      migration.
- [x] Accept and store `orderType` and `deliveryAddress` in `POST /api/orders`,
      defaulting to `DINE_IN`; refuse a delivery order with no address.
- [x] Send `orderType` and `deliveryAddress` from the counter terminal
      (`app/admin/terminal/page.tsx`) and block placing a delivery order without
      an address.
- [x] Show the order type on the kitchen screen, the staff order lists, the
      terminal receipt, and the customer's order page (with the delivery address
      for delivery orders).
- [x] Write `tests/acceptance/order-type-persistence.spec.ts` (one test per
      acceptance criterion).
- [x] Run `tsc --noEmit` and eslint; run `npm run build`.
- [x] Run verification: `npm run test:unit`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.

## Acceptance criteria → tests

*Every criterion in `spec.md` gets one end-to-end test. This mapping is how the
builder verifies their own software, so it must be complete before the build is
considered done.*

| Criterion (from spec.md) | Test |
|---|---|
| When I place a dine-in order at the counter terminal, then the order is saved as dine-in and the kitchen shows it as dine-in. | `tests/acceptance/order-type-persistence.spec.ts` → "dine-in order is saved and shown as dine-in" |
| When I place a takeout order at the counter terminal, then the order is saved as takeout and the kitchen shows it as takeout. | `tests/acceptance/order-type-persistence.spec.ts` → "takeout order is saved and shown as takeout" |
| When I place a delivery order at the counter terminal and type an address, then the order is saved as delivery with that address, and the kitchen and the customer's order page show the address. | `tests/acceptance/order-type-persistence.spec.ts` → "delivery order keeps its address on the kitchen and the customer page" |
| When I try to place a delivery order without an address, then the order is not placed and I am told to enter an address. | `tests/acceptance/order-type-persistence.spec.ts` → "delivery order is refused without an address" |
| When I look at a placed order's receipt or the customer's order page, then the order type is shown (dine-in, takeout, or delivery). | `tests/acceptance/order-type-persistence.spec.ts` → "order type is shown on the receipt and the customer order page" |
| When an order comes in from the QR menu (which only picks a table), then it is labelled as dine-in even though no order type was chosen. | `tests/acceptance/order-type-persistence.spec.ts` → "QR-menu order is labelled dine-in" |