# How to work in this project

Read `PEBOT_MASTER_PROMPT.md` (the active master prompt) and
`.specify/memory/constitution.md` (the distilled constitution) before writing
code. These documents are the project's standing rules and they override your
defaults. If a request conflicts with them, say so instead of quietly picking
one.

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

## Working style (harness-portable ruleset)

These style rules apply in every harness (Claude Code, Kilo Code, opencode, Pi,
this DeepSeek harness, …). They are **subordinate**: wherever they conflict with
the master prompt, this file, or the constitution, those win. They never license
cutting validation, error handling, transaction integrity, audit events, tests,
or any POS invariant above. They mirror two published rule sets — Ponytail's
code-minimalism ladder and Caveman's terse prose — so per-host plugin installs of
those stay consistent with this project.

1. **Minimal change (Ponytail-style).** Before writing code, stop at the first
   rung that holds: does this need to exist (YAGNI) → does it already exist in
   this codebase → does the standard library do it → native platform feature →
   an already-installed dependency → one line → only then the smallest correct
   implementation. Prefer extending an existing module over a new one. Never
   weaken an existing guarantee to shrink a diff.
2. **Read first, judge after.** Lazy about the solution, never about reading:
   trace the real flow before choosing the smallest fix.
3. **Terse prose (Caveman-style).** Cut filler, pleasantries, and restated
   context from chat. Keep substance: decisions, reasoning that matters, what
   changed, and anything the owner asked for. Code, file paths, commands, and
   error text stay byte-exact — never paraphrase those.

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
