# Feature Specification: Restaurant Checkout Money

**Feature Branch**: `017-restaurant-money`

**Created**: 2026-11-14

**Status**: Implemented (browser check and accountant review pending)

**Input**: From the commercial brief, workstream A: "Senior Citizen / PWD 20% discount with VAT exemption (RA 9994 / RA 10754)", "service charge", "shifts and cash drawer, X/Z-style end-of-day reports". Pebot is sold to Philippine restaurants, and every one of them serves senior citizens and PWDs every day.

## Background: what the software does today

- The POS terminal has one button, "Student / PWD", that takes a flat percentage (default 20%) off the whole VAT-inclusive bill. VAT is not removed first, there is no Senior Citizen option, and the holder's name and ID number are not recorded.
- The terminal applies that discount to the bill **before** the loyalty reward is taken off, while the server applies it **after**. When a customer uses both, the total on the screen and the saved total differ.
- The VAT figures on the terminal receipt are recalculated in the browser from the undiscounted items. They are not saved with the order.
- There is no service charge, no cash drawer count, and no end-of-day summary.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Senior Citizen and PWD discount computed the way the law requires (Priority: P1)

A cashier rings up a senior citizen's meal, picks "Senior Citizen", types the senior's name and ID number, and the bill drops by the correct amount: VAT removed first, then 20% off the VAT-exclusive price. The order keeps the name, ID number and the amounts.

**Why this priority**: Restaurants must give this discount on every eligible sale. The current flat 20% under-discounts on VAT-registered businesses, which exposes the owner to complaints and penalties.

**Independent Test**: On a VAT-registered setup, ring up one ₱112.00 VAT-able item for one senior. The total is ₱80.00 (₱112 ÷ 1.12 = ₱100.00, VAT removed ₱12.00, discount ₱20.00).

**Acceptance Scenarios**:

1. **Given** a VAT-registered business and a ₱112.00 VAT-able item, **When** one senior citizen dining alone gets the discount, **Then** VAT removed is ₱12.00, discount is ₱20.00, total is ₱80.00, and the sale is recorded as VAT-exempt.
2. **Given** a business that is not VAT-registered, **When** the same item gets the discount, **Then** the discount is ₱22.40 and the total is ₱89.60. No VAT is removed.
3. **Given** a group of 4 sharing ₱448.00 of VAT-able food with 1 senior, **When** the cashier enters "1 of 4 diners", **Then** only a quarter of the bill (₱112.00) gets the VAT removal and discount, and the total is ₱416.00.
4. **Given** the cashier picks Senior Citizen or PWD, **When** they try to place the order without the holder's name or ID number, **Then** the order is refused with a message saying what is missing.
5. **Given** a loyalty reward is already on the bill, **When** the cashier picks Senior Citizen or PWD, **Then** Pebot refuses to combine them and asks the cashier to keep only one. The law gives the customer whichever is higher, not both.
6. **Given** an item marked VAT-exempt, **When** a senior gets the discount, **Then** 20% comes off its price with no VAT removal.

---

### User Story 2 - The total on the screen is the total that is saved (Priority: P1)

Whatever discounts, rewards and service charge apply, the POS terminal shows the same total, VAT breakdown and change that the server saves with the order.

**Why this priority**: A cashier who collects one amount while the records say another cannot close the drawer.

**Independent Test**: Place an order with a loyalty reward and a Student discount. The saved order total equals the total the terminal showed.

**Acceptance Scenarios**:

1. **Given** a loyalty reward and a Student discount, **When** the order is placed, **Then** the saved total equals the terminal's total to the centavo.
2. **Given** any order, **When** it is saved, **Then** it keeps its VAT-able sales, VAT, VAT-exempt sales, VAT removed for Senior/PWD, discount, loyalty discount and service charge.

---

### User Story 3 - Service charge (Priority: P2)

The owner can turn on a service charge (for example 10%) and choose which order types it applies to (dine-in by default). It appears as its own line on the bill.

**Why this priority**: Many sit-down restaurants charge one. It is off by default, so nothing changes for anyone who doesn't use it.

