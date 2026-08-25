# Tasks — table-slugs-sessions

*Ordered. Tick as you go — if the session ends, the next one starts here.*

*Internal. The builder is not expected to read or approve this.*

- [x] Create spec folder, spec.md, decisions.md, plan.md.
- [x] Settle the `TO CLARIFY` items with the builder (/clarify).
- [x] Checkpoint before building.
- [x] Add `slug` to `RestaurantTable` and `sessionId` to `Order` in the Prisma
      schema; run a migration; backfill existing tables with slugs.
- [x] Point the QR endpoint at the table's slug.
- [x] Resolve the menu's `table` param as slug (falling back to name), and persist
      the visit's session id in localStorage.
- [x] Make the table-entry endpoint reuse a remembered visit only when it is still
      open for that table, else start a fresh one.
- [x] Accept and store `sessionId` in `POST /api/orders`; send it from the customer
      cart.
- [x] Show the current visit's orders together on the tables screen and the order
      dashboard.
- [x] Write `tests/acceptance/table-slugs-sessions.spec.ts` (one test per
      acceptance criterion).
- [x] Run `tsc --noEmit` and eslint; run `npm run build`.
- [x] Run `edgepoint check` and checkpoint the finished build.

## Acceptance criteria → tests

*Every criterion in `spec.md` gets one end-to-end test. This mapping is how the
builder verifies their own software, so it must be complete before the build is
considered done.*

| Criterion (from spec.md) | Test |
|---|---|
| When I scan a table's QR sticker and place an order, then the order belongs to that table's visit and staff can see it. | `tests/acceptance/table-slugs-sessions.spec.ts` → "QR order is linked to the table's visit" |
| When I order again from the same table after my phone refreshes, then the second order joins the same visit rather than starting a new one. | `tests/acceptance/table-slugs-sessions.spec.ts` → "a refresh keeps the same visit" |
| When I look at a table on the tables screen, then I see every order that visit has placed together in one place. | `tests/acceptance/table-slugs-sessions.spec.ts` → "tables screen shows the visit's orders together" |
| When I rename a table in the admin and scan the same QR sticker again, then the sticker still opens that table. | `tests/acceptance/table-slugs-sessions.spec.ts` → "renaming a table keeps its QR working" |
| When a new group scans a table's QR after the previous group has left, then their orders go into a fresh visit and are never mixed with the previous group's orders. | `tests/acceptance/table-slugs-sessions.spec.ts` → "a new group starts a fresh visit" |