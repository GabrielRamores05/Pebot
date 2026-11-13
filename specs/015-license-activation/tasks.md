# Tasks: Pebot License Activation

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/)

## Phase 1: Setup and governance

- [x] T001 Amend `.specify/memory/constitution.md` to 1.1.0: scope "cafés" → "restaurants and food businesses"; add Principle VIII (Commercial licensing: fail closed, offline, private key never shipped). Update the AGENTS.md "What this is" line.
- [x] T002 Add `prisma/pebot-license.json` to `my-app/.gitignore` and `*.pem` / `PebotSeller/` to the root `.gitignore`.

## Phase 2: Foundational (blocks all stories)

- [x] T003 [P] `my-app/lib/license/core.js` + `core.d.ts`: Crockford base32, machine-code format/parse/check, payload encode/decode, `signLicense` (CLI only), `verifyLicense`, deactivation code create/verify.
- [x] T004 [P] `my-app/lib/license/public-key.js` (placeholder `null`) and `revoked.js` (`[]`).
- [x] T005 [P] `my-app/lib/license/machine-id.js`: Windows/Linux/macOS identity readers with retries, `getMachineCode()`, and an injectable reader for tests.
- [x] T006 `my-app/lib/license/agreement.js` + `my-app/legal/pebot-license-agreement.txt` (EN + FIL, version `1.0-draft`).
- [x] T007 `my-app/lib/license/state.js`: file path next to the DB, load/evaluate/refresh, accept agreement, activate, deactivate (atomic write).
- [x] T008 `my-app/lib/license/gate.js`: `isLocalAddress`, `classifyRequest`, `socketAllowed`, "being set up" HTML.
- [x] T009 Tests: `tests/unit/license-core.test.ts`, `license-gate.test.ts`, `license-state.test.ts`, `license-agreement.test.ts`.

## Phase 3: US1 + US2 (P1): activate and fail closed

- [x] T010 `server.js`: initialize license state before listen, set/strip `x-pebot-local`, apply `classifyRequest` before `handle`, `io.use` socket check, log the license state at startup.
- [x] T011 `my-app/modules/license/schema.ts` + `service.ts` (status, agreement read/accept, activate, deactivate, with audit events).
- [x] T012 Routes `app/api/license/{status,agreement,activate,deactivate}/route.ts` (thin, Zod, local check).
- [x] T013 `app/activate/page.tsx`: agreement step → Machine Code with copy → paste key / import `.lic` → result messages per failure reason.
- [x] T014 Test: `tests/unit/license-service.test.ts`.

## Phase 4: US3 (P1): seller tool

- [x] T015 `tools/pebot-keygen/registry.js` (load/save, nextLicenseNo, reactivationsLastYear, add issue, revoke) + `pebot-keygen.js` (init, issue, reissue, verify-deactivation, list, revoke) + `.cmd` wrapper + README with backup instructions.
- [x] T016 Test: `tests/unit/license-keygen.test.ts` (registry rules + issued key verifies in the app core).

## Phase 5: US4 (P2): agreement

- [x] T017 `app/legal/agreement/page.tsx` (EN/FIL toggle); `package.json` `build.nsis.license` + `build.files` include `legal/**/*`.

## Phase 6: US5 (P2): move to a new PC

- [x] T018 `app/admin/settings/license/page.tsx` (status, license no., Machine Code when local, agreement link, "Move to a new computer" with confirmation and shown code); point the settings link and the old `settings/subscription` route at it.

## Phase 7: FR-019: retire tier gating

- [x] T019 `lib/api-guards.ts` `guardFeature` → permission rule; `lib/auth.ts` `checkFeatureAccess` same; `store/subscriptionStore.ts` `hasFeature` → permission-based; update the affected tests to the new rule.

## Phase 8: US6 (P3): revocation

- [x] T020 Revoked list honoured in `state.js` evaluation (covered by T007/T009 tests) and written by `keygen revoke` (T015/T016).

## Phase 9: Polish

- [x] T021 Run `npm run lint`, `npx tsc --noEmit`, `npm run test:unit`; fix any failures; delete temp scripts.
- [x] T022 Mark the acceptance criteria and tasks done; note deviations in `plan.md`.
