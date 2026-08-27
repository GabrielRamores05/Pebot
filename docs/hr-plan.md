# Pebot HR / Staff Module — Plan

**Date:** 2026-08-27 · **Repo:** gabrielramores-gif/Pebot · **Branch reviewed:** `main` @ `09f5bc3`

## 0. The short version

The HR module is **already built** — schema, API routes, and a full 8-tab admin UI all exist. This is not a
greenfield plan; it is a **hardening and completion plan**.

What exists today:

| Area | Schema | API | UI |
|---|---|---|---|
| Staff profiles (position, department, rates, emergency contact) | `User` HR fields | `/api/staff`, `/api/staff/[id]` | Team tab |
| Shift templates | `Shift` | via `/api/schedules` | Schedule tab |
| Rosters | `Schedule` | `/api/schedules` | Schedule tab |
| Time clock | `Attendance` | `/api/attendance` | Time Clock tab |
| Leave | `LeaveType`, `LeaveRequest` | `/api/leave-types`, `/api/leave-requests` | Time Off tab |
| Payroll (PH statutory) | `Payroll` | `/api/payroll` + `lib/philippine-payroll.ts` | Payroll tab |
| Reviews | `PerformanceReview` | in `/api/staff/[id]` tree | Reviews tab |
| Documents | `StaffDocument` | `/api/staff/[id]/documents` | Documents tab |
| Training | `Training`, `StaffTraining` | staff tree | Training tab |

The PH payroll math (SSS / PhilHealth / Pag-IBIG / TRAIN withholding) is implemented **and unit-tested**
(`tests/unit/philippine-payroll.test.ts`).

So the work is not "build HR". It is: **the module currently pays people based on numbers any signed-in
staff member can change, and it leaves no audit trail.** That is what this plan fixes, in that order.

---

## 1. Findings, worst first

### H1 — Anyone signed in can clock in, clock out, and edit hours for anyone (money)

`app/api/attendance/route.ts` guards `POST` and `PUT` with `getAuthUser` only — **any** authenticated
account, including a `KITCHEN` login, passes. The subject is whatever `userId` / `attendanceId` is in the body.

```ts
// POST — clock in
const auth = await getAuthUser(req);       // any signed-in account
const { userId } = body;                   // ...for anybody
// PUT — clock out / edit
const { attendanceId, clockOut } = body;   // any record, any timestamp
```

Consequences: a barista can clock a friend in for a shift they never worked, or set their own `clockOut`
forward and get paid for it — attendance hours are the direct input to `grossPay`. Same class of bug as the
loyalty discount we just fixed in PR #6: **the client supplies a number that becomes money.**

Fix: `guardPermission(req, 'staff')` for anything touching another user's record; a staff member may only
clock *themselves* in/out, with the server stamping the time (ignore any client `clockOut`). A manual time
correction becomes a separate, permissioned, audited action.

### H2 — Payroll accepts a pay rate from the request body (money)

`app/api/payroll/route.ts`:

```ts
const { userId, periodStart, periodEnd, deductions, overtimeRate } = body;
const otRate = overtimeRate ?? rate * 1.25;
grossPay = regularHours * rate + overtimeHours * otRate;
```

`overtimeRate` is an unvalidated peso-per-hour figure from the browser. Rates belong to `User`
(`hourlyRate`, `monthlySalary`) or to settings — never to a request body. Same for arbitrary `deductions`:
allowed as an input, but it should be a named, audited adjustment, not an anonymous number folded into
`netPay`.

### H3 — A payroll period can be generated twice, and paid twice (money)

`Payroll` has no uniqueness on `(userId, periodStart, periodEnd)`, and generation does not mark the
attendance rows it consumed. Press "Generate" twice and you get two DRAFT runs for the same fortnight, each
payable. Nothing links a payroll row back to the attendance rows it was computed from, so a corrected
timesheet silently disagrees with the payslip already handed out.

Fix: unique constraint on the period, plus either a `PayrollAttendance` join or a `paidInPayrollId` on
`Attendance`. Recomputation of a `PROCESSED`/`PAID` run must be refused, not silently overwritten.

### H4 — The monthly assumption distorts statutory deductions on short periods

`computePhilippinePayroll` takes `base` as a **monthly** pay basis; the route passes the period's gross for
hourly staff with the comment "period gross assumed to cover ~one month". For a weekly or semi-monthly run
that understates the SSS MSC bracket and PhilHealth base, so contributions and withholding come out wrong.
Fix: derive the monthly basis from the period length (annualise/deannualise), and decide the pay frequency
explicitly (see Q1).

### H5 — Anyone with the `staff` permission can approve their own leave

`/api/leave-requests` `PUT` sets `approvedById: auth.userId` with no check that the approver differs from
the requester, and `POST` lets a caller file a request for any `userId`. Also `status` is a free string — a
typo writes `"APPROVE"` and the request is neither pending nor approved.

### H6 — No HR action is audited

`logAction` is used in exactly four routes (orders ×2, loyalty cards, business settings). Zero HR routes
write to `AuditLog`, even though the constitution requires audit events to be append-only for anything
touching money or staff records. Time edits, payroll runs, leave approvals, and rate changes are the
highest-value things in the app to be able to reconstruct later.

### M1 — Schedule model can't express real café rosters

`@@unique([userId, date])` = **one shift per person per day**, so a split shift (open + evening) is
impossible, and the `SWAP_REQUESTED` status has no workflow behind it. Nothing checks a roster against
approved leave, so you can schedule someone who is on approved vacation.

### M2 — `Attendance.scheduleId` is dead

The column exists; no code ever sets it. Consequence: no late/no-show/overtime-vs-roster reporting, which is
the main thing a café owner actually wants from a time clock.

