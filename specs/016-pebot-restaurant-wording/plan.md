# Implementation Plan: Pebot Name and Restaurant Wording

**Branch**: `016-pebot-restaurant-wording` | **Date**: 2026-11-14 | **Spec**: [spec.md](spec.md)

## Summary

Change what the software calls itself (CaféOS → Pebot) and replace café-only wording with wording that fits any restaurant. Names that only the software sees stay as they are, so no install loses data, nobody is signed out, and the separate tablet product keeps finding the main PC.

## Technical Context

**Language/Version**: TypeScript (strict), CommonJS for `server.js` and `electron/`

**Primary Dependencies**: Next.js 14 App Router, Electron 40 + electron-builder (NSIS)

**Storage**: SQLite via Prisma. No schema change in this spec.

**Testing**: Vitest (`npm run test:unit`)

**Target Platform**: Windows desktop (Electron) serving LAN browsers

**Project Type**: Local-first web app with a desktop shell

**Constraints**: Offline, LAN-only. No data loss on update (constitution VII).

**Scale/Scope**: About 50 files, text-only apart from two small behaviour changes (data-folder choice, loyalty impact in revenue analytics).

## Constitution Check

| Principle | Result |
|-----------|--------|
| I. Local-first, offline | Pass. Nothing added that needs a network. |
| II. Realtime and access checks | Pass. Not touched. |
| III. Thin routes, repositories own the database | Pass. The revenue route now reads loyalty settings through `modules/loyalty/repository.ts` instead of adding another direct query. Its existing direct order query is older code and is listed for the cleanup spec. |
| IV. Tests first, never weakened | Pass. Two new helpers each had a failing test first. Two existing assertions changed only because the expected product name changed. |
| VII. No silent data loss | Pass. This is the reason for FR-009 and FR-010. See Decisions. |
| VIII. Licensing fails closed | Pass. License files, key format and gate are untouched. |

## Decisions

1. **Rename what people read, keep what the software reads.** Unchanged on purpose: cookie `cafeos-token`, saved-cart and store keys, `cafeos.db`, backup file names, log file name, package `name`, installer `appId` `com.cafeos.pos`, mDNS service name `SMART CafeOS` and its `cafeos-pos` record, hostname `smartcafeos.local`, and the `coffee` station identifier.
   *Why*: each of these is a lookup key. Changing one signs people out, orphans a database, breaks printed QR codes, or stops the tablet product finding the PC. Keeping `appId` also means the new installer updates the old install in place instead of sitting beside it.
2. **Keep the old data folder when it has a database.** Electron names the data folder after the app, so renaming the product would point an updated install at an empty folder. `electron/legacy-user-data.js` picks the folder: the current one if it already has `cafeos.db`, otherwise an old-name folder that has one, otherwise the current one. `electron/main.js` applies it before anything reads the folder.
   *Alternative rejected*: copying the old folder to the new name. A copy can fail half-way and leaves two databases to confuse a later restore.
3. **Loyalty unit is "stamps", reward is "reward" / "Free Item".** Database column names such as `coffeesRequiredForFree` stay. Renaming them is a migration with no visible benefit.
4. **Loyalty impact follows the program, not a category name.** `loyaltyCoveredValue` in `lib/loyalty-utils.ts` sums the items in the categories of enabled loyalty programs, or all items when a program covers the whole menu. It is still an estimate, as it was before.
5. **Placeholder icons.** The coffee-cup placeholder (missing logo, loading, missing product photo) becomes a plate, and loyalty stamps become a star. The cup stays as the icon of the drinks station and in the icon pickers. The full visual pass belongs to the redesign spec.
6. **Tablet product.** The tablet import screen and its API comment keep the tablet product's own name. Its server endpoints are untouched.

## Project Structure

```text
my-app/
├── app/                         # wording on admin, customer and sign-in screens
├── app/api/analytics/revenue/   # loyalty impact via loyaltyCoveredValue
├── electron/main.js             # display names; applies pickUserDataDir
├── electron/legacy-user-data.js # new: which data folder to use
├── lib/loyalty-utils.ts         # new: loyaltyCoveredValue
├── lib/, modules/               # wording in messages and defaults
├── package.json                 # installer name, shortcut, description
├── public/manifest.json         # installable-app name
├── server.js                    # console banner only
└── tests/unit/                  # legacy-user-data, loyalty-coverage; two updated assertions
```

## Not verified in this spec

- Building the installer and updating a real old install on a second PC. The data-folder choice is covered by unit tests, not by an installed build.
- A visual pass over every screen in a browser.
