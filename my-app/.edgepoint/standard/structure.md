# Structure

```
app/                      routes (Next.js App Router)
  (marketing)/            public pages
  (app)/                  signed-in pages
  api/                    route handlers, only where a page can't do the job
components/
  ui/                     shadcn/ui primitives — generated, don't hand-edit
  <feature>/              feature components
lib/
  supabase/               client, server, and middleware factories
  <feature>/              queries, mutations, and business rules per feature
  validation/             Zod schemas — one file per feature
supabase/
  migrations/             timestamped SQL, applied in order
  seed.sql
tests/
  acceptance/             Playwright — one file per spec
  unit/                   Vitest
  guide/                  the printed test guide's walkthrough and its made-up data
test-guide/               the printed guides themselves — commit them
specs/                    the specs that produced all of the above
```

## Rules

**Feature-first, not type-first.** `lib/bookings/` holds everything about bookings.
Not `lib/queries/`, `lib/types/`, `lib/utils/` with bookings scattered across all
three. A non-developer asking "where's the booking stuff?" should get one answer.

**Data access lives in `lib/<feature>/`.** Never inline a Supabase query in a
component. One place per feature to change a query, one place to look for what
touches a table.

**Server components by default.** `'use client'` only where there is genuine
interactivity — a form, a dialog, something with state. Push it as far down the
tree as possible.

**Route handlers are the exception.** A server component that reads data and a
server action that writes it cover almost everything. Add `app/api/` only for
webhooks and things an external system calls.

**No `utils.ts`.** It becomes a landfill. Put a function next to the feature that
uses it; if a second feature needs it, move it then.

## Naming

- Files and folders: `kebab-case`
- Components: `PascalCase`, filename matches the export
- Functions and variables: `camelCase`
- Database tables and columns: `snake_case`, tables plural (`bookings`, `user_id`)
- Zod schemas: `<thing>Schema`
- Booleans read as assertions: `isActive`, `hasPaid`, not `active`, `paid`

Name things after the business, in the builder's vocabulary. If they say "enquiry",
the table is `enquiries` — not `leads`, not `contacts`, not `submissions`. The
builder should recognise their own business in the schema.
