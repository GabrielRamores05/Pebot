# Plan — Inventory Blocking

*Derived from `spec.md` plus the project constitution and locked technical
decisions. Nobody asked the builder to author this and nobody should. It exists
so that a build survives this session ending, or the builder switching to a
different AI tool halfway through.*

*Written during `/clarify`, once the spec is settled.*

## Recipes used

Relevant constitution touchpoints:

- Constitution §II (Two trust zones) — who may place orders (CUSTOMER via QR
  menu, ADMIN/STAFF via the counter terminal) versus who may change stock counts
  (admin inventory page).
- Constitution §III (Money append-only) — the `Inventory` table already exists;
  no schema change.

This is a comparatively small spec: the menu and terminal already *display* stock,
and the order path already *deducts* stock. The gap is that the order route never
*checks* stock before accepting an order, so it can oversell and push counts below
zero. The build adds the check, and the customer-facing message when it fails.

## Data

Existing tables, reused unchanged:

- `Inventory` — `productId`, `quantity`, `lowStockThreshold`. `quantity` is the
  count of units on hand.
- `Product` — `available` flag, `inventory` relation.

Access rules mapped to "Who uses it":

- **Customer** — orders through the QR menu. Must not be able to add an item at
  zero stock, and if stock runs out after they add it, they must get a clear
  "unavailable" message at the point of ordering rather than a charge.
- **Cashier/admin (terminal)** — places orders at the counter. Blocked from selling
  an out-of-stock item the same way (or with an override, per `/clarify`).
- **Shop owner/manager** — manages counts in the admin inventory page; unchanged.

A role in the spec with no policy here would be a bug; the owner/manager role only
configures stock, it never orders, so it needs no order-time policy.

## Screens

- `app/api/orders/route.ts` (order-create path) — the authoritative check: verify
  every item's stock is sufficient before the order is created, inside the existing
  transaction, and refuse with a clear "item unavailable" response if not.
- `app/menu/page.tsx` — already marks zero-stock items "Out of Stock" and prevents
  adding them; surfaces `409 {unavailable: [{productId, name}]}` as "Item <name> is unavailable — please remove it and try again" for items already in the cart.
- `app/admin/terminal/page.tsx` — already prevents adding zero-stock items; surfaces the same `409` unavailable message for items already on the ticket.
- `app/api/inventory/route.ts` — unchanged, but the order route's low-stock check
  after deduction (`quantity <= lowStockThreshold`) stays as-is.

## Outside connections

None. Stock lives in the app's own database; no third-party service involved.

## Not covered by the standard

The stock-check itself (compare requested quantity to `Inventory.quantity`, refuse
the order when insufficient, inside the create transaction) is ordinary
engineering and covered by the standard's data rules. The genuinely open items are
business decisions, held as `TO CLARIFY` in `spec.md` and settled in `/clarify`.