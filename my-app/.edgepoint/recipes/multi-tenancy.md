# Teams and companies sharing one app

**Gives you:** a tenant model — teams, memberships, roles — and tenant-scoped
access rules on every table, so one customer can never see another's data.

**Use when:** several separate businesses, teams, or households use the same app
and must not see each other's data. Any product sold to companies rather than to
individuals.

**Don't use when:** it's one company's internal tool, or every user genuinely
works alone. Adding tenancy "in case" costs real complexity on every table and
every query, forever.

## Decide this before building anything else

This is the one architectural decision that is genuinely expensive to reverse.
Retrofitting tenancy onto an app that has data in it means touching every table,
every query, and every access rule — and any mistake during that migration leaks
one customer's data to another.

So ask question 1 below **during `/clarify` on the first spec**, before any table
exists. Ask it even when the builder hasn't mentioned teams. Phrase it as the
business question, and say plainly that it is dear to change later — the framework
promises to flag exactly this kind of decision:

> Will people use this on their own, or will whole companies sign up with several
> staff sharing the same information?

## Ask the builder

1. **Do your customers work in teams, or is each person on their own?** If teams:
   everything below. If not, stop — use `auth.md` and skip this recipe.
2. **What do you call one of those groups?** Their word: workspace, organisation,
   practice, branch, firm, household. It becomes the table name, the page titles,
   and the button that says *Create a new ___*.
3. **Can one person belong to more than one?** A consultant serving several
   clients, yes. Staff at a single company, usually no. This changes whether the
   app needs a switcher, so ask it even though the answer feels obvious.
4. **Within a team, are there different levels of access?** In their words —
   "the owner can change billing, everyone else just does the work". Get the
   actual list; these become roles, and a vague answer here becomes a security
   hole later.
5. **Who can invite new people?** Usually owners and admins. See `team-invites.md`.
6. **When someone leaves a team, what happens to the things they created?** Almost
   always: the work stays with the team, the person loses access. Confirm it —
   builders occasionally mean the opposite.
7. **Does each team pay separately?** If yes, the subscription belongs to the team,
   not the person — see `payments.md`.

Never ask about: shared vs separate databases, tenant identification, JWT claims,
connection pooling, schema design, or how policies are written.

## Creates

```
supabase/migrations/<ts>_create_tenancy.sql   teams, memberships, RLS, helpers
lib/tenancy/current.ts                        the acting user's current team
lib/tenancy/guard.ts                          server-side membership + role checks
components/tenancy/switcher.tsx               only if question 3 was yes
app/(app)/[team]/...                          team-scoped routes
app/(app)/settings/team/                      members, roles, leaving
tests/acceptance/tenant-isolation.spec.ts     the important one — see below
```

## How tenancy is implemented

Settled; do not raise any of it with the builder.

**One database, a `team_id` column on every table, isolation enforced by RLS.**
Not a schema per team, not a database per team. Those isolate more strongly on
paper, but every schema change has to be applied N times, and a non-developer has
no way to recover when the twelfth of forty tenants fails to migrate. One schema
keeps migrations atomic and reviewable.

**Membership is looked up, not carried in the token.** Policies resolve the acting
user's teams through a `security definer` helper that reads `memberships`, rather
than reading a team id from a JWT claim. A claim is faster but goes stale: someone
removed from a team keeps access until their token expires. Correctness wins —
removal must take effect immediately, because the reason someone is being removed
is sometimes urgent.

**The helper is `stable` and the membership columns are indexed**, so the lookup
is cached per statement rather than run per row.

Log both of these in the spec's `decisions.md`.

## Policy shape

Every tenant table gets the same shape. Do not improvise variations:

```sql
create or replace function auth.team_ids()
returns setof uuid language sql stable security definer set search_path = '' as $$
  select team_id from public.memberships where user_id = auth.uid()
$$;

alter table invoices enable row level security;

create policy "team members read" on invoices
  for select using (team_id in (select auth.team_ids()));

create policy "team members write" on invoices
  for all using (team_id in (select auth.team_ids()))
  with check (team_id in (select auth.team_ids()));
```

