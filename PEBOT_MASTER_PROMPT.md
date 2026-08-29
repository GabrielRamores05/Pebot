# Pebot / CaféOS — Engineering Constitution & Master Prompt

> **Active master prompt.** This document overrides all AI agent defaults
> when working in this repository. If a request conflicts with a rule below,
> follow this document and flag the conflict instead of silently picking one.
> The distilled version lives at `.specify/memory/constitution.md`.

**Status:** v1 draft — built from your repo (`GabrielRamores05/Pebot`), your answers, and current CLI tooling. Sections marked `[CONFIRM]` are my working assumption, not a fact you gave me — correct them and I'll revise.

**How to use this document:**
1. As a human, read it once, correct the `[CONFIRM]` items, and treat everything else as the standing rules for this project.
2. As an AI coding agent (Claude Code, Cursor, Copilot, etc.) working in this repo: **this document overrides your defaults.** If a request conflicts with a rule below, follow this document and flag the conflict instead of silently picking one.
3. This doc is also written to be pasted straight into `/speckit.constitution` if you adopt the CLI recommended in Section 8 — it's structured so that command can ingest it directly.

---

## 1. What Pebot / CaféOS Is

CaféOS is a **local-first, single-tenant POS and ordering system** for independent cafés/QSRs in the Philippines. One Windows PC per location runs the whole stack (Next.js app + Socket.IO, packaged in Electron); staff terminals, the kitchen display, and customer QR ordering are all just browsers on that café's LAN talking to `smartcafeos.local`. There is no cloud backend and no cross-location server today.

