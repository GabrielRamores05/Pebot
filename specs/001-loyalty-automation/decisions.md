# Decisions — Loyalty Automation

*Technical decisions made on the builder's behalf, and business decisions they
made. Written for a developer who joins later and asks "why is it like this?"*

*The builder is not expected to read this file.*

---

### Payment confirmation = the cashier moving the order out of Pending
- **Chose:** The cashier confirms payment by moving a QR order from Pending to
  Preparing. That single action awards the points and tells the kitchen to start.
  The kitchen's later "Mark Ready" (Completed) awards nothing.
- **Because:** the builder described the real flow in `/clarify`: customers order,
  pay at the counter *before* the kitchen starts, and the cashier's payment action
  is what starts the order moving. Awarding points on the old "Completed" trigger
  gave points to kitchen-ready orders, and the kitchen can hit that status before
  money changes hands.
- **Rule:** spec.md acceptance criteria.
- **Reversible:** yes, but it changes what customers earn points for.

### The awarding action is marked as a payment confirmation
- **Chose:** The cashier's payment action sends an explicit `paymentConfirmed`
  marker with the status change; the route awards points only when that marker is
  present. Kitchen screens never send it, so they can never award points.
- **Because:** the kitchen and cashier share the same order endpoint, and the
  kitchen's own "Start Preparing" also sets the Preparing status. Distinguishing
  by status alone cannot tell the cashier's payment from the kitchen's prep.
- **Rule:** spec.md — "What it does".
- **Reversible:** yes.

### Loyalty logic stays server-side, shared by both ordering paths
- **Chose:** the awarding happens in the order server code, so QR-menu orders and
  terminal orders behave identically.
- **Because:** the acceptance criterion says both paths must earn points the same
  way, and duplicating the logic in two client pages is how it drifts apart.
- **Rule:** spec.md acceptance criteria.
- **Reversible:** yes.

### Terminal orders are paid at the moment they are placed
- **Chose:** in-store terminal orders capture payment (cash/GCash) at the point of
  sale, so they earn points when the order is created as paid.
- **Because:** the builder confirmed payment happens before the kitchen starts;
  at the terminal that means at order placement. The loyalty rule must treat the
  terminal's order-creation as its payment-confirmation moment, in the same way
  the cashier's action is the payment moment for a QR order.
- **Rule:** spec.md — "What it does".
- **Reversible:** yes.

### Orders paid with a reward earn nothing
- **Chose:** an order using a loyalty reward (`loyaltyPromo`) earns no new points.
- **Because:** the current code already skips these, and the spec keeps that rule
  ("buy 10 get 1 free should not also earn points on the free item").
- **Rule:** spec.md "What it does not do".
- **Reversible:** yes.

### No new dependency, no schema change
- **Chose:** reuse the existing `LoyaltyCard`, `LoyaltySetting`, `LoyaltyVoucher`
  tables and the existing awarding logic — relocated to fire at payment
  confirmation.
- **Because:** the schema already models everything the spec needs; nothing new
  is required to build it.
- **Rule:** `standard/stack.md`, `standard/data.md`.
- **Reversible:** yes.