**Independent Test**: Set 10% for dine-in. A ₱500.00 dine-in bill totals ₱550.00; a ₱500.00 takeout bill totals ₱500.00.

**Acceptance Scenarios**:

1. **Given** service charge 10% for dine-in, **When** a ₱500.00 dine-in order is placed, **Then** the service charge is ₱50.00 and the total ₱550.00.
2. **Given** the same setting, **When** a takeout order is placed, **Then** there is no service charge.
3. **Given** a discount on the bill, **When** service charge applies, **Then** it is computed on the bill after discounts.
4. **Given** service charge is off (the default), **When** any order is placed, **Then** totals are unchanged from before this feature.

---

### User Story 4 - Cash drawer count per shift (Priority: P1)

At the start of a shift the cashier opens the drawer and enters the starting cash. During the shift they record cash taken in or paid out (for example ₱300 for ice, with a reason). At the end they count the drawer, and Pebot shows expected cash, counted cash and the difference.

**Why this priority**: Every restaurant counts its drawer. Doing it on paper is where cash goes missing.

**Independent Test**: Open with ₱1,000, take two cash orders of ₱250 and ₱180, pay out ₱300. Expected cash is ₱1,130. Count ₱1,120: Pebot shows ₱10.00 short.

**Acceptance Scenarios**:

1. **Given** no drawer is open, **When** the cashier opens one with ₱1,000, **Then** it is open and cash orders placed from now on count toward it.
2. **Given** an open drawer, **When** another drawer is opened at the same location, **Then** it is refused.
3. **Given** an open drawer, **When** cash is paid out with an amount and reason, **Then** expected cash goes down by that amount. A pay-out without a reason is refused.
4. **Given** an open drawer, **When** a QR order is paid in cash at the counter, **Then** it counts toward the open drawer.
5. **Given** a drawer is closed with a counted amount, **When** anyone looks at it later, **Then** expected, counted and difference are shown and can no longer be edited.
6. **Given** no drawer is open, **When** an order is placed, **Then** it still goes through. Drawers are optional.
7. **Given** a cash order counted in a drawer is later cancelled, **When** the drawer is closed, **Then** that order does not count toward expected cash.

---

### User Story 5 - End-of-day summary (Priority: P1)

At closing time the owner opens the end-of-day summary for a date and sees sales, discounts by type, VAT, service charge, payments by method, order types, cancelled orders, the drawers counted that day, and the list of Senior Citizen and PWD sales. It can be printed.

**Why this priority**: The owner needs this every night for bookkeeping and for their accountant.

**Independent Test**: After the orders in Stories 1–4, open today's summary. Every figure matches the orders placed.

**Acceptance Scenarios**:

1. **Given** orders on a date, **When** the summary for that date is opened, **Then** gross sales minus discounts plus service charge equals net sales, and net sales equals the sum of payments by method.
2. **Given** Senior and PWD sales that day, **When** the summary is opened, **Then** each one is listed with order number, holder's name, ID number, VAT removed and discount.
3. **Given** cancelled orders, **When** the summary is opened, **Then** they are counted and totalled separately and left out of sales.
4. **Given** orders saved before this feature, **When** their date is summarised, **Then** sales and payments are still correct, and the summary says how many of those orders have no VAT breakdown.
5. **Given** the summary, **When** it is printed, **Then** it says it is not an official BIR reading.
6. **Given** a staff member without the Analytics permission, **When** they open the summary, **Then** access is refused.

### Edge Cases