**Non-negotiable identity facts** (do not "fix" these — they're intentional):
- The system **MUST** keep working with zero internet connectivity for all core operations (ordering, payment recording, kitchen flow, receipts).
- Each location's data (`SQLite` file) is that location's **source of truth**. Nothing may assume a central database exists.
- The customer-facing QR flow and the staff POS/kitchen flow **MUST** be treated as two different trust levels hitting the same server (see Section 6).

---

## 2. Locked Decisions (from your answers — treat as fact)

- **BIR accreditation (Permit-to-Use / CAS):** Not being pursued. **Do not** build machinery whose only purpose is BIR-CAS certification (sealed/hardware non-resettable counters, DTI-style tamper seals, etc.). *However* (see Section 5), basic financial-record discipline — sequential receipt numbers, append-only transaction history — is being kept anyway because it's good practice on its own merits and keeps the door open if this decision changes later.
- **Deployment:** one self-contained Windows host per café, LAN-only, mDNS-advertised, Electron-packaged, SQLite via Prisma. Not changing this model.
- **`.edgepoint`:** I could not find a public tool by this name, and the only scaffolding artifact visible at the repo root is `.kilo/plans` (Kilo Code, a real AI-coding-agent extension), not `.edgepoint`. **[CONFIRM]** — tell me if `.edgepoint` is a private/internal tool nested inside `my-app/` and paste its contents; otherwise I'm treating it as dead scaffolding to be deleted per Section 11.

## 2a. Assumed (not yet confirmed by you) — override any of these freely

- **[CONFIRM] Multi-location:** No sync exists today and none is being scheduled. My default is: *don't build sync, but don't foreclose it either* — Section 5's append-only event table is the low-cost insurance policy for this. If you're certain this will **always** be one isolated store forever with zero chance of a second branch, tell me and I'll drop that requirement to simplify the schema.
- **[CONFIRM] Payments:** Your own spec doc lists Cash, GCash, and bank transfer as recorded payment methods with "card-based internal handling conventions" — read as: the app **records** payments, it does not **process** them through a live gateway. I'm designing on that basis (no PCI scope). If you ever integrate a real card/GCash API directly into the app, that's a different, heavier security posture and this document needs a revision pass before that work starts.
- **[CONFIRM] Team:** Assumed to be you, building primarily through AI coding agents, possibly with occasional outside help. This affects how heavy the process in Section 8 should be — a solo/AI-driven team needs process that *prevents regressions* without slowing you down; it should not be enterprise ceremony for its own sake.

---

## 3. Tech Stack — Locked, With Rationale

| Layer | Choice | Status |
|---|---|---|
| App framework | Next.js 15 (App Router), React 19, TypeScript | **Keep.** Already working, well-supported, not worth a rewrite. |
| Data | Prisma ORM + SQLite | **Keep.** Correct choice for single-node local deployment. |
| State | Zustand | **Keep.** |
| Styling | Tailwind | **Keep.** |
| Realtime | Socket.IO | **Keep**, but see Section 6 for the auth gap around it. |
| Desktop shell | Electron + custom `server.js` | **Keep for now, but isolate it (see below).** This is the one component I'd flag for a real conversation — see next paragraph. |
| Tests | Vitest | **Keep, expand coverage per Section 9.** |

**On Electron, specifically:** Electron is the single highest-maintenance-cost, highest-attack-surface piece of this stack — you inherit Chromium's CVE cadence indefinitely, and it's a heavier install than a POS terminal strictly needs. I'm not telling you to rip it out; rewriting a working desktop shell is expensive and you'd be trading a known cost for an unknown one. Instead, the architectural rule going forward is:

> **The Electron shell MUST NOT contain business logic.** Its only jobs are: launch the local server process, open a kiosk-mode window pointed at `localhost`, and manage the OS-level lifecycle (tray icon, auto-start, update checks). Every route, every domain rule, every bit of state lives in the Next.js app, reachable by any browser on the LAN. If in five years you decide Electron isn't worth the patching burden and want to swap it for a plain kiosk-mode browser + a background Windows service, that should be a one-file change, not a rewrite.

This is the core "10-year" insurance for this stack: **the web app must always be able to run and be fully usable with zero Electron code**, because Electron is the part most likely to need replacing.

**Dependency policy:** pin major versions deliberately in `package.json` (no floating `^` on Next.js, React, Prisma, Electron, Socket.IO); document an upgrade cadence (quarterly check-in is enough for a solo/small team) rather than auto-updating; treat Electron version bumps as a security task, not a routine bump, because that's where Chromium CVEs live.

---

## 4. Repository Structure — Target Layout

Current state: the real project lives nested in `my-app/` inside the `Pebot` repo, with build output and one-off scripts scattered at the repo root. Target:

```
pebot/                          # repo root == project root (see Section 11)
├── .specify/                   # spec-kit: constitution, specs, plans (Section 8)
├── .claude/skills/             # project + spec-kit agent skills (Section 10)
├── docs/
│   ├── archive/                # completed/historical specs (e.g. the old 10-10 UI spec)
│   └── decisions/              # ADRs — one file per significant architecture decision
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── scripts/                    # backup.ts, restore.ts, seed.ts — invoked by the CLI, not run ad hoc
├── src/
│   ├── app/                    # Next.js routes (thin — see Section 6)
│   ├── modules/                # one folder per business domain, NOT per technical layer
│   │   ├── orders/
│   │   │   ├── service.ts      # business logic, the only thing route handlers call
│   │   │   ├── repository.ts   # the only file allowed to import the Prisma client for this domain
│   │   │   ├── schema.ts       # zod input/output schemas
│   │   │   └── service.test.ts
│   │   ├── catalog/
│   │   ├── inventory/
│   │   ├── loyalty/
│   │   ├── tables/
│   │   ├── payments/
│   │   └── settings/
│   ├── lib/                    # cross-cutting: auth, socket bootstrap, db client, logger
│   └── electron/                # the thin shell described in Section 3, nothing else
└── package.json
```

**Rule:** a route handler under `src/app/api/**` **MUST NOT** call `prisma.*` directly. It parses/validates the request, calls exactly one `modules/*/service.ts` function, and serializes the response. This one rule is what stops "vibe coding drift" — six months from now, an agent adding a feature has one obvious place to put logic instead of three plausible ones.

---

## 5. Data & Domain Invariants

These are rules the data model must enforce, not just "try to." Violating any of these is a bug regardless of which feature was being built.

1. **One total, one place it's computed.** Order total is calculated by exactly one function, from line items, at read time. No screen is allowed its own rounding/formatting logic (this was already an identified bug in your own `cafeos-pos-10-10-spec.md` — the rule needs to survive as a standing invariant, not just a one-time fix).
2. **Receipts are sequential and immutable.** `receiptNumber` is assigned inside the same DB transaction that finalizes the order, never client-side, never reused, never renumbered. A finalized order/payment record is **never deleted**; corrections happen via a linked reversal/adjustment record, not an edit. (This is the "keeps BIR-readiness cheap later without chasing BIR-readiness now" rule from Section 2.)
3. **Append-only `AuditEvent` table**, from day one, even though nothing consumes it yet:
   ```
   AuditEvent {
     id, entityType, entityId, action, payloadJson,
     actorUserId, occurredAt, locationId
   }
   ```
   Application code may `INSERT` into this table; it may never `UPDATE` or `DELETE` from it. This is the single cheapest insurance policy for the open "multi-location later?" and "BIR later?" questions — it costs almost nothing to add now and is genuinely expensive to retrofit once years of orders exist without it.
4. **`locationId` on every business table**, defaulted to this install's single location, even in the current single-tenant world. Costs nothing today; is the difference between "add a sync job" and "rewrite the schema" if a second branch ever happens.
5. **Backups are files, not live cutovers.** `/api/restore` swapping the live SQLite file while the server holds connections open is the riskiest endpoint in the system today. New rule: restore **MUST** (a) require authenticated admin + a confirmation step, (b) verify a checksum on the uploaded file before touching anything, (c) snapshot the current DB before overwriting it, (d) perform the swap through a controlled server restart, not a hot file swap under an open connection pool.

---

## 6. API & Access Rules

- **Two trust zones, enforced centrally, not per-route.** Customer devices (via QR) may only ever reach ordering/menu endpoints. Staff/admin/kitchen endpoints require an authenticated session with a role. This **MUST** be enforced by shared middleware that every route passes through — not by each route handler remembering to check.
- **LAN origin restriction is defense-in-depth, not the control.** Any device joining the café Wi-Fi can currently reach port 3000; origin headers can be spoofed. Admin, POS, kitchen, and `/api/restore` need real session auth regardless of network position.
- **Socket.IO events carry the same auth as REST.** A socket connection inherits the same session/role check as the HTTP routes — no separate, weaker trust model for realtime.
- Every route validates input with a `zod` schema (already implied by module structure in Section 4) and returns a typed, versioned response shape — internal-only API, but freezing the contract avoids UI/API drift as features accumulate.

---

## 7. Security Baseline

- **Auth:** real per-role session (cookie-based is fine for a LAN app), not origin-based trust. Rate-limit the login endpoint.
- **Electron hardening:** `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` where feasible, no `remote` module, navigation restricted to the app's own local origin only.
- **Secrets:** none hardcoded; loaded from env; a committed `.env.example` documents every required variable with no real values.
- **File permissions:** the SQLite file and any backup files should not be world-readable on the host OS; document the expected file ACLs in the setup guide.
- **No silent data loss paths:** anything that can destroy data (restore, reset, bulk delete) requires explicit confirmation + a pre-action snapshot, per Section 5.4.

---

## 8. CLI & Spec-Driven Development Workflow

**Recommendation: don't build a bespoke SDD CLI — adopt [GitHub's Spec Kit](https://github.com/github/spec-kit).** It's MIT-licensed, ~129k stars, actively maintained (1,795+ commits), works with Claude Code natively, and — critically for your situation — has a purpose-built **brownfield/iterative-enhancement mode** for exactly "I have an existing codebase, formalize it" instead of only greenfield generation. That's a better bet for "still standing in 10 years" than any custom tool, because you're not the one who has to maintain it.

Setup:
```bash
uv tool install specify-cli
cd pebot
specify init --here --integration claude --integration-options="--skills"
```
The `--skills` flag installs the workflow as proper Claude Agent Skills under `.claude/skills/speckit-*` (matching Anthropic's own `SKILL.md` format — name + description frontmatter, progressive disclosure) instead of slash-command prompt files. That's the direct answer to "skills of agents" from your original ask.

Then, in order:
```bash
/speckit.constitution   # seed this from Section 1-2 of THIS document
/speckit.specify        # per-domain specs (orders, loyalty, inventory, ...), seeded from your existing SYSTEM_SPEC_ENGINEERING.md
/speckit.clarify        # resolve ambiguities before planning
/speckit.plan           # technical plan per feature, constrained by Section 3-4 of this doc
/speckit.tasks          # task breakdown
/speckit.converge       # reconcile against the EXISTING codebase — this is the brownfield command, run it early
/speckit.implement
```
`SYSTEM_SPEC_ENGINEERING.md` is good raw material for `/speckit.specify` — it's comprehensive and accurate, it's just descriptive ("this is what exists") rather than prescriptive. Feeding it in gives the agent real context instead of starting from nothing.

**Separately, a small project-specific ops CLI** (a `pebot` bin in `package.json`, plain Node + `commander` — no need for anything heavier) replaces the pile of `.bat`/debug scripts at the repo root:
```
pebot dev                 # start local dev server
pebot db migrate          # prisma migrate, never a raw db push in prod
pebot db backup           # writes a checksummed snapshot
pebot db restore <file>   # the hardened flow from Section 5.5
pebot build:electron      # electron-builder wrapper
pebot doctor              # environment sanity check (node version, db reachable, port free, mDNS ok)
```
This is the "proper CLI" from your original ask — a handful of discoverable, named commands instead of `run-build3.bat`.

---

## 9. Testing & Quality Gates

- Every function in a `modules/*/service.ts` gets a Vitest unit test. No exceptions for "it's simple."
- Every bug fix adds a regression test **first** (red), then the fix (green) — cheap to enforce with one person, and it's exactly what stops the same class of bug (see the total/subtotal mismatch bug) from resurfacing after a future refactor.
- `/speckit.checklist` (optional spec-kit command) can generate requirement-completeness checklists per feature — worth using for the financial-logic modules (orders, payments, loyalty) specifically, since those are the ones where "looks right" and "is right" diverge.

---

## 10. Rules for AI Agents Working In This Repo

1. Read this document (or the `.specify/memory/constitution.md` derived from it) before writing code. If a request conflicts with it, say so and ask, don't quietly override it.
2. Never call `prisma.*` outside a `modules/*/repository.ts` file (Section 4).
3. Never add a new payment method, receipt-numbering path, or data-deleting endpoint without checking Section 5 and 7 first.
4. Never commit build output (`.next/`, `dist/`, generated Prisma client) — see `.gitignore` rule in Section 11.
5. Prefer extending an existing module over creating a new top-level folder; if genuinely new domain, follow the exact shape in Section 4 (service/repository/schema/test).
6. When a task is finished, its temporary/debug scripts get deleted before the task is considered done — not left at repo root "just in case." This one rule would have prevented most of Section 11.

If you install spec-kit's skills integration, most of this is enforced procedurally rather than by an agent remembering to re-read a doc — that's the whole point of adopting it instead of hand-rolling equivalent instructions every session.

---

## 11. Immediate Repository Cleanup (result of the audit you asked for)

**Delete outright:**
- `run-build.bat`, `run-build2.bat`, `run-build3.bat`, `run-build4.bat`, `run-build-installer.bat`, `debug-tsc.bat`, `run-tsc.bat`, `run-generate.bat`, `debug2.bat`, `debug3.bat`, `debug5.bat`
- `check-braces.js`, `check-zwj.js`, `debug-line656.js`, `debug9.js`, `find-first-error.js`
- The stray file literally named `ts.flattenDiagnosticMessageText(d.messageText` — a broken artifact from a piped command, not real content.

**Remove from git tracking (and add to `.gitignore`):**
- `.next/` — build output; committing it bloats the repo and can leak environment-baked paths.

**Consolidate, don't just delete:**
- `LOYALTY_BEFORE_AFTER.md`, `LOYALTY_CYCLE_UPDATE.md`, `LOYALTY_QUICK_REFERENCE.md`, `LOYALTY_SYSTEM_GUIDE.md`, `LOYALTY_VOUCHER_INTEGRATION.md` → one canonical `docs/loyalty-spec.md` (or, once spec-kit is installed, `/speckit.specify` for the loyalty domain). Keep the originals in `docs/archive/` only if you want the history; don't leave five overlapping sources of truth live.
- `SYSTEM_FIX_GUIDE.md` → fold anything still-relevant into the new domain specs; archive the rest.
- `cafeos-pos-10-10-spec.md` → this one's actually good, but it's a **completed** work order (its own checklist is 100% checked off). Move to `docs/archive/`, and lift its design-token system (the `--pos-*` CSS variables) into a proper `docs/design-system.md` since that part is still live and worth keeping discoverable.
- `SYSTEM_SPEC_ENGINEERING.md` → this is the good one. Don't archive it — it's the seed material for `/speckit.specify` per Section 8.

**Structural fix:** the real app lives in `my-app/` nested inside the `Pebot` repo, a leftover from running `create-next-app` inside an already-initialized repo. Recommend flattening so the repo root **is** the project root — cleaner for the CLI in Section 8, and for anyone (including an AI agent) opening the repo cold.

**Needs your input:** confirm what's actually at the path you called `.edgepoint` — I can only see `.kilo/plans` from the repo root, and GitHub blocks me from browsing folder trees automatically, so I can't verify further without you pasting it or uploading the repo directly.

---

## 12. What I Still Need From You

To turn Sections 3–7 from "correct in general" into "correct for your exact schema," paste or upload:
1. `my-app/package.json` (exact dependency versions)
2. `my-app/prisma/schema.prisma`
3. A file listing of `my-app/app/api/**` (or just `ls -R my-app/app/api`)
4. Whatever is actually at `.edgepoint` (or confirmation it's really `.kilo` and safe to ignore)

Once I have those, I'll tighten the module boundaries in Section 4 against your real API routes and flag any spot where the current schema violates Section 5's invariants.
