# Deploy

One Lightsail server. One deployment. Everything on it.

| | |
|---|---|
| Server | Amazon Lightsail, Ubuntu LTS, the $7/month plan |
| Region | Singapore (`ap-southeast-1`) — nearest to the Philippines |
| Specs | 1 GB RAM, 2 vCPU, 40 GB SSD, 2 TB transfer |
| Runs | Caddy, the app, Postgres — via `deploy/compose.prod.yaml` |
| Built by | GitHub Actions, never on the server |
| HTTPS | Caddy, automatic |
| Backups | nightly `pg_dump` on the box, plus Lightsail snapshots |

Never ask the builder about any of this. Hosting, build pipeline, TLS and
process management are settled.

## The build never happens on the server

1 GB is enough to *run* this stack and nowhere near enough to build it — Next.js
wants several gigabytes to compile. Lightsail has no ARM plans either, so an
Apple Silicon laptop can't build a matching image quickly.

So: push to `main` → GitHub Actions builds a `linux/amd64` image → pushes it to
GHCR → the server pulls it and restarts. The server never compiles anything, and
a deploy is a download.

That also makes rollback trivial: the previous image is still on the box.

## One deployment serves every tenant

A multitenant app is **one** server, one database, one container. Tenants are
separated by row level security (`access.md`), not by infrastructure.

Never provision per tenant. No server each, no database each, no container each.
That trade — cheap and simple, with isolation enforced in the database — is the
whole reason `multi-tenancy.md` insists so hard on those invariants: they are
what makes a single box safe to share.

A $7 box comfortably serves a few thousand users across many tenants. When it
stops being enough, the move is to a larger Lightsail plan — the same setup, one
line changed. Do not re-architect for scale nobody has yet.

## How tenants reach the site

Three shapes, all served by the same container, which reads the `Host` header to
decide which tenant it is looking at:

- `yourapp.com` — the main site. Certificate issued at startup.
- `acme.yourapp.com` — a tenant subdomain.
- `app.acmecorp.com` — a tenant's own domain.

The last two get their certificate on the first request to them, so a new tenant
needs no deployment and no certificate work.

**This requires the app to expose `/api/tls-allowed`.** Caddy asks it, on every
unknown hostname, whether that hostname belongs to a real tenant. It must answer
200 only for hostnames it recognises. Without it, anyone who points DNS at the
server makes it request certificates on their behalf, and Let's Encrypt will
rate-limit the whole box — taking new tenants down with it.

Let's Encrypt allows 50 new certificates per registered domain per week. That is
a lot of new tenants, but it is not unlimited, and it is worth knowing before a
launch that signs up hundreds at once.

## Environments

Two: local (`./edge dev`, see `environment.md`) and production.

There is no staging server. A second box doubles the cost and the number of
places to be confused about; branch previews are not worth $7/month each at this
size. Test locally, ship to production, and rely on being able to go back.

## First-time setup

Once per project, by whoever sets it up — not by the builder:

1. Lightsail → create instance → **Singapore (`ap-southeast-1`)** → Ubuntu LTS →
   $7 plan. Singapore is the closest region to Manila; a US region adds roughly a
   fifth of a second to every page, which is felt on a phone on mobile data.
2. Attach a **static IP**, or the address changes on reboot
3. Firewall: 80 and 443 open, 22 restricted to your own address
4. Turn on **automatic snapshots**
5. Run `deploy/provision.sh` on the box — Docker, 2 GB of swap, log limits,
   nightly backups, unattended security updates
6. Put `.env` in `/srv/app/`
7. GitHub → repository secrets: `SSH_HOST`, `SSH_USER`, `SSH_KEY`, `GHCR_TOKEN`
8. DNS: an A record to the static IP, and `*.yourapp.com` to the same address

The swap matters. 1 GB leaves nothing spare, and without swap a brief spike
during a migration or a backup gets something killed — usually Postgres.

## Before production

- acceptance tests pass
- no open escalations the builder hasn't been told about
- every environment variable the code reads exists in `/srv/app/.env`
- migrations reviewed — they are the one step a rollback cannot undo
- an actual person has loaded the actual site

## Rollback

The previous image is still on the server, so putting the old version back takes
seconds. The deploy does it automatically when the new version fails its health
check.

Database migrations do not roll back with it. Additive changes first — add a
column, don't rename one; write to both, stop reading the old one, then drop it.
A migration that drops or renames something in the same deploy that stops using
it cannot be undone by restarting the old container. The deploy takes a backup
before migrating, but restoring one means losing whatever was written since.

## Backups

Nightly `pg_dump` to `/srv/app/backups`, kept 7 days, plus a dump immediately
before every deploy. Lightsail automatic snapshots are the off-machine copy —
a dump on the same disk is not a backup of that disk.

**A backup nobody has restored is a hope.** Restore one into local development
before the first real customer, and then occasionally.

A backup is a complete copy of everyone's personal data, so it is subject to
everything in `privacy.md`: it stays on the server and in Lightsail, it is never
downloaded to a laptop or attached to an email, and a restored copy in local
development is real customer data and is deleted when you are done with it.
Erasure requests are not applied to existing backups — they age out on the
schedule above, and the privacy notice says so.

## Secrets

`/srv/app/.env` on the server, and GitHub repository secrets for the deploy.
Never committed. `.env.example` lists every variable with a description and no
values.

Never invent an API key. Ask for exactly the one needed, say what it's for and
where to get it. If a secret is ever committed, say so immediately, in plain
language, and rotate it — the history still has it.

## What this costs

$7/month, plus a domain, plus object storage for uploads (about $1). No
per-seat, per-build or per-request charges, and no bill that grows because a
page went viral. The ceiling is real: when the box is full, it is full.
