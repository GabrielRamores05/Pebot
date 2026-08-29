# Plan — table-slugs-sessions

*Derived from `spec.md` plus the project constitution and locked technical
decisions. Nobody asked the builder to author this and nobody should. It exists
so that a build survives this session ending, or the builder switching to a
different AI tool halfway through.*

*Written during `/clarify`, once the spec is settled.*

## Recipes used

- `crud-resource.md` — extending the existing Order and RestaurantTable resources
  with new columns; the table-entry endpoint already follows this pattern.

## Data

- **`RestaurantTable`**: add `slug String @unique` — generated once at creation
  from the name (slugified, deduped as `<slug>-2`, `-3`, ... via Prisma unique loop), never changed by renames.
- **`Order`**: add `sessionId Int?` + `session TableSession?` FK — the table visit
  the order belongs to.
- Migration: `npx prisma migrate dev --name table-slugs-sessions` (or manual
  `migrate deploy` on this host, per the env-stack-mismatch feedback).
- Backfill: migration script for each `RestaurantTable` where `slug IS NULL`, set `slug = slugify(name)` with dedup (`-2`, `-3`); existing orders keep `sessionId = null` (safe — they predate visits being linked to orders).

## Screens

- **QR endpoint** (`app/api/tables/qr/route.ts`): build `/menu?table=<slug>` from
  the table's slug instead of its name.
- **Menu page** (`app/menu/page.tsx`): resolve the `table` param as slug first,
  then fall back to a name match (old stickers). Persist the returned
  `session.id` to localStorage key `cafeos:tableSessionId` instead of only
  React state, and reuse it on refresh.
- **Table entry** (`app/api/tables/entry/route.ts`): accept an optional
  `sessionId` from the device; reuse it only if it is still open for that table,
  otherwise create a fresh visit.
- **Order create** (`app/api/orders/route.ts`): accept `sessionId` and store it on
  the order.
- **Customer cart** (`app/cart/page.tsx`): send the remembered `sessionId` (and
  tableId) with the order.
- **Tables screen** (`app/admin/tables/page.tsx`) and **order dashboard**
  (`app/admin/page.tsx`): show all orders for the table's current visit together.

## Outside connections

- None.

## Not covered by the standard

- None.