# Pebot / CaféOS Constitution

Pebot (formerly CaféOS) is a local-first, single-tenant POS and ordering system
sold to independent restaurants and food businesses in the Philippines:
carinderias, cafés, fast food, casual dining, bakeries. One Windows PC per
location runs the whole stack. Staff terminals, the kitchen display, and customer
QR ordering are browsers on that location's LAN. There is no cloud backend and
no cross-location server.

This document supersedes any agent's defaults. If a request conflicts with a
principle below, follow the principle and say so — do not quietly pick one.

## Core Principles

### I. Local-first, offline-always (NON-NEGOTIABLE)

Ordering, payment recording, kitchen flow, and receipts MUST keep working with
zero internet connectivity. Each location's SQLite file is that location's source
of truth; nothing may assume a central database, a shared cache, or a remote API
is reachable. A feature that degrades to unusable when the WAN link drops is a
defect, not a trade-off.

### II. Two trust zones, enforced centrally

Customer devices arriving via table QR may reach ordering and menu endpoints
only. Staff, admin, and kitchen endpoints require an authenticated session with a
role. This MUST be enforced by shared middleware every route passes through — not
by each handler remembering to check. Socket.IO connections carry the same
session and role check as the equivalent HTTP route; realtime is not a weaker
trust model.

LAN origin restriction is defense-in-depth, not the control. Any phone on the
café Wi-Fi can reach the host, and origin headers can be spoofed, so network
position alone never authorizes anything.

### III. Money and records are append-only

- **One total, one place it is computed.** Order totals are calculated by exactly
  one function, from line items. No screen gets its own rounding or formatting
  logic.
- **Never trust a client-supplied amount.** Discounts, loyalty credit, and prices
  are derived server-side from the underlying records (voucher codes, product
  rows). A peso figure arriving in a request body is an input to validate, never
  a value to apply.
- **Receipts are sequential and immutable.** `receiptNumber` is assigned inside
  the same transaction that finalizes the order — never client-side, never
  reused, never renumbered.
- A finalized order or payment is never deleted or edited. Corrections happen via
  a linked reversal or adjustment record.
- **`AuditEvent` is append-only**: `INSERT` is allowed; `UPDATE` and `DELETE` are
  not.
- Anything that grants value and anything that consumes it happen in **one
  transaction**. A discount that commits while its voucher stays redeemable is a
  money bug.

### IV. Thin routes, domain modules

A route handler MUST NOT call `prisma.*` directly. It validates the request with
a Zod schema, calls exactly one domain service function, and serializes the
response. `prisma.*` is reachable only from a domain repository module. This one
rule is what stops drift: a year from now there is one obvious place to put
logic, not three plausible ones.

Validate at every boundary — route bodies, URL params, form submissions,
third-party responses. Client-side validation is a courtesy to the user; server
validation is the actual control.

### V. Electron is a shell, not the app

The desktop shell's only jobs are: launch the local server, open a kiosk window
pointed at localhost, and manage OS lifecycle (tray, auto-start, update checks).
Every route, domain rule, and piece of state lives in the web app, reachable by
any browser on the LAN. **The web app MUST remain fully usable with zero Electron
code**, because Electron — inheriting Chromium's CVE cadence — is the component
most likely to be replaced.

Hardening is mandatory: `contextIsolation: true`, `nodeIntegration: false`,
`sandbox: true` where feasible, no `remote` module, navigation restricted to the
app's own local origin.

### VI. Tests are the deliverable, not the chore

Every domain service function gets a Vitest unit test — no exceptions for "it's
simple." Every bug fix adds its regression test first (failing), then the fix.
Every acceptance criterion in a spec maps to a test.

**Never delete or weaken a test to make a build pass.** A failing test is
information; turning it green by changing what it asserts destroys the only
mechanism the owner has for knowing whether the software works. If a test is
genuinely wrong, say so plainly and explain why before changing it.

Types: `strict: true`, no `any`, no `@ts-expect-error` without a reason comment.

### VII. No silent data loss

Anything that can destroy data — restore, reset, bulk delete — requires
authenticated admin, explicit confirmation, and a pre-action snapshot. Database
restore specifically MUST verify a checksum before touching anything, snapshot
the current database, and swap through a controlled restart rather than a hot
file swap under an open connection pool.

Errors have three audiences: the person using it gets a plain sentence about what
happened and what to do next; the log gets the stack and enough context to find
it, with no personal data or tokens; the owner gets told in plain language. A
caught-and-ignored error is a bug that has been hidden rather than fixed.

### VIII. Commercial licensing fails closed, offline

