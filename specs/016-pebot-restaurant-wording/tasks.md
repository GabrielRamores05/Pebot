# Tasks: Pebot Name and Restaurant Wording

**Input**: [plan.md](plan.md), [spec.md](spec.md)

## Phase 1: US1 (P1): the product says "Pebot"

- [x] T001 Rename CaféOS/CafeOS → Pebot in user-facing text under `my-app/app`, `lib`, `modules`, `store`, `hooks`, `electron/main.js`, `public/manifest.json`. Skip tablet-product lines and the mDNS service name.
- [x] T002 Default business name → "My Restaurant" (branding and business settings routes, receipts, reports).
- [x] T003 `app/admin/AdminToolsSection.tsx`: QR poster titles use the restaurant's own name, escaped for the print window.
- [x] T004 AI consultant → "Pebot Assistant", restaurant management wording (`app/admin/consultant/page.tsx`, `app/api/consultant/*`).
- [x] T005 `package.json`: description, author, `build.productName`, copyright, shortcut name. Keep `name` and `appId`.
- [x] T006 `server.js` console banner. Keep mDNS name and records.
- [x] T007 Sign-in, home, layout title and manifest copy no longer mention coffee or cafés.

## Phase 2: US2 (P1): loyalty, staff and stations fit any food business

- [x] T008 Loyalty wording → stamps / reward / "Free Item" (`app/admin/loyalty`, `app/admin/customers`, `app/cart`, `app/menu`, `app/order`, `app/api/loyalty/*`, `modules/loyalty/*`).
- [x] T009 Staff positions add Server and Cook, keep all existing ones (`app/admin/staff/page.tsx`).
- [x] T010 Drinks station label "Drinks", identifier `coffee` unchanged (`lib/kitchen-stations.ts`, `app/admin/stations`, `app/admin/products`, `app/order`).
- [x] T011 Test first: `tests/unit/loyalty-coverage.test.ts`, then `loyaltyCoveredValue` in `lib/loyalty-utils.ts`, used by `app/api/analytics/revenue/route.ts` through the loyalty repository.
- [x] T012 Placeholder icons: plate for missing logo / loading / missing photo, star for loyalty stamps.

## Phase 3: US3 (P1): existing installs keep their data

- [x] T013 Test first: `tests/unit/legacy-user-data.test.ts`, then `electron/legacy-user-data.js` and its use at the top of `electron/main.js`.
- [x] T014 Confirm unchanged: cookie name, store keys, `cafeos.db`, backup names, `appId`, mDNS name and records, `smartcafeos.local`, tablet endpoints.

## Phase 4: Finish

- [x] T015 Update assertions that expected the old product name (`tests/unit/sounds.test.ts`, `tests/acceptance/manual-db-backup-restore.spec.ts`).
- [x] T016 Search for leftover "CaféOS", "CafeOS", "coffee shop", "café" in user-facing text.
- [x] T017 `npm run lint`, `npx tsc --noEmit`, `npm run test:unit` from `my-app/`.
- [ ] T018 Owner: build the installer and update an old install on a spare PC to see the data carried over. Not done here.
