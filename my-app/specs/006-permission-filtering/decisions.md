# Decisions — Spec 006: permission-filtering

## Builder-approved choices (from /clarify)

1. **Role → screen defaults** (builder: "role matches its screen"):
   - STAFF → Live Orders / POS terminal / tables (`liveOrders`, `terminal`, `tables`).
   - KITCHEN → Kitchen (`kitchen`).
   - ADMIN → all features.
   These are the defaults applied when a role is set; Staff Management can still
   fine-tune per user via the 10 permission flags. A technical/business default —
   logged here rather than asked each time.

2. **Public `/kitchen` requires sign-in before showing any order data** (builder: 2A).
   `/admin/kitchen` keeps being admin-layout gated (already requires staff login).

3. **Feature-gating = existing per-user permission flags + role** (builder: 1B, Option B):
   Non-admin access is limited only by the existing per-user permission flags and
   role. ADMIN role = all features. STAFF/KITCHEN roles = the specific permission
   booleans on the User record. No new staff-management UI is added (in scope:
   "only enforces what was granted").

4. **Enforcement target**: make the `visibleNav` role+permission filtering also
   effective at the API/data level, not just the client-side sidebar. The current
   gap: someone can guess a URL and read data that their role should not see.
   This spec adds server-side gating at the API boundary for the key data routes,
   so the client-side hiding and the server-enforced gate are consistent.

5. **No new staff-management UI or subscription-tier changes** — this spec only
   enforces what's already granted in Staff Management and the user's role.

## Questions resolved by the builder

- Role limits = existing per-user permission flags + role defaults (decision 3).
- Public kitchen requires sign-in first (decision 2).
- Admin keeps all features; non-admin only their features (decision 1).

## Questions deferred / ideas-for-later

- Per-branch staff, audit logs, per-station kitchen view, subscription-tier
  feature gating → spec Ideas for later.