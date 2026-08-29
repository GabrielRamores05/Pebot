# Decisions — kitchen-customer-messages

*Technical decisions made on the builder's behalf, and business decisions they
made. Written for a developer who joins later and asks "why is it like this?"*

*The builder is not expected to read this file.*

---

### Only signed-in staff can reply to a customer
- **Chose:** replying to a customer requires a signed-in staff session; anyone can
  read messages on the kitchen screen, but only staff can answer.
- **Because:** the builder picked "Only signed-in staff" when asked — if a stranger
  reaches the kitchen screen they must not be able to message customers as the cafe
  (asked 2026-08-16).
- **Rule:** protocol/decisions.md — who may do what is a business decision
- **Reversible:** yes; loosening it later just means dropping the session check

### Customer identity is never trusted from the request
- **Chose:** `POST /api/orders/[id]/messages` ignores the body `sender`; customer
  messages are attributed to the order's `customerName`, staff replies to the
  signed-in staff user's name. There is no such thing as an unauthenticated staff
  reply.
- **Because:** the only way "only signed-in staff can reply" is enforceable is at
  the boundary — the API must source the sender from the session, not from the
  client. This also closes a pre-existing impersonation hole (anyone could post a
  message as any sender).
- **Rule:** protocol/decisions.md — Rule 1 (technical) resolves the technical half
  of the builder's "who may reply" decision
- **Reversible:** no, at this shape — switching to trusting the body sender would
  re-open the hole

### A new message is pushed to the customer's order room too
- **Chose:** the messages route emits `order-message` both globally (for kitchen +
  admin) and to the `order-<orderNumber>` socket room (for the customer).
- **Because:** the kitchen and admin screens subscribe without a room and need the
  broadcast; the customer's order page already joins its room and only handles
  `order-status-update`, so routing the new message there gives the customer an
  instant reply instead of waiting for the 10s poll.
- **Reversible:** yes; removing the room emit keeps the 10s poll as a fallback

### The orders list carries each order's messages
- **Chose:** `GET /api/orders` includes each order's `messages` (ascending) so the
  kitchen card can show a real-time preview and a "message waiting" state without
  one extra request per card.
- **Rule:** crud-resource.md — extending an existing resource's includes
- **Reversible:** yes — could be narrowed back to `_count` + lazy fetch if it ever
  gets heavy

### Kitchen sign-in returns to the screen you were on
- **Chose:** `/login` reads a `next` query param (read from `window.location` at
  submit time, not `useSearchParams`, to stay statically exportable) and returns
  there after signing in. Signed-in kitchen screens pass `next=/kitchen`.
- **Rule:** standard/environment.md — the app is a static export, so no
  `useSearchParams` on a page that must prerender

<!--
### <the decision, as a short statement>
- **Chose:** what was done
- **Because:** the reason — cite the builder if they decided it, cite the rule if you did
- **Rule:** which constitution principle or locked technical decision
- **Reversible:** yes / no, and what it would cost to change
-->

