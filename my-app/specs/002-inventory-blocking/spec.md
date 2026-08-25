# Inventory blocking

*Created 2026-08-16. This describes what the software should do, in plain language.
It contains no technology. If you find yourself writing a product or library name
here, it belongs in `plan.md` instead.*

## What this is for

When the shop runs out of something, customers should not be able to order it. Today
the menu marks an item "Out of Stock" on screen, but an order can still go through
for that item — and if two customers order the same last item at the same time, the
shop's stock count can drop below zero. This spec makes the order itself refuse an
item the shop no longer has, so the shop never sells more of a thing than it has and
a customer is told clearly, at the point of ordering, that the item is gone.

## Who uses it

- **Customers** — order from the menu. If an item is out of stock, they must not be
  able to add it, and if it runs out between them adding it and them paying, they
  are told clearly at the point of ordering.
- **Cashier / admin (counter terminal)** — places orders on behalf of walk-in
  customers. Must not be able to sell an item that is out of stock.
- **Shop owner / manager** — keeps the stock counts in the admin inventory page.
  Stock levels and thresholds are what this feature reads to decide what can be sold.

## What it does

- Refuses to create an order that includes more of an item than the shop has in
  stock, at the point the order is placed.
- Stops the **whole** order when one item is unavailable: a customer who added
  several items is not charged, and the whole order waits until they change it —
  the shop does not quietly drop the unavailable item and charge them for the rest.
- Prevents stock counts from dropping below zero, no matter how many orders arrive
  at the same time.
- Tells the customer clearly when an item they wanted is no longer available, at
  the moment they try to order it.
- Lets staff at the counter terminal sell an item anyway when the count says it is
  out of stock but they know they have some on hand (an override). The customer
  QR-menu path never overrides.

## What it does not do

- No changes to the stock-counting system itself — how the shop sets its counts,
  thresholds, or ingredient levels is untouched.
- No re-ordering or supplier notifications when stock runs low; the existing
  low-stock warning to staff stays as it is.
- No changes to what the shop displays as "low stock" vs "out of stock" on the menu
  — those labels already exist and stay.

## Rules the business cares about

- The shop never sells more of an item than it has on hand, even when two orders
  arrive at the same moment.
- A customer is never charged for an item that turns out not to exist.
- When any item in a customer's order is unavailable, the customer is told and the
  whole order stops until they change it — nothing is charged and nothing quietly
  disappears.
- At the counter terminal, a staff member may override an out-of-stock count when
  they know the item is actually available; the customer QR-menu path never may.
- Stock counts never go below zero.

## How we'll know it works

- When I place an order that includes more of an item than the shop has in stock,
  then the order is refused and I am told the item is not available.
- When I try to order an item the shop has none of, then I cannot add it to my
  order.
- When I order the last of an item, then the stock count goes to zero and a second
  order for that item is refused.
- When one item in my order runs out before I pay, then the whole order is stopped,
  I am told clearly which item is unavailable, and I am not charged for anything.
- When I place an order for items the shop has, then the order goes through as
  normal and stock is reduced by exactly what was sold.
- When I am a staff member at the counter terminal and the count says an item is
  out of stock but I know I have it, then I can put the item through anyway.

## Still to clarify

None. All business questions were settled in `/clarify`: an unavailable item stops
the whole order, and staff at the counter terminal may override an out-of-stock
count while the customer QR menu never may.

## Ideas for later

- A "running low" warning to the shop when stock is close to empty.
- Letting the shop set a per-item "sold out" switch that staff can flip from the
  kitchen, independent of the counted stock.