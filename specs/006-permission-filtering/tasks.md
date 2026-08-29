# Tasks — Spec 006: permission-filtering

## Criteria → Tasks mapping

1. Public kitchen sign-in gate → Phase 2 Task 2.1 (kitchen page `if (!isStaff)` redirect + `fetchOrders` guard)
2. STAFF role can use Live Orders but not Staff Management/Settings → Phase 1 Task 1.1 (`requirePermission` + ADMIN check) + Phase 3 API gating (orders tables) + Phase 4 visibleNAV
3. KITCHEN role can see kitchen screen but not Staff Management/Settings → Phase 2 Task 2.1 (kitchen UI visible when isStaff) + Phase 4 visibleNAV
4. Customers cannot see each other's order details → Phase 3 Task 3.1a: `GET /api/orders/[id]` + `app/order/[orderNumber]/page.tsx` must enforce orderNumber ownership; return 404 for mismatched orderNumbers. Test `other customer's order returns 404`. Mitigation: `orderNumber`/`barcodeValue` remain unguessable; document per constitution §II.
5. STAFF sign-in hides Staff/Settings from sidebar → Phase 4 Task 4.1 (visibleNAV consistency with server-side gates)

## Phase 1: Add server-side permission helper

### Task 1.1 — Add `requirePermission` to `lib/auth.ts`
- Add async function `requirePermission(req: NextRequest, feature: string): Promise<JWTPayload>` that:
  1. Calls `getAuthUser(req)` to get the signed-in user (or null).
  2. If no user, returns `null` (caller redirects to /login).
  3. If user.role === 'ADMIN', returns the user (ADMIN has all features).
  4. If user.role is STAFF or KITCHEN, checks `user.permissions?.[feature]` (the 10 permission flags from Staff Management). Returns user if truthy, otherwise returns null (caller handles 403/redirect).
  5. Export this function so API routes can `import { requirePermission } from '@/lib/auth'`.

### Task 1.2 — Export `requirePermission` from the package
- Verify the export works with next/ts config (no circular deps).

## Phase 2: Gate the kitchen screen

### Task 2.1 — Modify `app/kitchen/page.tsx` (public kitchen)
- At the top of the component, check auth before rendering any order data.
- If no signed-in user, show sign-in prompt instead of order data (already implemented: `if (!isStaff)` early return renders prompt; `fetchOrders` guards with `isStaff`).
- Ensure orders are NEVER rendered without auth (fetchOrders returns early if `!isStaff`).

### Task 2.2 — Verify `/admin/kitchen/page.tsx` auth gate
- Confirm the admin layout's `fetch('/api/auth/me')` on mount + role check already blocks unauthenticated access. If not, add an explicit early-return before the kitchen data fetch.

## Phase 3: Gate API routes by role + permission

### Task 3.1 — `app/api/orders/route.ts` (list + read orders)
- Add `requirePermission` check for `liveOrders` feature.
- If user lacks `liveOrders` permission (or is not signed in), return 403 or redirect to login.

### Task 3.2 — `app/api/orders/[id]/route.ts` (single order read/write)
- Same `liveOrders` permission check for GET/PATCH on individual orders.

### Task 3.3 — `app/api/tables/route.ts`
- Add `requirePermission` check for `tables` feature.

### Task 3.4 — `app/api/products/route.ts`
- Add `requirePermission` check for `products` feature.

### Task 3.5 — `app/api/inventory/route.ts`
- Add `requirePermission` check for `inventory` feature.

### Task 3.6 — `app/api/kitchen/...` routes (from spec 5)
- Ensure kitchen action routes already gate on staff sign-in (spec 5 already does this via `getAuthUser` / `requireRole`). Verify and extend if needed.

## Phase 4: Wire into admin layout (visibleNAV consistency)

### Task 4.1 — Verify the admin layout's `visibleNav` filtering
- The existing code already filters navItems by `user.role` and `user.permissions?.[permissionKey]`.
- Confirm this is working; spec 6 does NOT rewrite this, just ensures server-side API gates make the same checks consistent.

## Phase 5: Build and verify

### Task 5.1 — Run `npx tsc --noEmit`
- Verify no type errors introduced.

### Task 5.2 — Run `npx eslint <changed-files>`
- Verify no new lint errors.

### Task 5.3 — Run `npm run build`
- Verify production build passes.

### Task 5.4 — Run verification
- Run `npm run test:unit`, `npm run lint`, `npx tsc --noEmit`, `npm run build`.
- Verify 5 acceptance criteria are addressed by the implementation.

### Task 5.5 — Live-verify against host dev server
- Customer order page: unauthenticated, shows only own order.
- STAFF sign-in: Live Orders accessible, Staff/Settings hidden.
- KITCHEN sign-in: Kitchen accessible, Staff/Settings hidden.
- Admin: all features accessible.