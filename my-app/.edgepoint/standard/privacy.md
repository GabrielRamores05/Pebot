# Personal data

Second in importance only to `access.md`. Access rules decide who may see the
builder's data. This file decides what the builder is allowed to hold at all,
and what has to happen when someone asks for their data back.

The law is the **Data Privacy Act of 2012 (RA 10173)**, enforced by the
**National Privacy Commission (NPC)**. It binds the builder from the first row of
the first form. There is no small-business exemption, and the penalties include
imprisonment, not only fines.

The builder is a **personal information controller** and almost certainly does
not know it. Part of this job is making sure they never have to.

## What counts

**Personal information** is anything that identifies someone, alone or combined
with what else you hold: name, email, mobile number, address, photo, customer
number, IP address.

**Sensitive personal information** is a shorter, defined list that carries much
heavier duties:

- race, ethnicity, marital status, age, colour, religious, philosophical or political affiliation
- health, education, genetic or sexual life
- any proceeding for an offence, and how it was resolved
- **government-issued numbers** — TIN, SSS, GSIS, PhilHealth, PhilSys, passport, driver's licence, professional licence
- tax returns

Notice how ordinary some of that is. **Date of birth and marital status on a
booking form are sensitive personal information** under Philippine law, even
though nobody thinks of them that way. So is a photo of an ID uploaded to prove
who someone is. Read *Sensitive personal information* below before storing any
of it.

## Collect only what the software actually uses

Every field on every form must trace to something the build does with it. A
field collected in case it turns out to be useful is a liability with no upside:
it has to be secured, disclosed, retained, produced on request, deleted on
request, and reported on if it leaks.

This is the rule the NPC reasons from, not a preference. When the builder asks
for a field nothing uses, ask the business question:

> What would you do with their date of birth? I'll leave it off the form unless
> something needs it — it's the kind of detail that costs you more to hold than
> it's worth.

## Every table holding personal data is written down

`docs/personal-data.md` lists, for each table that holds personal data:

| | |
|---|---|
| **What** | the columns that are personal, and which are sensitive |
| **Why** | the purpose, in the builder's words |
| **Basis** | why they are allowed to hold it — see below |
| **How long** | the retention period, and what happens at the end of it |
| **Who else sees it** | every third party the data reaches |

Regenerate it in the same change that adds or removes a personal column. A stale
inventory is worse than none, because it is what the builder will hand to the NPC
and what the privacy notice is written from.

This file is the builder's, not the framework's — it is not frozen and not
hashed. Keeping it true is a build step.

### Why they are allowed to hold it

Four bases cover almost everything this Standard builds, in the order to prefer:

1. **The contract** — they need it to deliver what the customer asked for. A
   delivery address for a delivery. No consent needed, and none should be asked
   for; a consent box for something you will do anyway is misleading.
2. **A legal obligation** — chiefly the tax records in `tax.md`.
3. **Legitimate interest** — narrow. Fraud prevention, security logs. Never a
   catch-all for marketing.
4. **Consent** — for anything the customer would not expect, and always for
   marketing.

Sensitive personal information is different: consent must be **express and
recorded**, given before the data is collected, and the contract basis does not
apply to it.

## Consent is a record, not a column

A `boolean` says someone once ticked something. It cannot answer the question the
NPC actually asks, which is *what exactly did they agree to, and when*.

So consent is a row:

```sql
create table consents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,                -- never set; see below
  subject_email text not null,           -- stored lowercased; works before
                                         -- there is an account to point at
  user_id uuid references users(id),
  purpose text not null,                 -- 'marketing_email', 'sms', ...
  granted boolean not null,
  notice_version text not null,          -- which privacy notice they saw
  source text not null,                  -- which form, which page
  ip inet,
  occurred_at timestamptz not null default now()
);
```

Withdrawal is a new row with `granted = false`, never an update and never a
delete. The history is the evidence, and evidence that can be edited is not
evidence. `deleted_at` exists because every table has it (`data.md`) and is never
set on this one — a soft-deleted consent record is a destroyed audit trail.

Email is stored lowercased and compared lowercased. Someone who consented as
`Maria@example.com` and unsubscribes as `maria@example.com` is one person, and
the alternative is an unsubscribe that silently does nothing.

Rules that follow, all of them non-negotiable:

- **Never pre-ticked.** A checkbox that arrives ticked is not consent.
- **Never bundled.** "I agree to the terms and to receive marketing" is one box
  doing two jobs, and it invalidates the marketing half.
- **Never a condition of service**, unless the data is genuinely needed to
  deliver it — in which case the basis is the contract and there is no box.
- **Withdrawal is as easy as giving it.** One click from an email, no sign-in, no
  "contact us to unsubscribe".

## Sensitive personal information

Storing any of it changes the risk of the whole project, so it is a deliberate
decision rather than a consequence of a form field.

**Escalate before storing** health information, any proceeding for an offence, or
data about children under 18. These carry duties this Standard does not cover.

**Government ID numbers and ID photographs** may be stored, when the builder's
business genuinely requires them, under all of these:

- The builder has said, in answer to a direct question, why they need it.
- Express consent is recorded first (`consents`, above).
- The column is never selected into a list, a search result, an export, or a log.
- Only the last four characters are ever displayed.
- Access is restricted by RLS to the smallest set of roles, and every read is
  written to an audit table.
- ID images go to private object storage with signed short-lived URLs, never a
  public bucket — see `recipes/file-upload.md`.

If the requirement is only "prove this person is who they say", say so and offer
the alternative: check the ID, record that it was checked and by whom, keep
nothing. Most builders take it once it is offered, because it is also less work
for them.

## The rights people have, and what each one means here

The Act gives every data subject rights that must actually be exercisable. Each
one is a thing the software has to be able to do:

