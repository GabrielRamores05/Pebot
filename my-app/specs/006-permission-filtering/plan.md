# Plan — Spec 006: permission-filtering

## Goals

1. **Make the kitchen screen require sign-in** before any order data is shown.
   - Public `/kitchen`: redirect to `/login?next=/kitchen` before rendering orders.
   - `/admin/kitchen`: ensure admin-layout auth gate is effective (already in place,
     but verify it blocks before data fetch).
2. **Enforce role-based nav + API gating** so each role can only reach + use its
   default screen + feature permissions.
   - STAFF → Live Orders (`liveOrders`), tables (`terminal`), products (`products`)
   - KITCHEN → Kitchen (`kitchen`)
   - ADMIN → all features
3. **Keep client-side visibleNav filtering** (already in AdminLayout) but add
   server-side API gates so the two are consistent — guessing a URL no longer
   bypasses the permission check.

## Technical decisions

- Add a `requirePermission(feature: string)` helper in `lib/auth.ts` that checks
  the signed-in user's role + permission flags, and returns the user or throws a
  403 / redirects to login.
- Wire this helper into the key API routes that each feature touches:
  `app/api/orders/route.ts`, `app/api/orders/[id]/route.ts`, `app/api/tables/route.ts`,
  `app/api/products/route.ts`, `app/api/inventory/route.ts`, `app/api/kitchen/...`
  (kitchen actions from spec 5 already require staff sign-in; spec 6 extends this
  to also block the kitchen screen itself for unauthenticated users).
- Keep the existing `lib/subscription.ts` `hasFeatureAccess` and `requireFeature`
  for tier-based features — spec 6 does NOT change the subscription model.
- The admin layout's `visibleNav` filtering stays as-is (client-side); spec 6 adds
  the server-side complement so URL guessing doesn't bypass it.

## Acceptance criteria (same as spec.md)

- When I share the kitchen URL with someone who is not signed in, then they are
  sent to sign in (or told to sign in) and cannot see any order.
- When a STAFF (non-admin) member signs in, then they can use Live Orders but
  cannot open Staff Management or Settings.
- When a KITCHEN member signs in, then they can see their orders on the kitchen
  screen but not Staff Management or Settings.
- When two customers open each other's order numbers, then neither can see the
  other order's details.
- When a STAFF member signs in, then the sidebar no longer offers Staff or Settings.

## Out of scope

- No new staff-management UI.
- No subscription-tier changes.
- No per-branch or per-station granularity.