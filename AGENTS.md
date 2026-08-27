# How to work in this project

Read `.specify/memory/constitution.md` before writing code. It is the project's
standing rules and it overrides your defaults. If a request conflicts with it,
say so instead of quietly picking one.

Then read the spec you are working on, in `specs/NNN-slug/`.

## What this is

CaféOS is a local-first café POS: one Windows PC per location runs a Next.js app
plus Socket.IO over the café LAN, with SQLite as that location's source of truth.
No cloud backend. Customer phones order via table QR; staff, admin, and kitchen
are browsers on the same LAN at different trust levels. The app lives in
`my-app/`.

## The rules that are broken most often

1. Never call `prisma.*` outside a domain repository module. Route handlers
   validate input, call one service function, serialize the response.
2. Never trust a client-supplied peso amount. Derive discounts and prices
   server-side from voucher codes and product rows.
3. Anything that grants value and anything that consumes it go in one
   transaction.
4. Never commit build output (`.next/`, `dist/`, the generated Prisma client) or
   real secrets.
5. Delete your temporary and debug scripts before calling a task done.
6. Never weaken a test to make a build pass.

## The workflow

`specify` → `clarify` → `plan` → `tasks` → `analyze` → `implement`, plus
`converge` when a spec has to be reconciled against code that already exists.
This project uses [GitHub Spec Kit](https://github.com/github/spec-kit); specs
live in `specs/NNN-slug/`.

**The workflow does not depend on which tool you are running in.** How you invoke
it does:

| Harness | Invocation |
|---|---|
| Claude Code | `/speckit-plan` (skills in `.claude/skills/`) |
| Kilo Code | `/speckit.plan` (commands in `.kilo/commands/`) |
| opencode | `/speckit.plan` |
| Plain terminal | `pebot spec …` — see `docs/pebot-cli.md` |
| Anything else | Read the matching skill body under the installed integration directory and follow it |

If a command isn't available in your tool, that is not a blocker: open the
corresponding file and do what it says.

Everything under `.claude/`, `.kilo/`, and `.opencode/` is **generated** by
`specify`. Don't hand-edit it — it will be overwritten. The canonical content is
this file, `.specify/`, and `specs/`.

## Checks before you call something done

Run from `my-app/`:

```bash
npm run lint
npx tsc --noEmit
npm run test:unit
```

Or `pebot check` from anywhere in the repo, which runs all three.

Work is done when those pass, every acceptance criterion in the spec is checked,
and no spec deviation is left unresolved.

## Talking to the owner

They are the authority on their business, not on how the software is built. Never
ask them a technical question you can answer from the constitution — decide it and
record it. Always ask a business question: money, who may do what, personal data,
what a customer sees. When a technical choice has a business consequence, ask the
business question underneath it.

Tell them what their software does now that it didn't before. Not which files you
touched.
