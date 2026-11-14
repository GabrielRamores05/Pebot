# Tasks: Premium Redesign

**Input**: [spec.md](spec.md)

Each stage is checked in a browser (headless Chrome against a throwaway preview database with a temporary test license) at 1440×900 and 1280×720, then committed and pushed.

## Done

- [x] T001 Research: codeandchill.store catalogue and the Ambrel, Petalo and Tavola live demos; page-by-page plan in spec.md.
- [x] T002 Design tokens in `app/globals.css`: warm canvas, near-white panels, terracotta accent, pastel tiles; Tailwind gray/slate/amber ramps follow the palette.
- [x] T003 Admin shell: grouped sidebar, collapse, cash-drawer status card, user card, quiet notifications, new icons.
- [x] T004 POS terminal as a register (categories · products · ticket), Charge pinned, fits 1280×720. Senior sale verified end to end.
- [x] T005 Live Orders as a kitchen board with headline tiles and one-tap Start / Mark ready.
- [x] T006 Analytics overview dashboard.

## Remaining (one commit each)

- [ ] T007 End of Day: report layout matching the dashboard tiles.
- [ ] T008 Order History: dense list with filters and a receipt preview pane.
- [ ] T009 Products: card grid with price, cost, margin; list view; no emoji buttons.
- [ ] T010 Inventory and Stock History: table with low/out highlights.
- [ ] T011 Expenses (Payouts style), Loyalty and Customers (Members style), Reviews.
- [ ] T012 Analytics sub-tabs: Revenue, Customers, Fulfillment, Vouchers.
- [ ] T013 Tables: drawn floor plan; Kitchen display: dark board; Staff queue; Stations.
- [ ] T014 Staff, Settings (tabs + "where these show"), Consultant, Audit Logs.
- [ ] T015 Sign-in page, activation page, license agreement page.
- [ ] T016 Customer pages: menu, cart, order tracking, reviews, exit (phone-first).
- [ ] T017 Receipt modal and printed receipt styling.
- [ ] T018 Owner review: "premium, not template-looking".
