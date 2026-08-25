# Decisions — table-slugs-sessions

*Technical decisions made on the builder's behalf, and business decisions they
made. Written for a developer who joins later and asks "why is it like this?"*

*The builder is not expected to read this file.*

---

### Staff see a visit's orders together
- **Chose:** the tables screen and order dashboard show all orders belonging to
  the table's current visit in one place.
- **Because:** builder said staff should see everything a seated group ordered in
  one place (asked 2026-08-16).
- **Rule:** protocol/decisions.md — what staff see is a business decision.
- **Reversible:** yes — the view can be hidden without touching the data.

### A new group always starts a fresh visit
- **Chose:** when a device arrives at a table with no remembered visit, the order
  starts a brand-new visit rather than joining an unrelated open one — even if the
  previous group never scanned out.
- **Because:** builder said new groups must never have their orders mixed with the
  previous group's (asked 2026-08-16).
- **Rule:** protocol/decisions.md — scope and customer-facing behaviour are the
  builder's call.
- **Reversible:** yes, though changing it later would need a way to tell "new
  group" from "same group, second phone".

### Orders carry a sessionId
- **Chose:** new nullable `sessionId` FK on `Order` → `TableSession`; the
  order-create API accepts it; the customer device remembers the session id in
  localStorage so a refresh or a later order keeps the same visit.
- **Because:** orders today record only `tableId`; linking the visit is the whole
  point of this spec and the standard's crud pattern handles a nullable FK.
- **Rule:** standard/data.md; recipes/crud-resource.md.
- **Reversible:** yes — a nullable column.

### Tables get a stable slug for their QR link
- **Chose:** a unique, generated-once `slug` column on `RestaurantTable`; the QR
  endpoint builds `/menu?table=<slug>` from it, and the menu resolves the slug
  (falling back to the table name so already-printed name-based stickers keep
  working).
- **Because:** renaming a table currently breaks printed stickers that embed the
  old name; a slug that never changes keeps stickers valid.
- **Rule:** protocol/decisions.md — technical; the "stickers must keep working"
  consequence is the builder's business intent, already in the spec.
- **Reversible:** yes — a column plus a URL param.

### Fresh device = fresh visit
- **Chose:** `POST /api/tables/entry` reuses a remembered visit only when the
  device supplies a session id that is still open for that table; otherwise it
  creates a new visit.
- **Because:** that is the mechanism behind the "new group starts fresh" decision.
  Known trade-off: two phones in the same group get two visits (each remembered on
  its own phone).
- **Rule:** standard/data.md.
- **Reversible:** yes — a rule in the entry endpoint.