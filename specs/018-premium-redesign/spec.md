# Feature Specification: Premium Redesign

**Feature Branch**: `018-premium-redesign`

**Created**: 2026-11-14

**Status**: In progress

**Input**: Owner: "Improve the design of my UI/UX premiumness. Not template-looking, make it sharp, a design that uses all the spaces smartly. Access https://codeandchill.store/templates, study it well, get inspiration from all the templates and decide which design to use for every page we have."

## Research

The catalogue (184 templates) was browsed through its live demos. Screens studied in detail:

| Template | What it is | What Pebot takes from it |
|----------|------------|--------------------------|
| **Ambrel** (POS, light) | Register, Today, Payouts/cash drawer, Catalogue, Members, Settings | Warm light canvas, white panels with large radius, one terracotta accent. Page title + one-line narrative summary with the key facts in bold. Three-column register (category rail · product grid · ticket with a big Charge button). "Should be in the drawer" card with the arithmetic shown. Settings tabs with a "where these show" helper panel. Grouped sidebar with a live status card at the bottom. |
| **Petalo** (POS / back office, light) | Overview, order board, stock, team | Greeting header with today's facts. Pastel "what needs attention" tiles that link somewhere. Ranked best-sellers with bars. Payment-method split bar. |
| **Tavola** (restaurant, dark) | Overview, Kitchen Board, Floor Plan, Menu | Kitchen board columns New / Cooking / Ready / Served with colour-coded ticket cards, ticket age and a rush badge. Drawn floor plan with table states and a waitlist. Menu cards that show price, food cost, margin and sold count with an "On tonight" switch. Headline numbers in the page header. |

Pebot does **not** copy their code, images or text. It takes layout ideas and conventions and builds them in its own palette and components. The templates are paid products; their code was neither available nor used.

## Design direction

- **Canvas**: warm off-white (`#F4F1EC`). Panels are near-white with a hairline border and a large radius (18–20px). No gradients, no glass, no emoji used as icons.
- **Accent**: terracotta ("achuete") `#B4472A`, used for the one primary action per screen, active navigation and key numbers. Text is warm near-black `#1D1915`.
- **Pastel tiles** for headline numbers and attention cards: peach, sage, sand, sky.
- **Type**: Manrope (already stored with the app, works offline). Large, tight page titles (-0.03em); tabular numbers everywhere money appears.
- **Density**: every screen uses the full width. Primary information is in the first screenful; secondary information sits in a right-hand column on wide screens and stacks below on narrow ones.
- **Header pattern**: title, then one sentence that states what matters now ("12 orders open · 2 ready · drawer holds ₱4,180"), then actions on the right (secondary outline, primary filled).

## Page-by-page plan

| Pebot page | Reference | Design |
|------------|-----------|--------|
| Admin shell (all admin pages) | Ambrel | Grouped sidebar (Service / Business / Team & setup), shop name block, collapse to icons, cash-drawer status card and signed-in user card at the bottom. Quiet toast notifications. |
| New Order (POS terminal) | Ambrel Register | Category rail · product grid · ticket. Ticket holds items, discount, totals, payment and one Charge button. Drawer status in the header. |
| Live Orders | Tavola Kitchen Board | Columns Pending / Preparing / Ready / Completed with colour-coded cards, ticket age, order type, totals. Headline numbers in the header. |
| Analytics / Revenue | Ambrel Today, Petalo Overview | Pastel number tiles with trend, sales by hour vs last week, best sellers, payment split. |
| End of Day | Ambrel closed-day report | Report layout with the reconciliation shown step by step. |
| Order History | Ambrel Receipts | Dense list with filters and a receipt preview pane. |
| Products | Ambrel Catalogue, Tavola Menu | Card grid with price, cost, margin and sold count; availability switch; list view. |
| Inventory / Stock History | Ambrel Stock, Petalo Stock | Table with par levels, "use first" and reorder highlights. |
| Expenses | Ambrel Payouts | Totals card plus list with categories. |
| Loyalty / Customers | Ambrel Members | Member list with progress and rewards. |
| Tables | Tavola Floor Plan | Drawn floor with table states. |
| Kitchen display | Tavola Kitchen Board (dark) | Dark board for kitchen screens. |
| Staff | Petalo Team | People list and shifts. |
| Settings | Ambrel Settings | Tabs, form card, "where these show" helper. |
| Customer menu, cart, order tracking | Ambrel product cards | Same palette and cards, phone-first. |
| Welcome page | (spec 019 with the Pebot mascot) | — |

## Requirements

- **FR-001**: One set of design tokens drives every screen; existing screens pick up the new palette without per-page edits.
- **FR-002**: No feature is removed and no workflow changes meaning; this is presentation only.
- **FR-003**: Works offline (no web fonts or images from the internet).
- **FR-004**: Usable at 1280×720 (common POS screens) and on phones for customer pages.
- **FR-005**: Text contrast meets WCAG AA for body text.

## Success Criteria

- **SC-001**: The owner judges it premium and not template-looking.
- **SC-002**: The POS terminal shows categories, products and the full ticket with the Charge button without scrolling at 1280×720.
- **SC-003**: Tests, type check and lint stay green after each stage.
