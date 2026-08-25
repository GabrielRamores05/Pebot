# Data

## Every table

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | primary key, `default gen_random_uuid()` |
| `created_at` | `timestamptz` | `default now()`, not null |
| `updated_at` | `timestamptz` | `default now()`, maintained by trigger |
| `deleted_at` | `timestamptz` | null unless removed — see below |

Plural `snake_case` table names. Foreign keys are `<singular>_id` with a real
constraint — always. Referential integrity is not optional because the model
"knows" the data will be consistent.

## Destructive actions are reversible by default

Deleting sets `deleted_at`. Queries filter it out. The row stays.

Non-developers delete things by accident and have no backup habits, no staging
environment, and no way to recover a row that is genuinely gone. The storage cost
of keeping it is nothing; the cost of losing a customer's data is their business.

Ask the business question, never the technical one:

> If someone deletes a customer by accident, should you be able to get them back?

**The exception is a person asking to be erased**, which is a right under the Data
Privacy Act and has to be a real deletion. It runs through one place in the
codebase, and financial records survive it with the person unlinked rather than
removed. The whole rule — soft delete, real erasure, and the records the BIR
requires be kept — is in `privacy.md` under *Erasure, deletion, and the records
that cannot be deleted*. Do not implement a hard delete anywhere else.

## Money and time

Money is stored as an integer in the smallest unit — centavos, not pesos — with the
currency in its own column. `PHP` unless the builder is genuinely selling in
something else, which is an escalation. Never a float. Never a bare number whose
currency is implied by where you're standing.

Timestamps are `timestamptz`, always UTC in the database, formatted for display at
the edge in **Asia/Manila**. A date with no time — a birthday, an invoice date — is
`date`, because giving it a timezone creates the off-by-one-day bug that no one
ever finds.

Display formatting is `en-PH`: `₱1,500.00`, and dates as `11 Aug 2026` rather than
a numeric form that reads as a different day depending on the reader.

Prices are quoted VAT-inclusive, and VAT is split out of them in exactly one
place — `tax.md` holds the arithmetic and the reason the net is derived by
subtraction. Do not compute VAT anywhere else, and do not restate the rule here;
two files describing the same arithmetic is how they come to disagree.

## Migrations

Timestamped SQL in `supabase/migrations/`, applied in order, never edited once
applied. To change something, write another migration.

Locally, `./edge migrate` applies them — see `environment.md`. `./edge reset`
starts the local database over. Neither can reach production.

Every migration that creates a table creates its RLS policies in the same file.
A table without policies is a table with no access control, and a migration that
adds one without the other leaves a window open — see `access.md`.

## Queries

Select the columns you need, not `*`. Filter `deleted_at is null` unless you
explicitly want removed rows. Paginate anything that can grow — a list with no
limit works fine on the builder's twenty test rows and falls over at ten thousand.

Index every foreign key and every column you filter or sort by regularly.

Nothing that could return an unbounded number of rows ships. Not as a default
limit that can be overridden — as a hard ceiling.