Role-gated actions add a role test on top, never replacing the team test:

```sql
create policy "owners manage billing" on subscriptions
  for all using (
    exists (select 1 from memberships
            where user_id = auth.uid() and team_id = subscriptions.team_id
              and role in ('owner', 'admin'))
  );
```

## How tenants reach the site

One server, one container, every tenant — see `standard/deploy.md`. Which tenant
a request belongs to comes from the `Host` header, resolved in middleware before
anything else runs.

Three shapes, all supported by the same deployment:

| | |
|---|---|
| `yourapp.com` | the main site — marketing, sign-up |
| `acme.yourapp.com` | a tenant subdomain, the default for a new team |
| `app.acmecorp.com` | a tenant's own domain, usually a paid feature |

Certificates for the last two are issued on first request. A new tenant needs no
deployment and no certificate work.

### `/api/tls-allowed` is mandatory

Caddy asks this endpoint, for every unrecognised hostname, whether to get a
certificate for it. It must:

- return **200** only for a hostname that resolves to a real tenant — a `teams`
  subdomain or a verified custom domain
- return **404** for everything else
- be fast, and never require a session

Without it, anyone who points DNS at the server makes it request certificates on
their behalf, Let's Encrypt rate-limits the whole box, and **new tenants stop
being able to sign up**. It is a security control, not plumbing.

Ask the builder the business question — *"should customers be able to use their
own web address?"* — and never the certificate question.

### Custom domains must be verified

Before a custom domain is accepted, the tenant proves they control it: a TXT
record with a token you generated. Otherwise one customer can claim another's
domain, and your server will cheerfully get a certificate for it.

## Invariants

Every one of these is a data leak if broken. None is negotiable.

- **Every tenant table has `team_id uuid not null references teams(id)`.** A
  nullable `team_id` is a row belonging to nobody, visible to nobody or everybody
  depending on the policy — both are bugs.
- **RLS enabled, with policies, in the same migration that creates the table.**
  A tenant table without a policy is every tenant's data in one pile.
- **`with check` as well as `using` on write policies.** `using` controls which
  rows can be changed; `with check` controls what they can be changed *into*.
  Without it, a member can move a row into another team.
- **Never accept `team_id` from the client.** Derive it server-side from the
  session and the route. A form field, hidden input, or request body naming a team
  is an invitation to read someone else's data by editing one value.
- **Unique constraints are scoped to the team.** `unique (team_id, slug)`, never
  `unique (slug)`. A global unique constraint lets one customer discover another's
  data by watching which names are rejected, and breaks the second team to try an
  obvious name.
- **A child row's team must match its parent's.** Enforce with a composite foreign
  key (`foreign key (team_id, invoice_id) references invoices (team_id, id)`), not
  by remembering to check in application code.
- **Anything counted or numbered per team restarts per team.** Invoice numbers,
  reference codes, order numbers. A global sequence tells every customer how many
  customers you have and how fast they are growing.
- **Background code must scope explicitly.** Webhooks and scheduled jobs run with
  no signed-in user and connect as `postgres`, which bypasses RLS entirely — see
  `standard/access.md`. Every such handler must resolve its team from the payload
  and filter by it by hand. This is where tenant leaks actually happen in
  practice, because the safety net is switched off.
- **The tenant comes from the hostname, never from the request.** Not a query
  parameter, not a header the browser can set, not a form field. Resolve it in
  middleware from `Host` and carry it server-side.
- **A hostname is claimed once.** Two teams must never be able to register the
  same subdomain or custom domain; enforce with a unique constraint, not a check
  in application code.
- **Removing someone takes effect immediately** — no waiting for a token to expire.
- **Deleting a team soft-deletes it and everything under it**, and members lose
  access at once.
- **There is a test that proves isolation.** Two teams, two users, and an assertion
  that each sees only their own rows across list, read, update, and delete. Write
  it first, run it on every change, and never weaken it. It is the only evidence
  the builder can be given that their customers are separated — and unlike the
  other acceptance criteria, its failure mode is silent.
