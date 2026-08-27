# Tax, invoices, and receipts

Applies to any build that takes money. If nothing is sold, none of this is
relevant — but read the first section anyway, because the mistake it prevents is
made by accident.

Figures marked *as of 2026* are set by regulation and move. Where one matters to
a build, have the builder confirm it with their accountant rather than trusting
the number written here — the project may be running years after this was
written.

## The line: this software is not the builder's books

The Bureau of Internal Revenue cares about who issues the document, not who
prints it. The moment software issues the **Sales Invoice** a Philippine business
gives its customer, that software is a Computerized Accounting System in the
BIR's eyes, and it has to be registered with them before it is used.

So, by default:

**What the app sends the customer is an order confirmation, not a BIR invoice.**

It shows what they bought, what they paid, when, and a reference number. It is
headed *Order confirmation*, it carries the line *This is not an official BIR
invoice*, and the builder issues their BIR invoice the way they already do.

That is not a fudge. It is what almost every business in this position actually
needs, it is legal, it can be built today, and it leaves the builder's existing
arrangement with their accountant undisturbed.

### Words the app may not use unless the escalation below has been done

**Official Receipt**, **OR**, **Sales Invoice**, **VAT Invoice**, **Acknowledgement
Receipt**, or a BIR form number. Not in the page title, not in the PDF, not in the
email subject, not in a button label. A document a customer reasonably takes for
a BIR invoice, and which is not one, is a problem for the builder and not for the
customer.

Two of those are worth knowing about for a different reason. Under the **Ease of
Paying Taxes Act (RA 11976)**, in force since 2024, the Official Receipt is no
longer the primary document for services — there is now a single **Invoice** for
goods and services alike. So do not build anything that issues an "Official
Receipt" even after escalation. That document has been retired.

### When the builder wants the app to be the real thing

Some genuinely do, and it is a legitimate ask. It is an escalation
(`protocol/escalation.md`), not a refusal, and these are the reasons:

- The system has to be **registered with the BIR** before use. Since 2021 that is
  an Acknowledgement Certificate rather than the old Permit to Use, obtained from
  their Revenue District Office, and it is their accountant's errand rather than
  a developer's.
- Registration brings requirements this Standard does not implement: audit
  trails in the BIR's shape, gapless numbering they can inspect, printed and
  electronic books, and a system that cannot be modified without notifying them.
- **It can pull the builder into e-invoicing.** Under the electronic invoicing
  rules, businesses using invoicing software — and e-commerce businesses
  generally, apart from the smallest — are in the first wave, which must transmit
  every sale to the BIR's Electronic Invoicing System as signed structured data
  within days of the transaction. The deadline for that first wave is **31
  December 2026** as of 2026, already extended once.

That last one is the part to say out loud, because it is invisible and it is
caused by the feature itself:

> Building this properly could put you in the BIR's e-invoicing programme — where
> every sale has to be reported to them electronically within a few days. That may
> already apply to you, or it may not, and it's the kind of thing worth one call
> with your accountant before I build anything. What I can do today is send your
> customers a clear order confirmation and leave your invoicing exactly as it is.

## VAT

**Value-added tax is 12%.** A business must register for VAT once its annual gross
sales pass **₱3,000,000** *(as of 2026)*; below that it is generally
non-VAT and pays percentage tax instead. Which of the two the builder is, is on
their BIR Certificate of Registration and is a question they can answer.

Ask it once, at the start of anything priced:

> **Are you VAT-registered?** It's on your BIR certificate — the 2303 form. It
> changes whether your prices need to show a VAT breakdown.

If they don't know, build it VAT-inclusive with the breakdown shown, note it in
`decisions.md`, and tell them in one line. That is right for the large majority
of Philippine consumer businesses and is not expensive to change.

### Prices are VAT-inclusive

Philippine consumer prices are quoted with VAT already in them. ₱1,500 means the
customer pays ₱1,500. Store the amount the customer pays; derive the rest.