### M3 — Open shifts never close

Nothing detects a record with `clockIn` set and `clockOut` null from a previous day. It stays open forever,
is skipped by payroll (`clockOut: { not: null }`), and nobody is told. Needs a daily auto-close at a
configured cutoff, flagged for review.

### M4 — Zero tests on HR behaviour

25 unit-test files, one of them HR (`philippine-payroll.test.ts` — the pure math). No test covers a route,
a guard, hour computation, double-clock-in, or payroll aggregation. Everything above is invisible to CI.

### L1 — Break time is only counted when both `breakStart` and `breakEnd` are set

An unfinished break silently counts as paid time. Also `totalHours` has no sanity cap, so a bad `clockOut`
can book a 300-hour day.

### L2 — Documents and profiles hold personal data with no retention rule

`StaffDocument` (contracts, IDs), `dateOfBirth`, `address`, emergency contacts — stored indefinitely, and
document files sit wherever `/api/upload` puts them. Needs a stated retention period and a "staff member
left" path (see Q4).

---

## 2. Phased plan

Each phase is one PR, verified by `pebot check` (lint, `tsc --noEmit`, unit tests) plus new tests.

### Phase 1 — Stop the money leaks *(H1, H2, H6 — 1 session)*

1. `lib/hr-guards.ts`: `guardSelfOrStaff(req, targetUserId)` — a staff member may act on themselves; anyone
   else needs the `staff` permission.
2. Attendance: server stamps `clockIn`/`clockOut`; client timestamps ignored. `POST` clocks in **the caller**
   (an admin clocking someone else in is `POST /api/attendance/manual`, permissioned + audited).
3. Payroll: drop `overtimeRate` from the body; read the rate from `User`, the OT multiplier from settings.
   Named adjustments (`{ label, amount }`) replace the bare `deductions` number.
4. `logAction` on every HR mutation: clock edits, payroll generate / status change, leave approve, rate and
   profile changes (before → after).
5. Tests: guard matrix per route (self / staff-permission / other / anonymous), plus "client clockOut is
   ignored".

### Phase 2 — Make payroll reproducible *(H3, H4, L1 — 1 session)*

1. Migration: `@@unique([userId, periodStart, periodEnd])` on `Payroll`; `Attendance.paidInPayrollId`.
2. Generation runs in one transaction: aggregate hours → claim the attendance rows → write the payroll row.
   Refuse a period that overlaps an existing `PROCESSED`/`PAID` run.
3. Pull hour aggregation out of the route into `lib/payroll-hours.ts` (pure, testable): daily 8h regular cap,
   OT overflow, break handling incl. unfinished breaks, and a per-day hours ceiling.
4. Monthly basis derived from the period length; pay frequency comes from settings.
5. `PROCESSED → PAID` becomes a one-way status transition, audited, with `processedById` and timestamp.
6. Tests: idempotent generation, overlapping periods refused, weekly vs monthly statutory bases, unfinished
   break, absurd `clockOut` rejected.

### Phase 3 — Rosters that match how the café actually runs *(M1, M2, M3 — 1 session)*

1. Replace `@@unique([userId, date])` with `@@unique([userId, date, shiftId])` to allow split shifts.
2. Reject (or warn on) a roster entry that collides with approved leave or an overlapping shift time.
3. Clock-in resolves the day's `Schedule` and stores `scheduleId` → late / no-show / unrostered-OT reporting.
4. Daily auto-close of open attendance at a configurable cutoff, flagged `NEEDS_REVIEW`, surfaced in the
   Time Clock tab.
5. Implement the `SWAP_REQUESTED` status or delete it — a status with no workflow is a lie in the data.

### Phase 4 — Self-service and reporting *(0.5–1 session)*

Staff-facing page: my roster, my hours this period, my payslip breakdown, file leave. Owner-facing: labour
cost per day/week beside sales (you already have orders and expenses — labour % of revenue is the single
most useful café number the app is currently missing), attendance exceptions, expiring documents and
certifications.

### Phase 5 — Personal-data hygiene *(L2 — 0.5 session)*

Retention period per document type, offboarding that deactivates the account and keeps payroll history but
drops the personal file, and a check that document uploads are not served to unauthenticated callers.

---

## 3. Sequencing note

Phases 1 and 2 are the ones worth doing now; both are the same failure the loyalty PR fixed
(a client-supplied number becoming money) and both are cheap. Phase 3 changes the roster data model, so it
is better done before you have a term of real roster history. Phases 4–5 are value-add and can wait.

If you want this run through the Spec Kit workflow instead of straight PRs, Phases 1–2 become
`specs/007-hr-integrity/` and Phase 3 `specs/008-rosters/`, via `pebot spec`.

---

## 4. Questions only you can answer

These are business decisions, not technical ones — I won't guess them.

1. **Pay frequency and cut-off.** Semi-monthly (1–15, 16–EOM) is the PH norm; is that yours, and what is the
   cut-off day/time for a period to close?
2. **Who may edit a time record after the fact** — owner only, or shift supervisors too? This is the main
   fraud path in any café time clock, so it should be the narrowest role you can live with.
3. **Overtime policy.** Ordinary-day OT is coded at 1.25×. Do you pay rest-day / holiday / night-differential
   premiums? If yes, rosters have to know which days are rest days and I'll need the PH holiday list.
4. **Offboarding.** When someone leaves, how long do you keep their contract and IDs, and should their name
   stay on historical orders and payslips?
5. **Second location.** Everything here is per-PC local, same as loyalty. If a staff member will ever work at
   two branches, say so before Phase 3 — it changes the roster and payroll keys.
