# Tasks — Inventory Blocking

*Ordered. Tick as you go — if the session ends, the next one starts here.*

*Internal. The builder is not expected to read or approve this.*

- [x] Create spec folder, spec.md, decisions.md, plan.md.
- [x] Settle the `TO CLARIFY` items with the builder (/clarify).
- [x] Checkpoint before building.
- [x] Add a server-side stock check to the order-create path
      (`app/api/orders/route.ts`) that refuses an order containing more of an item
      than the shop has, inside the existing transaction.
- [x] Keep stock counts from going below zero even when two orders arrive together.
- [x] Surface a clear "item unavailable" message to the customer at the point of
      ordering (menu page) when any item in their order is out of stock — the whole
      order stops.
- [x] Let the counter terminal (`app/admin/terminal/page.tsx`) override an
      out-of-stock count; the customer menu never may.
- [x] Write `tests/acceptance/inventory-blocking.spec.ts` (one test per acceptance
      criterion).
- [x] Run `tsc --noEmit` and eslint; run `npm run build`.
- [x] Run `edgepoint check` and checkpoint the finished build.

## Acceptance criteria → tests

*Every criterion in `spec.md` gets one end-to-end test. This mapping is how the
builder verifies their own software, so it must be complete before the build is
considered done.*

*(Filled in once the spec settles during `/clarify`.)*

| Criterion (from spec.md) | Test |
|---|---|
| When I place an order that includes more of an item than the shop has in stock, then the order is refused and I am told the item is not available. | `tests/acceptance/inventory-blocking.spec.ts` → "refuses an order that oversells an item" |
| When I try to order an item the shop has none of, then I cannot add it to my order. | `tests/acceptance/inventory-blocking.spec.ts` → "cannot add an out-of-stock item" |
| When I order the last of an item, then the stock count goes to zero and a second order for that item is refused. | `tests/acceptance/inventory-blocking.spec.ts` → "second order refused once the last is sold" |
| When one item in my order runs out before I pay, then the whole order is stopped, I am told clearly which item is unavailable, and I am not charged for anything. | `tests/acceptance/inventory-blocking.spec.ts` → "whole order stops when an item runs out" |
| When I place an order for items the shop has, then the order goes through as normal and stock is reduced by exactly what was sold. | `tests/acceptance/inventory-blocking.spec.ts` → "normal order succeeds and deducts stock" |
| When I am a staff member at the counter terminal and the count says an item is out of stock but I know I have it, then I can put the item through anyway. | `tests/acceptance/inventory-blocking.spec.ts` → "staff can override an out-of-stock count at the terminal" |