Quoting a price and adding tax at checkout is a foreign convention that reads as
a bait-and-switch here. If the builder genuinely sells business-to-business and
wants exclusive pricing, that is their call — ask, don't assume, and be consistent
across the whole app.

### The arithmetic, on integers

All money is centavos (`data.md`). This is the only place VAT is computed:

```ts
// lib/money/vat.ts — VAT-inclusive gross, in centavos.
export const VAT_RATE = 12

export function splitVat(gross: number) {
  const vat = Math.round((gross * VAT_RATE) / (100 + VAT_RATE))
  return { net: gross - vat, vat, gross }
}
```

`net` is derived by subtraction, never by its own rounded division. That is what
guarantees `net + vat === gross` exactly. Computing both independently produces
totals that are off by one centavo on some prices and not others — which nobody
notices until an accountant does, and then it is every document ever issued.

Round once, at the line, then sum the lines. Summing first and rounding the total
gives a different answer from the one printed next to each item, and the customer
can see both.

Zero-rated and VAT-exempt sales exist and are not a flag on a price — they change
what the business files. Escalate rather than inventing a rule.

## What has to be on the document

Whether or not it is a BIR invoice, an order confirmation should carry the same
facts, because the builder will be asked for them and because the gap is then
just the BIR's own registered numbering:

- the seller's registered business name, address, and **TIN**
- for a VAT-registered seller, the words **VAT-registered TIN** and a breakdown
  showing VAT-able sales, the 12% VAT, and the total
- the customer's name, and their address and TIN for a business customer
- date, a unique reference number, each item, quantity, unit price, and the total
- the total in words, if the builder's accountant asks for it — some do

A sale of **₱500 or more** *(as of 2026)* has to be documented, and in practice
every online sale should be. Do not build a threshold below which nothing is
issued.

Amounts on the document are formatted `₱1,500.00`, the date reads `11 Aug 2026`,
and the time, if shown, is Asia/Manila — as everywhere else (`data.md`).

## Documents do not change once issued

An issued document is immutable. Not "should not be edited" — the code must not
offer a path that edits one.

- **Numbering is sequential, gapless, and never reused.** Allocate the number in
  the same database transaction that writes the row, from a Postgres sequence or
  a locked counter row — never `count(*) + 1`, which produces duplicates the
  moment two customers check out in the same second.
- **A number is never released.** If a document is voided, it stays, marked void,
  with its number. A gap in the series is the first thing an examiner asks about.
- **Corrections are new documents.** A refund is a credit note referencing the
  original. Overwriting the original destroys the record of what actually
  happened.
- **Never renumber.** Not to tidy the sequence, not after a failed import, not
  ever.

These are also true of the default order confirmation. They cost nothing to get
right at the start and are close to unfixable later.

## Keep it for five years

Financial records — invoices, order confirmations, payment records, credit notes
— are kept for **five years**, counted from the deadline for filing the return
covering the year of the last entry *(as of 2026; it was ten years before the
Ease of Paying Taxes Act)*.

So they are never soft-deleted by a routine cleanup, and they survive a customer's
erasure request with the person unlinked rather than the record removed. The full
rule, and the sentence to say to the builder, is in `privacy.md` under *Erasure,
deletion, and the records that cannot be deleted*.

## Two things that are the accountant's, not the software's

- **Withholding.** Payment platforms and marketplaces may withhold a small
  percentage of what they remit, which the builder credits against their own tax.
  Whether it applies depends on how they sell and how much. Mention it once if
  they are reconciling payouts; do not compute it, and do not model it.
- **Filing anything.** This software never files a return, never computes income
  tax, and never tells the builder what they owe. It records what was sold, in a
  form their accountant can use.

If the builder starts asking what they owe, that is the edge. Say plainly that
this is their accountant's work, and that the app's job is to give them clean
numbers to hand over.
