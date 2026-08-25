# Auth

**Gives you:** sign in, sign out, protected pages, the current user on the server,
and a session that refreshes itself.

**Use when:** anything is private to a particular person.

**Don't use when:** the whole site is public. Don't add accounts because software
usually has accounts — a marketing site with a login nobody uses is worse than one
without.

## Ask the builder

1. **Who needs to sign in?** Their customers, their staff, or both? (Determines
   whether anyone can sign up, or whether people are invited.)
2. **Can anyone sign up, or do you let them in?** Open signup, invite-only, or
   request-and-approve.
3. **Are there different kinds of people with different powers?** In their words —
   "managers can issue refunds, staff can't". Only ask if the spec hints at it.
   These answers become RLS policies, so vagueness here is a security hole.
4. **Do your customers work in teams, or is each person on their own?** Ask this
   on the first spec even if teams have never come up — it decides the shape of
   every table, and it is the one thing here that is dear to change later. If the
   answer is teams, stop and use `multi-tenancy.md` before building anything.

Never ask about: magic links vs passwords, session length, token storage, JWTs,
cookies, OAuth. All settled.

## Creates

```
lib/auth/config.ts            Auth.js setup, magic link provider
lib/auth/current-user.ts      the signed-in user, server-side
lib/db/pool.ts                connects as the `app` role — never `postgres`
lib/db/with-user.ts           the transaction wrapper every query goes through
app/api/auth/[...nextauth]/   Auth.js routes
middleware.ts                 protects the (app) group
app/(marketing)/sign-in/      magic link form
supabase/migrations/<ts>_create_auth.sql   users, sessions, the app role
```

If teams are involved, the `memberships` table and its policies come from
`multi-tenancy.md` rather than being invented here.

## Invariants

- Magic link by default. No passwords unless the builder asks, having been told
  they'll then own password resets and support requests about them.
- Every protected page checks the user server-side. A client-side redirect is a
  visual effect, not access control — the data has already been sent.
- RLS enforces access. Middleware is convenience, not security.
- **Every query goes through `withUser`,** which opens a transaction and sets
  `request.jwt.claim.sub`. Outside a transaction that setting does not survive,
  so a query anywhere else silently matches no rows. See `standard/access.md`.
- **The app connects as the `app` role.** The `postgres` role bypasses RLS, so
  using it turns every policy in the project into decoration.
- Signing out clears the session server-side.
- After signing in, the user lands where they were originally going.
- Sign-out clears the session server-side.
- The sign-in page says what happens next: *"Check your email — we've sent you a
  link."* People close the tab and never come back otherwise.
