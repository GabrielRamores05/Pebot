# Where things run

Everything runs in containers. The builder installs Docker and nothing else.

This is not a preference about tooling. A non-developer cannot diagnose a wrong
Node version, a missing Playwright browser, or a Postgres that won't start, and
every one of those failures looks identical to them: it didn't work. Containers
turn "install these six things correctly" into "install Docker".

## Never install anything on the builder's machine

Not Node, not npm packages globally, not the Supabase CLI, not Playwright
browsers, not Postgres. If a task seems to need a host install, it needs a
container instead.

Never tell the builder to run `npm`, `npx`, `node`, or `psql` directly. They will
not have them, and being told to install them is the exact experience this
removes.

## One command

Every project has an `./edge` script. It is the only entry point.

```
./edge dev            start the app — http://localhost:3000
./edge stop           stop everything
./edge test           run the acceptance tests
./edge guide          build the printed test guide
./edge npm <args>     run npm inside the container
./edge npx <args>     run npx inside the container
./edge psql           open the database
./edge migrate        apply any new database changes
./edge shell          a shell inside the container
./edge reset          wipe the local database and start fresh
./edge logs           watch what the app is doing
```

Use these. Do not invent `docker compose` invocations at the call site — if
something can't be done through `./edge`, that is worth saying out loud rather
than working around.

## What runs where

| | |
|---|---|
| `app` | Next.js dev server, port 3000 |
| `toolbox` | one-off commands — npm, tests, scripts |
| `db` | Postgres with the Supabase extensions, port 54322 |

`app` and `toolbox` share one image, built from `Dockerfile.dev`, based on
Playwright's image because it already carries the browsers and their system
libraries — the single most awkward dependency to install by hand.

`node_modules` lives in a named volume, not on the host. A host `node_modules`
bind-mounted over the container's would shadow it with binaries built for the
wrong platform, which produces errors nobody can read.

## The test guide runs somewhere else entirely

`./edge guide` builds the printed test guide (the `test-guide` skill) in a second
stack described by `compose.guide.yaml`: its own compose project, its own
database, nothing published on the machine, and a teardown that runs however the
command ends — including a cancelled one.

Three reasons it cannot share the dev stack:

- Those screenshots get printed and handed to other people. The builder's local
  database must never appear in one — see `privacy.md`.
- The guide has to show the software as a new customer finds it. The guide's
  database exists in memory only and is built fresh every run, so it does.
- A builder should be able to keep working. `./edge dev` stays up and keeps
  port 3000; the guide publishes nothing and reaches the app as `app:3000` from
  inside its own network.

## Migrations

`./edge migrate` applies everything in `supabase/migrations/` in filename order,
recording each one in a `_edgepoint_migrations` table so it runs exactly once.
`./edge dev` and `./edge test` do it for you, so a new migration takes effect
without anyone remembering a step.

Tracking in the database rather than assuming a fresh start matters: migrations
have to apply to a database that already has data in it, which is the normal case
after the first day.

To start over — a migration was wrong, or the local data is in a bad state —
`./edge reset` wipes the local database and replays everything. That only touches
the local container. It cannot reach production.

Migrations are deliberately **not** mounted into the image's
`/docker-entrypoint-initdb.d`. Anything mounted onto that directory hides the
Supabase image's own bootstrap — the `postgres` role, the `auth` schema, the
extensions — and the result is a database that reports itself healthy and then
fails every query with `role "postgres" does not exist`.

## Local development is fully offline

Sign-in works with no network and no accounts anywhere: Auth.js keeps users in
the local Postgres container, and the same `supabase/postgres` image runs locally
and in production — so `auth.uid()` and every policy behave identically in both.

The one exception is uploads. Object storage is a real bucket (`deploy.md`), so
file features need credentials in `.env.local`. Use a separate bucket from
production — never the production one.

## Local and production are the same shape

Both run the same three things: Caddy only in production, but the same app image
build, the same database image, the same migrations, applied by the same
tracking table. The difference is that production's image is prebuilt by CI and
local development bind-mounts the source.

Where they differ, say so out loud rather than letting a builder discover it
after shipping.

## When Docker isn't running

Say so plainly and stop: *"Docker isn't running — start Docker Desktop and I'll
try again."* Do not fall back to running things on the host. A build that
half-works on one machine and not another is worse than one that clearly refuses.
