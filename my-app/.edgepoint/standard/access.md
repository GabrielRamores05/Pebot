# Access

The most important file here. Everything else is craft; this is the part where a
mistake harms the builder's customers.

## Row Level Security is the only authorization mechanism

Not "as well as" checks in the application. **Instead of.**

Application-layer checks are enforced only on the code paths that remember them.
Every new query is a new chance to forget, and the failure is silent — the page
works, it just shows one customer another customer's data.

RLS is enforced by Postgres on every query, including the ones written next month
by a different model in a different session. It is the only mechanism that stays
correct as the codebase grows without a developer watching.

## The two things that make it real

Postgres is self-hosted (`deploy.md`), so nothing else enforces this. Both of
these are verified behaviour, not theory.

### 1. The app connects as a role that cannot bypass RLS

The `postgres` role in this image has **BYPASSRLS**. Connecting as it makes every
policy below decorative — they exist, they look right, and they never run.

So the app connects as a dedicated `app` role:

```sql
create role app login password :'app_password';
-- No superuser. No BYPASSRLS. Not the owner of any table.
grant usage on schema public to app;
grant select, insert, update, delete on all tables in schema public to app;
alter default privileges in schema public
  grant select, insert, update, delete on tables to app;
```

`DATABASE_URL` uses `app`. The `postgres` role is for migrations and backups
only, never for serving a request.

Tables are additionally marked `force row level security`, which applies policies
to the table owner too. Note that this does **not** stop a superuser or a
BYPASSRLS role — only connecting as the right role does.

### 2. Every query runs inside a transaction that sets the user

There is no GoTrue here, so nothing sets the identity for you. `auth.uid()` in
this image reads exactly one setting:

```sql
select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
```

`set_config(..., true)` is **transaction-local**. Set it outside a transaction,
or in a different one from the query, and it is already gone. Every request must
therefore open a transaction, set the claim, and query — in that order, together.

```ts
// lib/db/with-user.ts — the only way application code touches the database.
export async function withUser<T>(userId: string | null, fn: (tx: Tx) => Promise<T>) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ''])
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (e) {
    await client.query('rollback')
    throw e
  } finally {
    client.release()
  }
}
```

**Never query the pool directly.** A query outside `withUser` has no claim set,
so `auth.uid()` is null and policies match nothing.

The good news is the direction of that failure: forgetting the wrapper returns
**zero rows, not everyone's**. It fails closed. The bad news is that "the page is
empty" is a confusing bug rather than an obvious one — which is why this is a
rule rather than a suggestion.

## Policy shapes

**Owner only**
```sql
create policy "own rows" on bookings
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

**Team scoped** — see `recipes/multi-tenancy.md`, which defines the helper.
```sql
create policy "team rows" on invoices
  for all using (team_id in (select auth.team_ids()))
  with check (team_id in (select auth.team_ids()));
```

**Public read, owner write**
```sql
create policy "public read" on posts
  for select using (published and deleted_at is null);
create policy "owner writes" on posts
  for all using (auth.uid() = author_id) with check (auth.uid() = author_id);
```

`with check` as well as `using`, always, on anything writable. `using` decides
which rows can be changed; `with check` decides what they may be changed *into*.
Without it a user can move a row to another owner or another team — verified:
with it, that insert is rejected outright.

## Background work

Scheduled jobs and webhooks have no signed-in user. They connect as `postgres`
and therefore bypass RLS entirely, so they must scope every query by hand. This
is where leaks actually happen, because the safety net is off. Keep such code
small, in `lib/jobs/`, and obvious.

## Where the rules come from

The *Who uses it* section of `spec.md`. Every role the builder named must have a
policy. A role in the spec with no policy is an unfinished build.

Ask about access in business terms — "should a receptionist see another branch's
bookings?" — never in terms of policies or claims.

## Authentication

Auth.js, with sessions as JWTs and users in the local database. The signed-in
user's id becomes `request.jwt.claim.sub` on every request, via `withUser`.

Email magic links by default: no password to store, reset, or leak. Add OAuth
providers only if the builder asks for a specific one.

Middleware protects the `(app)` route group and every protected page checks the
user server-side. A client-side redirect is a visual effect, not access control —
the data has already been sent.

Authentication is technical — never ask about it. Authorization is business —
always ask.

## Secrets

Server-side environment variables only. `NEXT_PUBLIC_` is for values safe on a
billboard. Never commit a real key. `.env.example` lists every variable with a
description and no values.
