# A thing people manage

**Gives you:** a table, access policies, list / detail / create / edit / remove,
validation, and acceptance tests — for one kind of thing. Bookings, invoices,
properties, patients.

**Use when:** users create and manage records of something.

**Don't use when:** it's write-only (use `public-form.md`) or read-only reference
data.

## Ask the builder

1. **What do you call one of these?** Their word, singular and plural. It becomes
   the table name, the page titles, and the buttons. Get it right and they
   recognise their business; get it wrong and everything reads slightly foreign.
2. **What do you need to record about each one?** Which parts are required.
3. **Who can see them, and who can change them?** In roles they recognise. This
   becomes the policy — see `standard/access.md`. If the app has teams, these are
   team-scoped and every invariant in `multi-tenancy.md` applies to this table too.
4. **If someone deletes one by accident, should you be able to get it back?**
   Almost always yes. Asked this way, never as soft vs hard delete.
5. **Does one of these change over time?** If there's a lifecycle — draft, sent,
   paid, cancelled — get the actual stages and who can move between them.

Never ask about: schema types, indexes, pagination, forms, routing, optimistic
updates.

## Creates

```
supabase/migrations/<ts>_create_<plural>.sql    table + RLS in one file
lib/validation/<singular>.ts                    Zod schema, shared
lib/<plural>/queries.ts                         reads
lib/<plural>/mutations.ts                       writes (server actions)
app/(app)/<plural>/page.tsx                     list
app/(app)/<plural>/[id]/page.tsx                detail
app/(app)/<plural>/new/page.tsx                 create
app/(app)/<plural>/[id]/edit/page.tsx           edit
components/<plural>/                            form, list item, empty state
tests/acceptance/<plural>.spec.ts
```

## Invariants

- Standard columns from `standard/data.md`, including `deleted_at`.
- RLS in the same migration as the table.
- One Zod schema, both sides.
- The list handles empty, loading, and error — see `standard/ui.md`. The builder
  sees the empty state first, before anything else in the feature.
- Lists paginate. Always, from the first version.
- Delete confirms, naming the specific thing.
- Every acceptance criterion in the spec has a test.
- Business names throughout. If they say "enquiry", nothing anywhere says "lead".
