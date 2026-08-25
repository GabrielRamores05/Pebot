# Tasks — Loyalty Automation

*Ordered. Tick as you go — if the session ends, the next one starts here.*

*Internal. The builder is not expected to read or approve this.*

- [x] Explore existing loyalty code and confirm the current trigger (fires on any
      transition to COMPLETED, including kitchen "Mark Ready").
- [x] Confirm the business flow with the builder (payment before kitchen; cashier
      marks payment = order moves to Preparing; kitchen Ready awards nothing).
- [x] Create spec folder, spec.md, decisions.md, plan.md.
- [x] Checkpoint before building.
- [x] Move the loyalty-awarding block in `app/api/orders/[id]/route.ts` off the
      COMPLETED trigger and onto the payment-confirmation trigger.
- [x] Make `app/admin/page.tsx` send the `paymentConfirmed` marker when the cashier
      moves an order to Preparing (payment action).
- [x] Verify kitchen pages (`app/kitchen/page.tsx`, `app/admin/kitchen/page.tsx`)
      send no marker, so "Mark Ready" and "Start Preparing" never award points.
- [x] Wire the order-create path (`app/api/orders/route.ts`) to award points for
      terminal orders placed as paid at the counter.
- [x] Keep `loyaltyPromo` orders earning nothing.
- [x] Write `tests/acceptance/loyalty-automation.spec.ts` (one test per acceptance
      criterion).
- [x] Run `tsc --noEmit` and eslint; run `npm run build`.
- [ ] Run `edgepoint check` and checkpoint the finished build.

## Acceptance criteria → tests

*Every criterion in `spec.md` gets one end-to-end test. This mapping is how the
builder verifies their own software, so it must be complete before the build is
considered done.*

| Criterion (from spec.md) | Test |
|---|---|
| When I confirm that a customer's order has been paid, then their loyalty card gains one point for each item they bought, without me doing anything else. | `tests/acceptance/loyalty-automation.spec.ts` → "awards points when I confirm payment" |
| When I confirm a payment, then the order moves out of Pending so the kitchen can start. | `tests/acceptance/loyalty-automation.spec.ts` → "moves the order to preparing on payment" |
| When the kitchen marks an order as ready, then no points are added to the customer's card. | `tests/acceptance/loyalty-automation.spec.ts` → "kitchen mark ready awards no points" |
| When a customer reaches the shop's threshold, then the reward appears on their card automatically. | `tests/acceptance/loyalty-automation.spec.ts` → "reward appears at threshold" |
| When an order was paid using a loyalty reward, then it earns no new points. | `tests/acceptance/loyalty-automation.spec.ts` → "loyalty promo order earns nothing" |
| When a customer orders through the QR menu and pays at the counter, then their points are added the same way as an in-store terminal order. | `tests/acceptance/loyalty-automation.spec.ts` → "terminal order awards points at placement" |