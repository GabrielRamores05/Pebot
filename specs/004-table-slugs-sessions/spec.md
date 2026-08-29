# table-slugs-sessions

*Created 2026-08-16. This describes what the software should do, in plain language.
It contains no technology. If you find yourself writing a product or library name
here, it belongs in `plan.md` instead.*

## What this is for

When a customer scans the QR sticker on a table, the app knows which table they
are at and starts a "visit" (a table session) for that table. But that visit is
not connected to their orders: an order only records the table, not the visit it
was part of, and the visit's id is held in the customer's phone in a way that
disappears if the page refreshes. The shop therefore cannot look at a table's
current visit and see everything that group ordered. This spec links each order
to the table visit it belongs to, and makes the QR link for a table stable — so
the link keeps working even if the table is renamed later.

## Who uses it

- **Customers** — scan a table's QR sticker to order from their seat. Their
  orders must be tied to that table visit, even if their phone refreshes between
  orders.
- **Counter staff / manager** — sees orders on the dashboard and the table's
  status on the tables screen. Should be able to see everything a seated group
  has ordered during their visit.
- **Shop owner** — renames tables from time to time (admin tables page). A rename
  must not break the printed QR stickers already on the tables.

## What it does

- Gives each order placed from a table's QR link the id of that table visit, so
  the order can always be traced back to the visit.
- Remembers the table visit on the customer's device, so a refresh (or a second
  order later in the same visit) keeps the same visit — no orphan orders.
- Shows a seated group's orders together where staff look at a table or its
  orders — the tables screen and the order dashboard both show everything the
  current visit has ordered in one place.
- Gives each table a stable link for its QR sticker, so renaming a table does not
  break the stickers already printed.
- Puts every order into the right visit automatically: when a new group scans a
  table's QR and the last visit has clearly ended (`TableSession.exitTime NOT NULL` or `>30m` since last order and table not `OCCUPIED`), the new group's orders start a
  fresh visit and are never mixed with the previous group's.

## What it does not do

- No changes to how customers find a table, pick seats, or register as guests.
- No splitting bills or per-guest charges — orders are grouped per visit, not per
  person.
- No changes to the QR sticker design or printing.
- No changes to table occupancy tracking (who is seated) — that already works.

## Rules the business cares about

- An order placed from a table's QR is always connected to the right table visit.
- If the customer's phone refreshes, their order still belongs to the same visit.
- When a new group sits at a table, their orders belong to a new visit, not the
  previous group's — even if the previous group never scanned out.
- Renaming a table never breaks its printed QR sticker.

## How we'll know it works

<!-- Acceptance criteria. Each one written as something the builder could sit down
and try themselves. These become the automated tests, one for one. -->

- When I scan a table's QR sticker and place an order, then the order belongs to
  that table's visit and staff can see it.
- When I order again from the same table after my phone refreshes, then the second
  order joins the same visit rather than starting a new one.
- When I look at a table on the tables screen, then I see every order that visit
  has placed together in one place.
- When I rename a table in the admin and scan the same QR sticker again, then the
  sticker still opens that table (renaming does not break the printed link).
- When a new group scans a table's QR after the previous group has left, then
  their orders go into a fresh visit and are never mixed with the previous
  group's orders.

## Still to clarify

None. All business questions were settled in `/clarify`: staff see a seated
group's whole visit together on the tables screen and order dashboard, and a new
group scanning a table's QR automatically starts a fresh visit even if the
previous group never scanned out.

## Ideas for later

- Showing the whole visit on the receipt (all orders for the group).
- Splitting a visit's bill across the people in the group.