| Right | What has to exist |
|---|---|
| To be informed | the privacy notice, current, linked from every collection point |
| To access | an export of everything held about them, in a readable form |
| To correct | a way for them or the builder's staff to fix wrong data |
| To object | stop marketing, stop optional processing, keep the account |
| To erasure or blocking | the deletion path below |
| To data portability | the same export, machine-readable |
| To damages, and to complain | outside the software; the notice says how |

NPC guidance gives a controller **30 working days** from receiving a request to
act on it, with a further 15 available for genuinely complex or voluminous ones,
on notice to the person asking. Treat two weeks as the internal target, so the
extension is never needed, and tell the builder about the clock the first time a
request arrives rather than when it is nearly up.

These are `recipes/personal-data.md`. Build them when the project first stores
personal data — which for a webapp is the first feature — not when the first
request arrives, because by then the clock is running.

## Erasure, deletion, and the records that cannot be deleted

Three rules meet here, and they contradict each other unless the order is fixed.

1. `data.md`: **deleting sets `deleted_at`**, because non-developers delete things
   by accident and cannot recover a row that is genuinely gone.
2. This file: a **valid erasure request must actually erase**. A row that is only
   hidden has not been erased, and telling someone it has is the offence.
3. `tax.md`: **BIR records must be kept for five years** and cannot be erased on
   request.

The resolution, in this order:

- **The builder deleting something** is a soft delete. Always. This is the common
  case and it stays reversible.
- **A data subject erasing themselves** is a real deletion — the row goes, the
  uploaded files go, the object storage keys go, and the backups age out. The
  path is `lib/privacy/erase.ts` and it is the only place in the codebase that
  hard-deletes.
- **Financial records survive it, with the person removed.** An invoice, order or
  payment stays, because the law requires the business to keep it. What goes is
  the link to the person: the customer row is deleted, the foreign key is nulled,
  and the name and address already printed on the invoice stay, because a tax
  document that can be altered afterwards is worthless.

Say that third part to the builder plainly when it comes up, in their terms:

> I can delete their account and everything in it. What I can't delete are the
> receipts for anything they actually bought — the BIR requires you to keep those
> for five years. Their name stays on those receipts and nowhere else.

Erasure runs against the live database only. Backups are not surgically edited;
they expire on their own schedule — nightly dumps kept seven days, plus Lightsail
snapshots (`deploy.md`). Say that in the privacy notice rather than pretending
otherwise.

## A breach starts a 72-hour clock

If personal data is exposed, the builder has **72 hours from knowing about it**
to notify the NPC and the affected people. Not 72 hours to finish investigating —
72 hours to notify, on what is known by then.

The obligation bites hardest when sensitive personal information or anything that
enables identity fraud is involved, and someone unauthorised may have got it.

Notification goes to the NPC through their own system, reached from
**privacy.gov.ph**. Say that when it matters — a builder told they have 72 hours
and not told where to go will spend some of those hours searching.

The software cannot notify anyone. What it must do is make the questions
answerable, because a builder who cannot say *whose data and how much* inside
three days is in a far worse position than one who can:

- Every table carries `created_at` and `updated_at` (`data.md`), so the window is
  reconstructable.
- Reads of sensitive personal information are audited (above).
- Application logs never contain personal data (`quality.md`), so the logs
  themselves are not a second breach.
- The personal-data inventory says what each table holds, so scope is a lookup
  rather than an investigation.

If you ever discover, mid-build, that data has been exposed — a public bucket, a
missing policy, an enquiry list readable by anyone — **say so immediately and
plainly, and say that a clock has started.** Do not fix it quietly and move on.
The builder is the one with the legal duty, and they cannot discharge a duty they
were never told about. This is the one place in this framework where quietly
fixing a mistake is worse than making it.

## Where the data lives

The database is on a Lightsail instance in **Singapore** (`deploy.md`), so
personal data leaves the Philippines. That is allowed — and the builder remains
fully accountable for it, which means the privacy notice has to say it and the
inventory has to list it.

Third parties reached by this Standard, all of which must appear in the notice:

| Who | What reaches them |
|---|---|
| PayMongo | name, email, and payment details of paying customers |
| Resend | email address and message content |
| Amazon Web Services (Lightsail, Singapore) | everything stored |
| OpenRouter **and the model provider it routes to**, if an AI feature is built | whatever that feature puts in a prompt — see `ai.md`. Two companies, not one; name both |
| Plausible, if analytics are added | no personal data, no cookies |

Adding a fourth is a change to the notice, in the same build. A processor nobody
declared is the leak that gets found by an auditor.

## Handling rules that have no exceptions

- **Never in a URL.** No email address, name, or ID number in a path or query
  string. URLs land in browser history, referer headers, server logs, and the
  chat message where the builder pastes the link. Use the row's `uuid`.
- **Never in a log.** See `quality.md`. Log the customer id, never the customer.
- **Never in an error message** shown to another user.
- **Never in a commit**, a fixture, a seed file, or a test. Test data is invented.
  Real customer data in a repository is a breach that survives every later fix.
- **Never emailed to the builder in bulk.** A notification says a form was
  submitted and links to it; it does not paste the contents to an inbox that has
  no access control and no retention.

## What is the builder's job, not the software's

Three duties are theirs, and none of them can be built:

- **Designate a Data Protection Officer.** Required of every controller whatever
  its size. For a sole proprietor that may be themselves.
- **Register with the NPC** if they have 250 or more employees, or hold sensitive
  personal information on 1,000 or more people, or their processing is risky.
  Below that, registration is voluntary — but every other duty in this file still
  applies.
- **File the annual security incident report**, even in a year with no incidents.

Raise these once, at `/ship`, in plain language — not during `/clarify`, where
they are noise that stalls a build. `workflow/ship.md` says how.
