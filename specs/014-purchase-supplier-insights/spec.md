# Feature Specification: Inventory & Purchasing Intelligence

**Feature Branch**: `014-purchase-supplier-insights`

**Created**: 2026-09-04

**Status**: Draft

**Input**: User description: "Bulk-adjust ingredients. Ingredient page auto unit-cost on purchases. Show latest supplier per ingredient. Purchase history rows open into full details (supplier, price change vs previous). Supplier page lists their ingredients with latest price and ₱/% increase/decrease. Adjustable low-stock thresholds reflected in Analytics. Build on both the tablet and the Windows café app."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Record a purchase with automatic unit cost (Priority: P1)

The café owner receives a delivery of coffee beans: 5 kilograms for ₱3,750. On the Ingredient page they open "Record purchase", type **5 kg** and **₱3,750**, and the system computes the cost per gram automatically. The ingredient's cost-per-unit updates to the latest purchase price and the purchase appears in history under that ingredient.

**Why this priority**: It is the core daily task (receiving goods), feeds every other screen (latest supplier, history, supplier trends, analytics), and is the basis of the requested auto-computation.

**Independent Test**: Recording one purchase with a unit different from the ingredient's base unit updates the ingredient's stock in the correct base unit, sets cost-per-unit to the computed latest price, and creates one purchase-history entry with supplier, quantity, total, and unit cost.

**Acceptance Scenarios**:

1. **Given** an ingredient whose stock unit is grams, **When** a staff member records a purchase of 2 kg for ₱1,000 with a supplier, **Then** stock increases by 2,000 g, unit cost becomes ₱0.50/g, and the history entry shows supplier, 2 kg, ₱1,000, ₱0.50/g.
2. **Given** a purchase where no supplier is chosen, **When** it is saved, **Then** it is still recorded (supplier shown as unknown/not set) and unit cost is still computed.

---

### User Story 2 - See the latest supplier and price trend per ingredient (Priority: P1)

On the Ingredient page each ingredient shows who it was last bought from and its latest unit cost. Opening the purchase history for one ingredient shows every purchase with the supplier, date, quantity, total, unit cost, and how the unit cost changed versus the previous purchase (₱ amount and %).

**Why this priority**: This is the "where did we buy it and did the price go up" decision support the owner asked for; it depends only on data from User Story 1.

**Independent Test**: After two purchases of the same ingredient from different suppliers at different prices, the ingredient shows the second supplier as "latest supplier" and the history detail shows the exact ₱ and % change between the two purchases.

**Acceptance Scenarios**:

1. **Given** an ingredient purchased twice (₱0.40/g then ₱0.50/g), **When** staff opens that ingredient's purchase history, **Then** the later entry shows +₱0.10/g (+25%) versus the previous purchase and the earlier entry shows no prior comparison.
2. **Given** an ingredient never purchased, **When** staff views it, **Then** the page says no supplier yet and shows no trend.

---

### User Story 3 - See what each supplier supplies and how prices move (Priority: P2)

Opening a supplier's page lists every ingredient purchased from them, each with the latest price from that supplier and the increase/decrease versus the previous price from the same supplier (₱ and %).

**Why this priority**: Gives the owner a supplier-level negotiation view (which supplier, which items, trending up or down), the second explicit request, and only needs data from Story 1.

**Independent Test**: With two purchases of the same ingredient from the same supplier at different prices, the supplier page shows both and marks the change between them.

**Acceptance Scenarios**:

1. **Given** a supplier who supplied beans at ₱0.45/g and later ₱0.50/g, **When** the owner opens that supplier, **Then** beans shows latest ₱0.50/g and "increased ₱0.05/g (+11%)".
2. **Given** a supplier with no purchases yet, **When** the owner opens it, **Then** the page shows the supplier with an empty ingredient list and a "no purchases yet" note.

---

### User Story 4 - Bulk-adjust many ingredient stock levels at once (Priority: P2)

After a stock count the staff needs to correct several ingredients quickly. They open the bulk adjust screen, see a list of ingredients, change quantities for several rows at once, and save — one action updates all selected rows.

**Why this priority**: High-frequency operational convenience requested first in the description; independent of suppliers/history because bulk rows are stock corrections.
**Decision (Q1 = A)**: Bulk adjust is **stock corrections only**. Rows change an ingredient's stock level (up or down) and appear in stock history as adjustment records with the batch as a reason; they never create purchase rows, never need a supplier, and never change unit cost. Purchases with supplier + auto-cost always happen through the one-by-one "Record purchase" flow (User Story 1).

**Independent Test**: Adjusting quantities for 5 ingredients in one screen creates a stock-change record for each and the ingredient page reflects all five new levels immediately.

**Acceptance Scenarios**:

1. **Given** an ingredient page with many ingredients, **When** staff bulk-increases or decreases a set of them and saves, **Then** each ingredient's stock and history reflects the change.
2. **Given** a bulk adjustment that would push an ingredient below its low-stock threshold, **When** it is saved, **Then** the low-stock indicator for that ingredient appears immediately.

---

### User Story 5 - Low-stock thresholds drive inventory and analytics views (Priority: P3)

The owner raises the low-stock threshold for coffee beans. The change is reflected wherever low stock is surfaced: the ingredient's low-stock state, alert lists, and the analytics inventory summary.

**Why this priority**: It closes the loop ("threshold change is visible everywhere"), but each existing view still functions before this story lands.

**Independent Test**: Changing a threshold flips an ingredient from "healthy" to "low" in the alerts list and in the analytics inventory summary without any other action.

**Acceptance Scenarios**:

