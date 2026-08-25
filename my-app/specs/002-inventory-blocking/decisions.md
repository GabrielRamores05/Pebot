# Decisions — Inventory Blocking

*Technical decisions made on the builder's behalf, and business decisions they
made. Written for a developer who joins later and asks "why is it like this?"*

*The builder is not expected to read this file.*

---

### An unavailable item stops the whole order
- **Chose:** when any item in a customer's order is out of stock, the whole order
  is refused; nothing is charged and nothing is silently dropped.
- **Because:** the builder chose this in `/clarify` when asked what happens when
  only some items are unavailable. They preferred the order to wait until the
  customer changes it over quietly removing the unavailable item.
- **Rule:** spec.md — "What it does".
- **Reversible:** yes, but it changes what customers experience at checkout.

### Staff at the terminal may override an out-of-stock count; the customer menu never may
- **Chose:** the counter terminal can put an out-of-stock item through anyway when
  staff know it is available; the customer QR-menu path never can.
- **Because:** the builder chose this in `/clarify`. Stock counts can lag reality
  (a fresh batch just made), and staff should not be blocked from selling what the
  shop actually has. Customers must not be able to push an order through against
  the count.
- **Rule:** spec.md — "What it does" and the criteria.
- **Reversible:** yes, but it changes what staff can do at the counter.

### The authoritative stock check is server-side, inside the order-create transaction
- **Chose:** verify every item's stock against `Inventory.quantity` on the order
  route, inside the same transaction that deducts stock, refusing the order with a
  clear "unavailable" response when any item exceeds available stock.
- **Because:** two orders can arrive at the same moment and a client-side check
  alone cannot stop overselling; the check must sit where the deduction happens so
  it cannot be bypassed by either ordering path.
- **Rule:** spec.md — "Rules the business cares about".
- **Reversible:** yes.

### No new dependency, no schema change
- **Chose:** reuse the existing `Inventory` table (`quantity`,
  `lowStockThreshold`) and the existing deduction in the order route.
- **Because:** the schema already models stock; nothing new is required to block on
  it.
- **Rule:** `standard/stack.md`, `standard/data.md`.
- **Reversible:** yes.