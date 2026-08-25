# Stack

Settled. Never ask the builder about any of this.

| Concern | Choice |
|---|---|
| Language | TypeScript, `strict: true` |
| Framework | Next.js, App Router, `output: 'standalone'` |
| Runtime | Node LTS, in a container |
| Database | Postgres, self-hosted (`supabase/postgres` image) |
| Data access | `pg`, always through `withUser` — **the only data path** |
| Auth | Auth.js, users in the local database |
| File storage | Lightsail Object Storage (S3-compatible) |
| Styling | Tailwind CSS |
| Components | shadcn/ui |
| Validation | Zod |
| Email | Resend |
| Payments | PayMongo hosted checkout, in pesos |
| AI features | OpenRouter, via the `openai` SDK, server-side — see `ai.md` |
| Acceptance tests | Playwright |
| Unit tests | Vitest |
| Hosting | Amazon Lightsail, Singapore region, $7/month — see `deploy.md` |
| Reverse proxy / TLS | Caddy |
| Package manager | npm |

## Why `supabase/postgres` when there is no Supabase

The image is used for the database itself, not the hosted service. It ships the
`auth.uid()` helper and the extensions the policies in `access.md` rely on, and
it is the same image locally and in production — so a policy cannot behave one
way on a laptop and another on the server.

Supabase Auth and Storage are not used: self-hosting them means running eight
more containers, which does not fit on a $7 box. Auth.js and object storage cover
those instead.

## Why PayMongo

Most people buying from a Philippine site pay with GCash or Maya, not a card. A
checkout that only takes cards turns away the majority of them, so the payment
choice is settled by where the customers are, not by which API is nicest.

PayMongo is a local acquirer: one hosted page covering GCash, Maya, GrabPay, cards
and QR Ph, settling in pesos into a Philippine bank account. Everything is priced
in PHP and stored in centavos — see `data.md`. Charging in another currency is an
escalation, not a setting.

## No ORM

Prisma, Drizzle and friends are excluded, and this is the one exclusion worth
understanding, because it will look like an omission.

An ORM manages its own connections and gives you no place to put the
per-transaction identity that `access.md` depends on. Queries then run with no
`request.jwt.claim.sub` set, every policy matches nothing, and the app quietly
returns empty pages — or, if someone "fixes" that by connecting as `postgres`,
returns *everything* to *everyone*. Both failures are invisible in code review.

One data path: `pg`, always through `withUser`. One place authorization is
enforced: the database.

## Adding libraries

Prefer what is already here. Before adding a dependency, check whether a recipe
solves it and whether the framework solves it. If something genuinely new is
needed, it must be widely used, actively maintained, and typed — and it gets
logged in the spec's `decisions.md` with the reason.

Do not add: a state management library (server components and URL state cover it),
a CSS-in-JS library, a date library beyond `date-fns`, or an alternative to
anything in the table above.