- **Senior share is not a whole person.** "1 of 3 diners" gives a third of the bill the discount, rounded to the centavo.
- **More qualified diners than diners.** Refused.
- **Several seniors/PWDs at one table.** The cashier records each holder's name and ID; the share is the number of holders over the number of diners.
- **Senior and PWD at the same table.** Recorded as one statutory discount per order with each holder's type. Both get the same 20% with VAT exemption.
- **Rounding.** Every peso figure is rounded to the centavo once per order; the parts add up to the total.
- **Prices of zero.** A zero bill stays zero; no negative totals.
- **The drawer is open across midnight.** It belongs to the day it was opened on in the summary.
- **Tablet imports.** Orders imported from the separate tablet product keep their current discount handling and are never counted in this PC's drawer.
- **Old "Student/PWD" orders.** Stay as they are and appear in the summary under "Student / PWD (old)".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The POS terminal MUST offer Senior Citizen, PWD and Student discounts, at most one per order.
- **FR-002**: Senior Citizen and PWD MUST be 20% and MUST NOT be editable. On a VAT-registered business, VAT MUST be removed from the qualifying share of VAT-able items before the 20% is taken, and that share MUST be recorded as VAT-exempt. On a business that is not VAT-registered, 20% MUST be taken off the qualifying share's price.
- **FR-003**: The qualifying share MUST be the number of holders over the number of diners (1 of 1 by default).
- **FR-004**: Senior Citizen and PWD orders MUST record each holder's type, name and ID number, and MUST be refused without them.
- **FR-005**: An order MUST NOT combine a Senior Citizen or PWD discount with a loyalty reward.
- **FR-006**: The Student discount MUST keep its owner-set rate and MUST NOT remove VAT. It MAY be combined with a loyalty reward, as today.
- **FR-007**: One calculation MUST produce the bill on the terminal and on the server, in this order: items → loyalty reward → discount → service charge.
- **FR-008**: Each new order MUST store gross sales, loyalty discount, discount, VAT removed, VAT-able sales, VAT, VAT-exempt sales and service charge.
- **FR-009**: The owner MUST be able to set whether the business is VAT-registered (default: yes, matching today's prices).
- **FR-010**: The owner MUST be able to set a service charge rate (default 0, meaning off) and the order types it applies to (default dine-in).
- **FR-011**: Staff with POS Terminal access MUST be able to open a drawer with starting cash, record cash in and cash out with a reason, and close it with a counted amount. Only one drawer per location may be open.
- **FR-012**: Expected cash MUST be starting cash + cash orders counted in the drawer (not cancelled) + cash in − cash out.
- **FR-013**: A closed drawer MUST NOT change.
- **FR-014**: Staff with Analytics access MUST be able to see and print the end-of-day summary for any date, with the contents in User Story 5.
- **FR-015**: Printed summaries and drawer reports MUST state that they are not official BIR readings.
- **FR-016**: Opening, closing, cash in and cash out MUST be recorded in the audit log.
- **FR-017**: No existing feature is removed, and existing orders are not rewritten.

### Key Entities

- **Order (extended)**: adds the money breakdown (FR-008), the discount holders, and the drawer it was counted in.
- **Cash drawer session**: location, who opened it and when, starting cash; who closed it and when, counted cash, expected cash at close.
- **Cash movement**: drawer session, in or out, amount, reason, who, when.
- **Business settings (extended)**: VAT-registered, service charge rate, service charge order types.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For the worked examples in this spec, Pebot's totals match the hand calculation to the centavo.
- **SC-002**: 0 orders where the terminal's total and the saved total differ.
- **SC-003**: A cashier can open a drawer, record a pay-out and close the drawer in under 2 minutes.
- **SC-004**: On the end-of-day summary, net sales equals the sum of payments by method for every date.
- **SC-005**: Businesses that don't turn on service charge or use the new discounts see the same totals as before.

## Assumptions

- The computation follows RA 9994 (Senior Citizens) and RA 10754 (PWD) as commonly applied by Philippine restaurants: VAT removed, then 20% off; group meals divided by headcount when the senior's own items can't be separated. The owner's accountant should confirm this for their business. Pebot does not give legal or tax advice.
- Service charge is computed on the bill after discounts and is shown outside the VAT breakdown. How it is shared with staff (RA 11360) is the owner's responsibility. The accountant should confirm the base for their business.
- Senior Citizen and PWD discounts are applied by the cashier at the POS terminal after checking the ID. Customers ordering by QR don't apply them themselves.
- A location has one cash drawer. Several drawers per location is a later change.
- Void and refund with manager PIN, split bill, table merge/transfer and thermal printer support are a separate spec (018).
- The end-of-day summary is a management report. Pebot is not BIR-accredited (license agreement), so it is not a BIR Z-reading.