1. **Given** an ingredient above its current threshold, **When** the threshold is raised above current stock, **Then** the ingredient is flagged low in the inventory alert list and in the analytics summary.
2. **Given** an ingredient below threshold, **When** a purchase brings stock above it, **Then** the low flags clear in both places.

---

### Edge Cases

- Purchase recorded with quantity 0 or negative → rejected with a clear message; nothing is written.
- Purchase with a unit the system cannot convert to the ingredient's base unit → rejected before saving with an explanation of supported units.
- Deleting or hiding a supplier that has history → purchase history and trend numbers stay intact, the supplier can only be deleted after warning, and every ingredient whose `latest supplier` pointed at it falls back to its prior supplier (or "none"), never a broken reference.
- Two purchases at the exact same unit cost → trend shows 0.00 (₱0.00 / 0%), never "no data".
- Supplier renamed/edited → previous purchase rows and trends keep pointing at the supplier record consistently.
- Bulk adjustment where an ingredient is locked/out-of-stock/inactive → row is shown disabled with a reason; no silent skip.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Staff MUST be able to record a purchase by entering a quantity in a real-world unit (grams, kilograms, liters, milliliters, pieces) and a total peso amount, and the system MUST compute and store the cost per unit automatically.
- **FR-002**: The computed unit cost MUST become the ingredient's latest cost-per-unit (latest purchase price replaces the previous value).
- **FR-003**: A purchase MAY record the supplier it came from; if no supplier is chosen the purchase is still valid and shows as supplier unknown.
- **FR-004**: Each ingredient MUST show its latest supplier and latest unit cost at a glance on the ingredient page.
- **FR-005**: Purchase history MUST be explorable per ingredient: opening an entry shows supplier, date, quantity (as entered and in base unit), total, unit cost, and the unit-cost change vs the previous purchase of that ingredient (₱ and %).
- **FR-006**: The supplier page MUST list all ingredients that supplier has provided, with the latest price from that supplier and the ₱/% change vs the previous price from that supplier.
- **FR-007**: Staff MUST be able to bulk-adjust stock levels for multiple ingredients in one screen and save them in one action. Bulk rows are stock corrections only (no supplier/cost); a bulk save may not push any ingredient's stock below zero — below-zero rows are rejected with a message before anything is written.
- **FR-008**: Low-stock thresholds MUST remain adjustable per ingredient, and the low/high state derived from the threshold MUST be consistent across the ingredient page, alert lists, and the analytics inventory summary. Decision (Q2 = A): the analytics summary shows **low-stock counts and total stock value** derived from the thresholds — it does not generate restock/purchasing suggestions in v1.
- **FR-009**: All purchase records, stock changes, and price data MUST be append-only money records. Decision (Q3 = A): a mistaken purchase is corrected by a **void + re-enter** flow. Voiding **never modifies the original record** — it appends a compensating `VOID` record that reverses the purchase's stock effect and, when the voided purchase is the latest non-void purchase of that ingredient, rolls the ingredient's unit cost and latest supplier back to the previous non-void purchase. Every void writes an audit event. Direct editing/deleting of a recorded purchase is not offered in v1.

### Key Entities *(include if feature involves data)*

- **Ingredient**: A stocked item with a base stock unit, current stock, low-stock threshold, latest cost-per-unit, and a reference to its latest supplier.
- **Purchase (transaction)**: One recorded buy of one ingredient: supplier (optional), quantity in purchase unit, quantity in base unit, total cost, computed unit cost, recorded-at date/time.
- **Supplier**: A vendor; its page is an aggregation of purchase rows plus per-ingredient latest price and change vs previous price from that supplier.
- **Bulk adjustment batch**: A single action by one staff member covering multiple ingredient stock corrections; each row creates its own **adjustment** history entry (no supplier, no cost) referencing the batch.
- **Stock change record**: Any stock movement (purchase, adjustment, order consumption) with direction, amount, timestamp, reason, and optional supplier link — this is the source for trends.
- **Low-stock state**: Derived flag (at/below threshold) computed from current stock vs threshold, shared by every view.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Staff can complete a purchase entry (quantity + total + optional supplier) in under 30 seconds including the automatic unit-cost result.
- **SC-002**: 100% of recorded purchases appear in the ingredient's purchase history with correct ₱ and % change vs the previous purchase of that ingredient.
- **SC-003**: 100% of supplier pages show the correct latest-price and change figures for ingredients that supplier provided at least twice.
- **SC-004**: A bulk adjustment of up to 20 ingredient rows can be entered and saved in under 2 minutes and every changed ingredient reflects the new level immediately.
- **SC-005**: Changing a low-stock threshold updates the ingredient's low/high state everywhere (ingredient page, alerts, analytics summary) without any further manual step.
- **SC-006**: Both the tablet and the Windows café app expose identical numbers for stock, latest price, and trends after the same purchase history (parity check).

## Assumptions

- "Latest supplier" means the supplier of the most recent purchase of that ingredient regardless of which supplier page you are viewing.
- Purchases may use common units that map to the ingredient's base unit (kg↔g, L↔ml, pieces as-is); unsupported unit combinations are rejected up front.
- The feature is built for both the Android tablet and the Windows/web café app, with the same behavior and numbers (data stays synchronized; the existing sync/ledger rules of the project apply).
- Money and stock history are append-only per project rules; any correction is a new reversal entry rather than editing the past.
- Product recipes and order consumption already track ingredient stock; this feature adds purchase-side and supplier-side views and does not change order consumption.
- The tablet and web apps may have slightly different screen sizes, but every view described here is reachable in both.
