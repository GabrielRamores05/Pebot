# order-type-persistence

*Created 2026-08-16. This describes what the software should do, in plain language.
It contains no technology. If you find yourself writing a product or library name
here, it belongs in `plan.md` instead.*

## What this is for

The counter terminal already lets staff mark an order as Dine-in, Takeout, or
Delivery, and collects a delivery address for delivery orders — but none of that is
saved with the order. The moment the order is placed, the shop loses whether it was
for a table, to go, or for delivery, and the address for delivery orders is gone
too. This spec makes the order type and delivery address stick to the order, so
the kitchen, the receipt, and the staff looking at an order later all see how that
order was meant to be served.

## Who uses it

- **Cashier / admin (counter terminal)** — already chooses Dine-in, Takeout, or
  Delivery and types a delivery address. What they choose must be saved with the
  order, not thrown away.
- **Kitchen staff** — sees the orders as they come in. Must be able to tell at a
  glance whether an order is for a table, to go, or for delivery, so they pack or
  plate it the right way.
- **Customers** — see their order's status after ordering. Should see how their
  order will be served (table, takeout, or delivery). They keep picking a table on
  the QR menu as they do today — they don't choose the order type themselves.

## What it does

- Saves the order type (Dine-in / Takeout / Delivery) with the order when it is
  placed, so it is never lost.
- Saves the delivery address for delivery orders, so the kitchen and staff can see
  where the order goes.
- Requires a delivery address before a delivery order can be placed — a delivery
  order never sits with no place to go.
- Shows the order type wherever an order is looked at: the kitchen screen, the
  receipt, the staff order lists, and the customer's order status page.
- Marks every order with a sensible default when no type was chosen, so QR-menu
  orders (which today only pick a table) are counted as dine-in.

## What it does not do

- No changes to how customers pick a table on the QR menu, and no order-type
  choice for QR-menu customers — that stays with the counter staff.
- No delivery routing, courier tracking, delivery fees, or contact with riders.
- No re-asking customers for their order type mid-flow; this is about keeping the
  choice that is already made.
- No changes to the takeout pickup flow or how the kitchen marks orders done.

## Rules the business cares about

- An order's type (table / takeout / delivery) is never lost after it is placed.
- A delivery order never loses its address, and a delivery order can't be placed
  without one.
- Staff and kitchen can always tell how an order is meant to be served.

## How we'll know it works

<!-- Acceptance criteria. Each one written as something the builder could sit down
and try themselves. These become the automated tests, one for one. -->

- When I place a dine-in order at the counter terminal, then the order is saved as
  dine-in and the kitchen shows it as dine-in.
- When I place a takeout order at the counter terminal, then the order is saved as
  takeout and the kitchen shows it as takeout.
- When I place a delivery order at the counter terminal and type an address, then
  the order is saved as delivery with that address, and the kitchen and the
  customer's order page show the address.
- When I try to place a delivery order without an address, then the order is not
  placed and I am told to enter an address.
- When I look at a placed order's receipt or the customer's order page, then the
  order type is shown (dine-in, takeout, or delivery).
- When an order comes in from the QR menu (which only picks a table), then it is
  labelled as dine-in even though no order type was chosen.

## Still to clarify

None. All business questions were settled in `/clarify`: a delivery order
requires an address before it can be placed, and choosing the order type stays
with the counter staff — QR-menu customers keep picking a table as today.

## Ideas for later

- Letting the QR menu choose Takeout or Delivery too.
- A separate "delivery order" view for the kitchen so delivery orders queue apart
  from table orders.