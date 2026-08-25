# An internal list

**Gives you:** a searchable, filterable, sortable, paginated table with row actions
and CSV export. The screen the builder's staff live in all day.

**Use when:** someone internal works through records — enquiries to answer, orders
to fulfil, applications to review.

**Don't use when:** it's a customer-facing list (simpler, use `crud-resource.md`).

## Ask the builder

1. **What do you need to see at a glance?** Which columns, in what order. The
   answer is usually fewer than they first say.
2. **How do you find a particular one?** By name, reference, email — becomes search.
3. **How do you want to narrow it down?** By status, date, person — becomes filters.
   Ask what they'd do on a Monday morning; that's the default view.
4. **What do you do to one from this list?** Mark done, assign, reply, export.
5. **Does anyone need to do that to lots at once?** Only add bulk actions if yes.

Never ask about: pagination style, sort implementation, URL state, virtualisation.

## Creates

```
components/<feature>/table.tsx
components/<feature>/filters.tsx
lib/<feature>/queries.ts        search, filter, sort, paginate — server side
app/(app)/<feature>/page.tsx    reads filters from searchParams
tests/acceptance/<feature>-table.spec.ts
```

## Invariants

- **Filter, sort, and page state live in the URL.** So a view can be bookmarked and
  sent to a colleague, and so the back button works. Non-developers share links;
  state trapped in React means the link shows a different screen.
- Search, filter, sort and pagination happen in the database. Never load the table
  and filter in the browser — fine on fifty rows, fatal on fifty thousand.
- Debounce search input.
- Empty state distinguishes *nothing here yet* from *nothing matches your filters*,
  and the second one offers to clear them. Confusing these two makes the builder
  think their data is gone.
- Row actions confirm when destructive, naming the row.
- CSV export respects the current filters — exporting the whole table when the user
  has filtered it is a data leak in a spreadsheet.
- Works on a phone: the table becomes cards below `md`.
