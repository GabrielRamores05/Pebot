# Decisions — order-type-persistence

*Technical decisions made on the builder's behalf, and business decisions they
made. Written for a developer who joins later and asks "why is it like this?"*

*The builder is not expected to read this file.*

---

### A delivery order requires an address
- **Chose:** the order-create path refuses a delivery order with no address; the
  counter terminal blocks placing one until an address is typed.
- **Because:** builder said a delivery order must always have somewhere to go
  (asked 2026-08-16).
- **Rule:** protocol/decisions.md — money and what a customer sees are business
  decisions.
- **Reversible:** yes — relaxing the requirement is a small check to remove.

### Choosing the order type stays with counter staff
- **Chose:** only the counter terminal sets Dine-in / Takeout / Delivery.
  QR-menu customers keep picking a table, which is recorded as dine-in.
- **Because:** builder said QR customers shouldn't choose the order type
  (asked 2026-08-16).
- **Rule:** protocol/decisions.md — scope decisions belong to the builder.
- **Reversible:** yes — adding an order-type choice to the QR flow later is
  additive, no data changes.

### Order type and delivery address live on the Order row
- **Chose:** new `orderType` (default `DINE_IN`) and nullable `deliveryAddress`
  columns on `Order`; the order-create API accepts and stores them.
- **Because:** the terminal already collects both but the POST body and the Order
  model ignore them — persisting on the row is the minimal, standard shape.
- **Rule:** standard/data.md; recipes/crud-resource.md.
- **Reversible:** yes — a nullable column is trivial to adjust.

### The order type label is shown where orders are looked at
- **Chose:** kitchen screen, terminal receipt, staff order lists, and the
  customer's order page show the type using the same words the terminal already
  uses (Dine-in / Takeout / Delivery).
- **Because:** the builder's decision on wording wasn't needed — matching the
  existing labels is the least surprising choice.
- **Rule:** protocol/decisions.md — labels a user reads are business, but matching
  existing wording is the conservative default.
- **Reversible:** yes — label text only.