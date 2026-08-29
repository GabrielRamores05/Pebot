# permission-filtering

*Created 2026-08-16. This describes what the software should do, in plain language.
It contains no technology. If you find yourself writing a product or library name
here, it belongs in `plan.md` instead.*

## What this is for

The shop has more than one kind of staff — an admin (full access), counter staff,
kitchen staff — and a way to give each a role with specific permissions. But those
permissions are only applied on the menus in the admin app; they are not enforced
on the screens or data where it actually matters. The kitchen screens can be opened
and read by anyone who knows the link, and every order's data — including customer
names and what they ordered — is served to anyone, no sign-in required.

This change makes the permission choices you already make in Staff Management mean
something in practice: a person can only see and do on each screen what their role
allows, and data that staff-only should see is not handed out for free.

## Who uses it

- **Admin** — full access to everything (staff management, settings, analytics,
  products, orders, kitchen).
- **Counter staff** — can work the Live Orders / POS terminal and the tables they
  are allowed to see; cannot open Staff, Settings, or analytics for other branches.
- **Kitchen staff** — can see the kitchen screen and prepare the orders in it; cannot reach Live Orders, tables, or Staff Management (kitchen-only, least privilege).
- **Customers** — can only see their own order status page and their own table's
  menu; must never see another customer's order, names, or messages.
- **Anyone off the street with the link** — must NOT be able to see the kitchen
  screen, the orders, or anyone's customer data.

## What it does

- Requires a staff sign-in before **both** `/kitchen` and `/admin/kitchen` show any order data. Unauthenticated users are redirected to `/login?next=/kitchen` (or `?next=/admin/kitchen`) and cannot see orders.
- Hides or blocks screens a role is not allowed to use — for example, a STAFF user
  opening Staff Management or Settings is turned away instead of shown the page.
- STAFF can use Live Orders, tables (terminal), and products where granted; KITCHEN can use kitchen only; ADMIN has all. (Lock plan.md:11-13 matrix.)
- Keeps a customer's order page readable by the customer who placed it, without
  letting one customer see another's order.

## What it does not do

- No new way to manage staff or grant permissions — Staff Management already does
  that today. This spec only enforces what was granted.
- No change to how customers order or check their order.
- No per-branch access control across multiple locations.

## Rules the business cares about

- A customer can never see another customer's order, items, or name.
- Non-admin staff cannot manage other staff or change system settings.
- Anyone without a staff login cannot see the orders screen or the kitchen screen.

## How we'll know it works

- When I share the kitchen URL with someone who is not signed in, then they are
  sent to sign in (or told to sign in) and cannot see any order.
- When a STAFF (non-admin) member signs in, then they can use Live Orders but
  cannot open Staff Management or Settings.
- When a KITCHEN member signs in, then they can see their orders on the kitchen
  screen but not Staff Management or Settings.
- When two customers open each other's order numbers, then neither can see the
  other order's details.
- When a STAFF member signs in, then the sidebar no longer offers Staff or Settings.

## Ideas for later

- Auditing: a log of who opened which screen and when.
- Granular per-station access in the kitchen (only the coffee bar sees coffee
  orders, etc.).
- Per-branch staff accounts.