# Taking money

**Gives you:** PayMongo hosted checkout — GCash, Maya, GrabPay, card, QR Ph —
webhook handling, and order or subscription records. Prices in pesos.

**Use when:** the builder charges for something.

**Escalate when:**

- **They want card fields on their own page.** That means handling raw card
  details, which brings in PCI SAQ A-EP, and it needs a developer — see
  `protocol/escalation.md`. Offer hosted checkout as the thing you can build
  today, and be clear that starting there doesn't waste the work.
- **They want to charge in dollars, or in anything other than pesos.** PayMongo
  settles in PHP. Selling abroad in the customer's own currency is a different
  payment provider and a different conversation.
- **They want a free trial that takes card details up front.** That needs the card
  stored against the customer before there is a payment, which is outside this
  recipe. A trial with no card — access first, subscribe when it ends — is fine
  and needs no escalation.

## Ask the builder

Money is entirely business. Ask all of these; guessing here costs them real money.

1. **What are you selling, and for how much?** In pesos. One-off or a repeating
   subscription.
2. **Are you VAT-registered?** It's on their BIR Certificate of Registration, the
   2303 form. Philippine consumer prices are quoted VAT-inclusive, so the price
   they gave in question 1 is what the customer pays either way — what this
   changes is whether the document shows a VAT breakdown. `standard/tax.md` has
   the arithmetic and what to do if they don't know. Ask it here or in
   `invoicing.md`, once, not in both.
3. **How do your customers want to pay?** GCash, Maya, GrabPay, card, QR Ph. Their
   answer, not yours — a checkout with the wrong wallets loses sales. Two things
   to tell them, in their words:
   - Each method has to be switched on for their PayMongo account before it can
     take money. That's their side, and it isn't instant.
   - E-wallets stop at **₱100,000 per transaction**. If a single purchase can be
     larger than that, card has to be one of the choices.
4. **What happens straight after they pay?** Access granted, order placed, email.
5. **What if payment fails?** What the customer sees, whether to retry.
6. **Refunds?** Who can issue one, within what window, in full or in part. Worth
   saying: a refund to GCash or Maya lands within a day, but a card refund can take
   up to 30 days to show on the statement, and a QR Ph payment can only be refunded
   in full.
7. *(Subscriptions)* **When someone cancels, do they lose access immediately, or
   keep it until the end of the period they've paid for?**

For subscriptions, also tell them: PayMongo has to enable recurring billing on
their account before it works, and repeat charges run on cards or Maya only —
not GCash. Better they hear it now than after the first renewal fails.

Never ask about: webhook signatures, idempotency, API versions, line items,
payment intents, card vaulting.

## Creates

```
lib/payments/checkout.ts                  create session
app/api/webhooks/paymongo/route.ts        webhook handler
supabase/migrations/<ts>_create_orders.sql
supabase/migrations/<ts>_create_prices.sql
lib/payments/entitlements.ts              what a payment grants
tests/acceptance/checkout.spec.ts         PayMongo test mode
```

## Invariants

- **The webhook is the source of truth, not the redirect back.** A customer closing
  the tab after paying must still get what they paid for. Fulfilling on the success
  redirect is the standard way to take someone's money and give them nothing. Fulfil
  on `checkout_session.payment.paid`.
- Verify the `Paymongo-Signature` header on every webhook, against that endpoint's
  own secret. Always. Verify against the **raw request body** — anything that parses
  the body first changes the bytes and makes every legitimate event fail.
- Handle webhooks idempotently, keyed on the event id — a slow or failed response
  makes PayMongo redeliver, and the same event will arrive twice. Record the event
  and answer 200 promptly; do not make PayMongo wait on slow work.
- Amounts in centavos, as integers, currency stored alongside. ₱1,500.00 is
  `150000`. Never a float.
- **Never store a card number.** Not in the database, not in a log, not for a
  moment.
- Preview uses `sk_test_` keys, production uses `sk_live_`. Never the reverse, and
  never the same webhook endpoint for both — each mode gets its own endpoint and
  its own secret.
- Every payment event is logged with its PayMongo payment id, so any charge can be
  traced back to a row in their dashboard.
- **Prices live in a `prices` table the builder can edit, never hardcoded.**
  PayMongo prices each checkout as it is created; there is no price list held on
  their side. So the list has to be somewhere the builder can reach — an admin
  screen over that table (`admin-table.md`) — or every price change is a deploy.
- Reject an amount outside the limits of the chosen method before creating the
  session — ₱1 to ₱100,000 for e-wallets. The customer sees a sentence explaining
  it, not a payment page that fails on arrival.
- Refunds are issued from the PayMongo dashboard unless the builder asked for a
  button. A refund screen that anyone signed in can use is a way to lose money.
- **What the customer gets after paying is an order confirmation, not a BIR
  invoice**, and it never uses the words *Official Receipt*, *OR*, *Sales
  Invoice* or *VAT Invoice*. The reason, and the escalation for builders who want
  the app to issue the real document, are in `standard/tax.md`. The document
  itself is `invoicing.md`.
- A payment record is a financial record: kept five years, never soft-deleted by
  a cleanup, and it survives a customer's erasure request with the person
  unlinked — `standard/privacy.md`.
