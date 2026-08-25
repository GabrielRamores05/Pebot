# Plan — Loyalty Automation

*Derived from `spec.md` plus `.edgepoint/standard/` and the recipes. Nobody asked
the builder to author this and nobody should. It exists so that a build survives
this session ending, or the builder switching to a different AI tool halfway
through.*

*Written during `/clarify`, once the spec is settled.*

## Recipes used

No recipe in `.edgepoint/recipes/` covers loyalty awarding. The existing loyalty
implementation was found during `/describe` exploration and is being reused, not
rebuilt. The closest standard touchpoints:

- `standard/access.md` — who may confirm payment (ADMIN/STAFF cashier) versus who
  only marks food ready (KITCHEN).
- `standard/data.md` — the loyalty tables already exist; no schema change.

This is the risk area: the build must *relocate* an existing trigger, not invent
one, and the existing trigger currently fires on the wrong status.

## Data

Existing tables, reused unchanged:

- `Order` — `status` (PENDING → PREPARING → COMPLETED), `loyaltyPromo`,
  `loyaltyCustomerName`, `paymentMethod`.
- `LoyaltyCard` — per customer per category, `paidCoffeesCount`,
  `claimedMilestones`.
- `LoyaltySetting` — per category, threshold, reward type/value, milestone mode.
- `LoyaltyVoucher` — earned rewards, created when thresholds are crossed.

Access rules mapped to "Who uses it":

- **Cashier/admin** — the only actor whose action awards points. Their payment
  confirmation (moving the order to Preparing) sends the `paymentConfirmed`
  marker.
- **Kitchen** — may set Preparing/Completed but never awards points; the kitchen
  screens never send the marker.
- **Customer** — cannot award points; customer-facing pages never send the marker.

A role in the spec with no policy here would be a bug; there are none.

## Screens

- `app/admin/page.tsx` — cashier's order panel. Its "move to Preparing" payment
  action sends the `paymentConfirmed` marker. (No new UI required; the existing
  status buttons are the payment step.)
- `app/kitchen/page.tsx` + `app/admin/kitchen/page.tsx` — kitchen "Start
  Preparing"/"Mark Ready" buttons, unchanged, and deliberately *not* sending the
  marker.
- `app/admin/terminal/page.tsx` — in-store POS. Orders placed here are paid at the
  counter at placement time, so the order-create path awards points for terminal
  orders.

## Outside connections

None. No new third-party services. Payment is already captured in-app.

## Not covered by the standard

The awarding logic (threshold, milestone, voucher creation) is bespoke and lives
in `app/api/orders/[id]/route.ts`. The `/describe` exploration found it already
works when it does fire; this build changes *when* it fires, not *how* it works.
Escalation noted in `escalations.md` only if the relocation proves impossible
within the existing route structure.