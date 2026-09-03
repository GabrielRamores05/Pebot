# Quickstart — Inventory & Purchasing Intelligence (014)

Phase 1 output. Runnable validation scenarios that prove the feature works
end-to-end on **both** apps with identical numbers. Prerequisites: a running
tablet build and the my-app dev server, each with the same test store
(ingredients, suppliers, and 2–3 existing purchase rows so "previous purchase"
has data).

## QS-1: Auto unit-cost purchase (both apps)

1. Prerequisites: ingredient "Coffee Beans", base unit `g`, cost `₱0.40/g`,
   stock `10,000 g`, supplier "Acme Grains" exists.
2. Record a purchase: quantity **2 kg**, total **₱1,100**, supplier Acme Grains.
3. Expected:
   - Stock: `12,000 g`.
   - Cost per unit: `₱0.55/g` (1100 ÷ 2000), latest purchase price replaces 0.40.
   - Latest supplier on the ingredient: **Acme Grains**.
   - History entry: 2 kg (= 2,000 g), ₱1,100, ₱0.55/g, supplier Acme Grains,
     change vs previous `+₱0.15/g (+37.5%)`.

## QS-2: Purchase history detail and trends

1. Open the ingredient's purchase history and click the newest row.
2. Expected: full detail — supplier, date, quantity as entered and in base
   unit, total, unit cost, and the ₱/% change vs the previous purchase shown in
   QS-1's history.
3. Open Supplier → Acme Grains. Expected: the supplier page lists Coffee Beans
   with latest price ₱0.55/g and change `+₱0.15/g (+37.5%)` vs its previous
   price from Acme Grains.

## QS-3: Bulk stock correction

1. Open Inventory → bulk adjust. Select 3 ingredients: increase two by set
   amounts, decrease one.
2. Save. Expected: all three current-stock values update immediately; each
   shows a new ADJUSTMENT history row referencing the same batch; low-stock
   flags appear/disappear instantly per the thresholds; no cost or supplier
   changed on any row; all rows share one batch id.
3. Try decreasing an ingredient below zero in the same screen: expected a
   rejection message and **no** rows written for the whole batch.

## QS-4: Void + re-enter

1. From a purchase detail row, choose Void.
2. Expected: a **compensating VOID record is appended** — the original purchase
   row is never modified; stock rolls back by that purchase's quantity. If the
   voided purchase was the latest non-void purchase, unit cost rolls back to the
   previous non-void purchase's unit cost (QS-1 scenario: back to ₱0.40/g) and
   latest supplier rolls back to the prior one (or none); VOID records are
   excluded from latest/trend numbers; an audit event exists.
3. Voiding an **older** purchase instead: expected stock rolls back but current
   unit cost and latest supplier stay unchanged.
4. Re-enter the corrected purchase normally and confirm QS-1 numbers return.

## QS-5: Threshold drives every surface

1. Set Coffee Beans `minStock` above its current stock.
2. Expected, with no other action: ingredient page flags Low; the inventory
   alert list includes it; the Analytics inventory summary shows the new low
   count and the total stock value that includes its stock × latest cost.
3. Set `minStock` exactly equal to current stock: expected LOW on every surface
   (boundary rule: stock equal to threshold is low).
4. Lower the threshold back below stock → all flags clear together.

## QS-6: Parity between tablet and web

1. Run QS-1..QS-5 on the tablet. Export the snapshot, import it into the web
   app (or sync), and repeat the same reads there.
2. Expected: identical stock, latest cost per unit, latest supplier, trend ₱/%
   values, and analytics low counts/stock value; no record is dropped and no
   supplier link is lost in either direction.

## Error cases to probe

- Quantity 0 or negative on a purchase → rejected, nothing written.
- Purchase unit that cannot convert to the ingredient's base unit (e.g.,
  buying `ml` of a `pcs` ingredient) → rejected with the supported-units
  message.
- Voiding the only purchase → stock returns to prior level, cost/last-supplier
  become "none", no crash, audit written.
- Voiding a non-latest purchase → stock only; current cost/latest supplier
  unchanged.
- Two purchases at identical unit cost → trend shows ₱0.00 / 0%.
- Stock exactly equal to the low-stock threshold → ingredient is LOW on every
  surface.
