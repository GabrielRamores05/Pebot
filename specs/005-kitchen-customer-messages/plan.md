# Plan — kitchen-customer-messages

*Derived from `spec.md` plus the project constitution and locked technical
decisions. Nobody asked the builder to author this and nobody should. It exists
so that a build survives this session ending, or the builder switching to a
different AI tool halfway through.*

*Written during `/clarify`, once the spec is settled.*

## Recipes used

- `crud-resource.md` — the existing `OrderMessage` resource and its
  `GET/POST /api/orders/[id]/messages` routes already follow this pattern; this
  build extends them, it does not re-invent them.
- `auth.md` — replying is gated behind a staff session (`getAuthUser` +
  `requireRole`), per the builder's decision.

## Current state (what already exists)

- `OrderMessage` model — `type` ("text"|"voice"), `content`, `sender`,
  `createdAt` — already in the schema. No migration needed.
- `GET/POST /api/orders/[id]/messages` — list and create messages. **Gap:** it
  trusts the `sender` in the request body with no session check, so anyone can
  post a message as anyone.
- Customer order page (`app/order/[orderNumber]/page.tsx`) — can already send text
  and voice messages and polls messages every 10s. Staff replies already render
  there (blue bubble), so replies reaching the customer work with no page change.
- Admin Live Orders dashboard — full message thread + reply box already exists.
- Kitchen screens (`app/kitchen/page.tsx`, `app/admin/kitchen/page.tsx`) — only
  receive the `order-followup` ping toast today; they show no message content and
  cannot reply. **This is the gap this build fills.**

## Data

- No schema change. All message data already lives in `OrderMessage`.

## API

- **`POST /api/orders/[id]/messages`** — stop trusting the body `sender`:
  - If the request carries a valid staff session (`ADMIN`/`STAFF`/`KITCHEN`), it is
    a staff reply; attribute it to the session user's name (ignore body sender).
  - Otherwise it is a customer message; attribute it to the order's customer name
    (ignore body sender). This closes the impersonation hole and is what makes
    "only signed-in staff can reply" actually true.
  - Keep the existing guard: no messages for `COMPLETED`/`CANCELLED` orders.
  - Emit `order-message` to the order room (`order-<orderNumber>`) as well as the
    existing global broadcast, so the customer's order page updates instantly.
- **`GET /api/orders`** — include each order's `messages` (ascending) in the list
  response so kitchen screens can show unread markers and threads on load without
  an extra fetch per card.

## Screens

- **Kitchen screens** (`app/kitchen/page.tsx` and `app/admin/kitchen/page.tsx`):
  - Extend the `Order` shape with `messages`.
  - Subscribe to `order-message` (they already subscribe to `order-followup`):
    append to the matching order, play `playMessageSound()`, flag the card.
  - Order card: show a 💬 badge with the message count; the card takes a
    "message waiting" style while the latest message is from the customer (no
    staff reply after it yet).
  - Add a message thread panel (modal or inline expand on the card): the
    back-and-forth in order, voice messages as `<audio controls>`, and a reply box.
  - Reply box enabled only when signed in (fetch `/api/auth/me`). If not signed
    in, show "Sign in to reply" linking to `/login?next=/kitchen`. Sending a reply
    posts to the messages route; the server attributes it to the session user.
  - Both kitchen pages get the same treatment (they are near-identical).
- **Login page** (`app/login/page.tsx`): support a `next` query param so after
  signing in staff land back on the kitchen screen instead of always `/admin`.
- **Customer order page** (`app/order/[orderNumber]/page.tsx`): subscribe to
  `order-message` in the order room to append staff replies instantly (the 10s
  poll already covers it; this removes the delay). No UI change needed.

## Outside connections

- None.

## Not covered by the standard

- None.