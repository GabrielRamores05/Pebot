# Tasks — kitchen-customer-messages

*Ordered. Tick as you go — if the session ends, the next one starts here.*

*Internal. The builder is not expected to read or approve this.*

- [x] Create spec folder, spec.md, decisions.md, plan.md.
- [x] Settle the `TO CLARIFY` items with the builder (/clarify).
- [x] Checkpoint before building.
- [x] Harden `POST /api/orders/[id]/messages`: attribute customer messages to the
      order's customer and staff replies to the signed-in staff session; emit to
      the order room too.
- [x] Include `messages` in the `GET /api/orders` list response.
- [x] Kitchen screens (`/kitchen` and `/admin/kitchen`): show message threads on
      order cards, play voice messages, badge cards with a "message waiting"
      state, and subscribe to `order-message` with a sound.
- [x] Kitchen reply box gated on staff sign-in (with "Sign in to reply" and a
      `?next=` return); add `next` support to the login page.
- [x] Customer order page: subscribe to `order-message` for instant staff replies.
- [x] Write `tests/acceptance/kitchen-customer-messages.spec.ts` (one test per
      acceptance criterion).
- [x] Run `tsc --noEmit` and eslint; run `npm run build`.
- [x] Run `edgepoint check` and checkpoint the finished build.

## Acceptance criteria → tests

*Every criterion in `spec.md` gets one end-to-end test. This mapping is how the
builder verifies their own software, so it must be complete before the build is
considered done.*

| Criterion (from spec.md) | Test |
|---|---|
| When a customer sends a message on their order page, then it appears on the kitchen screen with a sound and the customer's words. | `tests/acceptance/kitchen-customer-messages.spec.ts` → "customer message appears on the kitchen screen" |
| When the kitchen types a reply to a customer's message, then the customer sees that reply on their order page. | `tests/acceptance/kitchen-customer-messages.spec.ts` → "kitchen reply reaches the customer's order page" |
| When a customer sends a voice message, then the kitchen can play it on the kitchen screen. | `tests/acceptance/kitchen-customer-messages.spec.ts` → "kitchen can play a customer's voice message" |
| When an order card on the kitchen screen has a message that has not been answered yet, then it shows a clear "message waiting" marker. | `tests/acceptance/kitchen-customer-messages.spec.ts` → "unanswered message marks the kitchen order card" |
| When I open an order on the kitchen screen, then I can read the whole back-and-forth — customer and staff — in the order it happened. | `tests/acceptance/kitchen-customer-messages.spec.ts` → "kitchen thread shows the whole conversation in order" |