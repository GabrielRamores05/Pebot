# Loyalty Automation

*Created 2026-08-16. This describes what the software should do, in plain language.
It contains no technology. If you find yourself writing a product or library name
here, it belongs in `plan.md` instead.*

## What this is for

Customers earn loyalty rewards after buying a set number of coffees — buy 10, get
one free. Today that relies on staff manually awarding points, and it can happen
at the wrong moment (when the kitchen says the order is ready rather than when the
customer has actually paid). This spec makes points land on a customer's loyalty
card automatically, at the moment payment is confirmed, so nothing is done by
hand and nobody is given points before they've paid.

## Who uses it

- **Cashier / admin** — confirms that a customer has paid. From that moment, the
  customer's loyalty card is updated automatically. The cashier never types a
  point total in.
- **Customers** — their card gains points as soon as their order is confirmed as
  paid, and a reward (e.g. a free coffee) appears on their card when they reach
  the threshold.
- **Kitchen** — marks orders ready. This must **not** award points: a customer
  earns points for paying, not for the food being ready.

## What it does

- Adds points to a customer's loyalty card automatically when an order is confirmed
  as paid, counting each paid item toward their reward threshold.
- Creates the reward (e.g. free item, percentage off, fixed amount off) on the card
  when the customer crosses the threshold, per the shop's loyalty settings.
- Works the same whether the order came from a customer scanning the QR menu or
  from the in-store terminal.
- Skips orders that were paid **using** a loyalty reward (buy 10 get 1 free should
  not also earn points on the free item).

## What it does not do

- No manual point entry. If the points are ever wrong, the cashier does not fix it
  by typing a number in — that is a separate future feature.
- No retroactive points. Orders completed before this change are not re-scored.
- No changes to how rewards are *redeemed* — only how they are *earned*.
- Does not award points when the kitchen marks an order ready, only when payment
  is confirmed.

## Rules the business cares about

- A customer earns points only for orders they have actually paid for.
- Points are earned per item bought, not per order — buying 3 coffees in one order
  earns 3 coffees toward the card.
- The reward threshold and reward type (free item, percentage, fixed amount) are
  whatever the shop has already configured — this feature does not change the
  rules, it only makes earning automatic.
- Points land on the card belonging to the customer name on the order.

## How we'll know it works

- When I confirm that a customer's order has been paid, then their loyalty card
  gains one point for each item they bought, without me doing anything else.
- When I confirm a payment, then the order moves out of Pending so the kitchen can
  start — confirming payment and telling the kitchen are the same action.
- When the kitchen marks an order as ready, then no points are added to the
  customer's card.
- When a customer reaches the shop's threshold, then the reward appears on their
  card automatically.
- When an order was paid using a loyalty reward, then it earns no new points.
- When a customer orders through the QR menu and pays at the counter, then their
  points are added the same way as an in-store terminal order.

## Still to clarify

None. All business questions were settled in `/clarify`: points land when the
cashier confirms payment (order moves to Preparing), the kitchen's Ready awards
nothing, and payment happens before the kitchen starts.

## Ideas for later

- A visible "points earned" toast/message on the customer's phone when their order
  is confirmed as paid.
- Manual point adjustment for the cashier (e.g. correcting a mistake).
- Backdating points for orders that predate this change.