Pebot is sold per location, at a one-time price for lifetime use. A location's
main PC runs business features only while it holds a license that the seller's
private key signed and that is bound to that PC's Machine Code.

- **No free access paths.** There is no trial, grace period, expiry or dev
  bypass, and licensing never depends on the date. A bug must not be able to
  grant free use.
- **Enforcement is central.** It lives in the local server that every HTTP
  request and socket passes through (Principles II and V), never only in
  Electron.
- **The app verifies but never mints keys.** The private key and the seller's
  keygen tool are never committed or shipped.
- **Licensing never touches restaurant data.** Activation, deactivation and
  revocation leave the database as it was.

## Locked Technical Decisions

Settled. Do not reopen these, and do not ask the owner about them.

| Concern | Choice |
|---|---|
| Language | TypeScript, `strict: true` |
| Framework | Next.js 15 (App Router), React 19 |
| Data | Prisma ORM + SQLite, one file per location |
| Realtime | Socket.IO, same auth as REST |
| State | Zustand |
| Styling | Tailwind CSS |
| Validation | Zod |
| Desktop shell | Electron + custom `server.js`, thin per Principle V |
| Tests | Vitest |
| Deployment | One self-contained Windows host per café, LAN-only, mDNS as `smartcafeos.local` |

Two facts that constrain scope: the app **records** payments (cash, GCash, bank
transfer), it does not process them through a live gateway — there is no PCI
scope, and adding a real card or wallet API requires a revision of this document
first. BIR accreditation (Permit-to-Use / CAS) is not being pursued, so do not
build machinery whose only purpose is certification — sealed hardware counters,
tamper seals. The financial-record discipline in Principle III is kept on its own
merits and happens to keep that door open.

`locationId` belongs on every business table, defaulted to this install's single
location, even though there is one today. It costs nothing now and is the
difference between "add a sync job" and "rewrite the schema" if a second branch
ever happens. Do not build sync; do not foreclose it.

Dependencies: pin major versions deliberately — no floating `^` on Next.js,
React, Prisma, Electron, or Socket.IO. Treat an Electron bump as a security task,
not a routine one.

## Working With the Owner

The person you are working with is the authority on their business and on what
the software should do. They are not the authority on how it is built, and asking
them to be produces worse software.

- **Never escalate a technical decision.** If it can be derived from this
  document or from ordinary engineering judgment, decide it and record it in the
  spec. Recording is not escalating.
- **Always escalate a business decision** — who may do what, money, personal
  data, what a customer sees, what things are called, what is in scope. A wrong
  guess here is invisible until it is expensive.
- **When a technical choice has a business consequence, ask the business question
  underneath it.** Not "soft delete or hard delete?" but "if someone deletes a
  customer by accident, should you be able to get them back?"

One question at a time, in plain language, with 2–4 concrete options and a
recommendation marked as such. Report what the software does now that it didn't
before — not which files changed.

## Development Workflow

Specs live in `specs/NNN-slug/`. The workflow is Spec Kit's:
`specify → clarify → plan → tasks → analyze → implement`, plus `converge` for
reconciling a spec against code that already exists.

**The workflow is never harness-dependent.** Command names differ per tool
(`/speckit-plan` in Claude Code, `/speckit.plan` in Kilo Code and opencode) and
some tools have no commands at all. When yours doesn't, read the matching skill
body under `.specify/` or the installed integration directory and follow it
directly. Never treat a harness-specific file as the source of truth: this
constitution and the specs are canonical, and everything under `.claude/`,
`.kilo/`, and `.opencode/` is generated adapter output.

Work is done when: tests pass, lint passes, typecheck and build pass, every
acceptance criterion is checked, no spec deviation is unresolved, and no
generated output, secrets, or debug scripts are committed. Temporary and debug
scripts are deleted as part of finishing a task, not left at the repo root "just
in case."

Never commit build output (`.next/`, `dist/`, the generated Prisma client) or
real secrets. `.env.example` documents every required variable with no values.

## Governance

This constitution supersedes agent defaults and prior practice. Amendments are
made by editing this file with a version bump and a note in the PR that changes
it — not by an agent deciding a principle is inconvenient. Where a rule can be
enforced mechanically (lint, CI, a type), the mechanical enforcement is the
control and the written rule is documentation of it.

Its ancestor document is `docs/archive/PEBOT_MASTER_PROMPT.md`, kept for
provenance only; this file is the live version.

**Version**: 1.1.0 | **Ratified**: 2026-08-27 | **Last Amended**: 2026-11-14

1.1.0 (2026-11-14): The owner widened the scope from cafés to restaurants and food
businesses, and Principle VIII (commercial licensing) was added for spec 015.
