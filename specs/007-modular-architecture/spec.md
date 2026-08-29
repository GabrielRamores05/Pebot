# Spec 007: Modular Architecture Refactor

## Status
- **Type**: Technical debt / architecture refactoring
- **Priority**: High — addresses violations of Constitution Principle IV (Section 4 of master prompt)

## Problem

Currently, API route handlers in `my-app/app/api/**` call `prisma.*` directly — across 25+ route files, 100+ call sites. The `PEBOT_MASTER_PROMPT.md` (Section 4) and `.specify/memory/constitution.md` (Principle IV) explicitly forbid this:

> A route handler MUST NOT call `prisma.*` directly. It validates the request with a Zod schema, calls exactly one domain service function, and serializes the response. `prisma.*` is reachable only from a domain repository module.

Nine `modules/*/repository.ts` files were created previously but are **not imported anywhere** — they are orphaned infrastructure. No `service.ts`, `schema.ts`, or `service.test.ts` files exist. No `zod` dependency is declared in `package.json` (only present transitively).

## Requirements (Acceptance Criteria)

1. **Zod validation**: Install `zod` and `zod-validation-error` as direct dependencies. Every API route validates input with a Zod schema.
2. **Service layer**: Each domain module (`modules/*/`) gains a `service.ts` containing all business logic. Route handlers call exactly one service function.
3. **Repository layer**: Each `modules/*/repository.ts` file is the only file that imports `prisma`. It exposes typed data-access functions used by `service.ts`.
4. **Schema layer**: Each domain module gains a `schema.ts` with Zod input/output schemas for the service functions.
5. **Unit tests**: Each `service.ts` has a `service.test.ts` with Vitest tests.
6. **Thin routes**: All API route handlers in `app/api/**` are refactored to: parse request → validate with Zod → call one service function → serialize response. No direct `prisma.*` calls remain outside `modules/*/repository.ts`.
7. **Backward compatibility**: All existing endpoints continue to work the same way from the client's perspective. No API contract changes for existing clients.
8. **All tests pass**: `npx tsc --noEmit`, `npm run lint`, `npm run test:unit` all succeed.

## Affected domains

| Domain | Modules dir | Route files | Complexity |
|---|---|---|---|
| orders | `modules/orders/` | `app/api/orders/**` (4 routes) | High (transactions, loyalty) |
| inventory | `modules/inventory/` | `app/api/inventory/**` (1 route) | Low |
| catalog | `modules/catalog/` | `app/api/categories/**`, `app/api/option-groups/**`, `app/api/products/**` | Medium |
| loyalty | `modules/loyalty/` | `app/api/loyalty/**` (5 routes) | Medium |
| tables | `modules/tables/` | `app/api/tables/**` (3 routes) | Low |
| finance | `modules/finance/` | `app/api/expenses/**`, `app/api/payroll/**`, `app/api/payments/**` | Medium |
| hr | `modules/hr/` | `app/api/attendance/**`, `app/api/leave-requests/**`, `app/api/leave-types/**`, `app/api/performance-reviews/**` | Low |
| system | `modules/system/` | `app/api/system/**`, `app/api/backup/**`, `app/api/debug/**` | Low |
| consultant | `modules/system/` | `app/api/consultant/**` (5 routes) | Medium |

## Implementation order (phased)

Phase 1 (foundation): Install zod, implement first domain end-to-end as pattern
Phase 2: Replicate pattern across remaining domains
Phase 3: Remove all direct `prisma.*` calls from API routes
Phase 4: Full test + lint + typecheck verification

## Constraints

- TypeScript `strict: true` — no `any`, no `@ts-expect-error` without reason
- Never weaken a test to make a build pass
- Route handlers must remain thin (validate → service → serialize)
