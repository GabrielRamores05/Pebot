# Staff & HR — redesign and intended behaviour

Status: design system adopted; UI restyled. This note records **how the module should work** so the
UI and the API stay aligned as the remaining tabs are built out.

## Purpose

Staff & HR is the single place an owner/manager runs their people operations for one café:
who works here, when they work, whether they showed up, when they are away, what they are paid
(PH statutory deductions included), how they are performing, and the paperwork that proves it.

It is **ADMIN-only** (route `permission: 'staff'`, role `ADMIN`). Staff and kitchen roles must not
reach it — enforced by `middleware.ts` (authenticated) plus the client route guard (permission).

## Personas

| Persona | Wants |
|---|---|
| Owner / Manager (ADMIN) | Approve leave, run payroll, review people, keep documents current — fast, in one screen. |
| Shift supervisor (STAFF, no `staff` perm) | Only needs the clock-in board; that lives on the POS/kitchen side, not here. |
| The staff member themselves | Cared for **outside** this page today (no self-service portal yet — see Next). |

## The eight tabs (intended behaviour)

1. **Team** — roster of users. Create/edit staff, set role + the 10 permission flags, pay basis
   (hourly vs monthly), and personal/emergency details. Deactivate instead of delete when someone
   leaves (keeps their attendance/payroll history intact). *Guardrail: never delete a user who has
   payroll or attendance rows — deactivate.*
2. **Schedule** — weekly rota built from **shift templates**. A shift = (name, start, end, station).
   Publish a week so the POS/kitchen can show "who's on now". Overlaps and double-bookings should warn.
3. **Time Clock** — attendance. Clock-in creates an `Attendance` row; clock-out closes it and records
   breaks. Managers can correct a missed punch (with a note). One open shift per person at a time.
4. **Time Off** — leave requests against **leave types** (e.g. Vacation, Sick, Unpaid with
   `daysPerYear`). Flow: staff requests → manager approves/declines with a note → approved days are
   excluded from payroll and shown on the Schedule. Pending requests surface on the overview strip.
5. **Payroll** — pay runs over a period. Gross = hours (hourly) or pro-rated monthly salary, minus
   unpaid leave. Apply **SSS / PhilHealth / Pag-IBIG** contributions and withholding tax server-side;
   the client must never send the net. Finalising a run writes immutable payroll rows (audit).
6. **Reviews** — periodic performance notes (rating 1–5 + strengths / improvements / goals). Read-mostly
   history per person; new review requests in *pending* state.
7. **Documents** — contracts, certificates, IDs, with expiry dates. Expiring-soon items should surface
   as a warning (e.g. a food-handling certificate). Store file + metadata; files served via
   `/api/files/[filename]`.
8. **Training** — courses and per-staff enrolment/completion. Assignment to a station can require a
   completed course (ties into Stations).

## Cross-cutting rules (from the constitution)

- **Server derives money.** Payroll gross/net, deductions and leave pay are computed in the payroll
  module from stored rates and the attendance/leave rows — never from a client peso amount.
- **One transaction per value change.** Clock-out + attendance close, leave approve + balance move,
  payroll finalise + rows — each in a single transaction, each with an audit event.
- **Never trust ids from the client** for scoping: derive `userId` from the session where the action is
  "about me"; admins may act on explicit ids but the API still validates existence + role.
- **Data retention.** Attendance, payroll and audit rows are financial/legal records — deactivate, don't delete.

## Visual language (adopted from the "Coffer" template)

- Canvas `--c-page` (#f4f5f7), cards `--c-card` with 1px `--c-hair` border and a soft shadow.
- Accent = graphite/navy `--c-accent` (#111622); active nav/tab = `--c-accent-soft` pill with
  `--c-accent-text`. Semantic amber/rose/good for states, never for brand.
- Type = **Manrope** (vendored locally, offline-safe), 15px/1.5 body, 32px titles, tabular figures for money.
- Primitives available app-wide: `.c-card`, `.c-title`, `.c-eyebrow`, `.c-chip`, `.c-pill`, `.c-btn`,
  `.c-table`, plus Tailwind utilities `bg-page|panel|card`, `text-ink|muted|faint`, `border-hair`.

## What changed

- `app/globals.css`: Manrope `@font-face` + the token layer and component primitives.
- `app/admin/AdminLayoutClient.tsx`: shell restyled to the Coffer system (canvas, hairline sidebar/topbar,
  navy active nav).
- `app/admin/staff/page.tsx`: header (`People` eyebrow + `c-title`), tab bar, and overview KPI cards;
  palette mapped from amber/slate to the Coffer tokens.

## Next (recommended)

1. Deep-restyle each tab body (tables → `.c-table`, forms → `c-card`, buttons → `.c-btn`), and give the
   Time Clock a live "who's in" board.
2. Add a **staff self-service** clock-in view (mobile) so supervisors don't need the admin page.
3. Surface **expiring documents** and **pending leave** as counts on the overview strip.
4. Extend the same token restyle to the remaining admin pages (dashboard, inventory, products, settings,
   analytics) for visual consistency.
