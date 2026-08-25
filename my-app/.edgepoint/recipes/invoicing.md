# Order confirmations and invoices

**Gives you:** a numbered, immutable order confirmation with a VAT breakdown, as a
web page, a PDF and an email; credit notes for refunds; an admin list; and a
monthly export the builder's accountant can actually use.

**Use when:** the builder sells something and their customer needs a document for
it. Usually alongside `payments.md`.

**Don't use when:** they only need to see orders internally — that's
`admin-table.md`. The document is for the customer.

**Escalate when — and read `standard/tax.md` first:**

- **They want this to be their BIR invoice.** A system that issues the official
  document has to be registered with the BIR first, and doing so can pull them
  into electronic invoicing. Their accountant's call, not a build decision. Offer
  the order confirmation as what ships today; it does not waste the work.
- **They sell zero-rated or VAT-exempt goods or services**, export, or sell to
  PEZA-registered companies. Those change what they file, not just what prints.
- **They want the app to tell them what tax they owe.** That is their accountant's
  work. Give clean numbers, not conclusions.

## Ask the builder

1. **Are you VAT-registered?** It's on their BIR Certificate of Registration, the
   2303 form. If they don't know: build it VAT-inclusive with the breakdown shown,
   log it in `decisions.md`, and tell them in one line what you assumed.
2. **What are your registered business name, address and TIN?** Exactly as
   registered, not the trading name they use on signage, if the two differ. These
   print on every document.
3. **What should each line say?** Whether the customer sees a product name, a
   description, or both — and whether quantities matter for what they sell.
4. **Do you email it automatically, or issue it yourself?** Automatic on payment
   is the usual answer.
5. **When you refund someone, does that need a document too?** Yes for most
   businesses; it's a credit note against the original.

Never ask about: numbering schemes, sequences, PDF generation, rounding, storage,
whether records should be immutable.

## Creates

```
supabase/migrations/<ts>_create_documents.sql        documents and lines
supabase/migrations/<ts>_create_document_number.sql  the sequence
lib/money/vat.ts                                     splitVat — see standard/tax.md
lib/documents/issue.ts                               allocate number, freeze content
lib/documents/pdf.ts
lib/documents/credit-note.ts
app/(app)/orders/[id]/document/page.tsx
app/(app)/admin/documents/page.tsx                   admin list, per admin-table.md
lib/documents/export.ts                              monthly CSV for the accountant
tests/acceptance/invoicing.spec.ts
```

## Invariants

- **It is headed *Order confirmation* and carries the line *This is not an
  official BIR invoice*.** The words the app may not use are listed in
  `standard/tax.md`. Unless the escalation above has actually happened, none of
  them appear anywhere — page, PDF, email subject, or button.
- **The number is allocated inside the transaction that writes the row**, from a
  Postgres sequence. Never `count(*) + 1`, never generated in application code
  before the insert, never derived from a timestamp. Two customers checking out
  in the same second is the normal case, not the edge case.
- **Once issued, the row never changes.** Not the amounts, not the name, not the
  address, not the line items. Voiding sets a status and keeps the number. A
  refund is a **new** credit note referencing the original. There is no update
  path in the code, so there is no update path to forget to guard.
- **The document stores its own copy of everything printed on it** — business
  name, TIN, address, the customer's name, each line, each price. Never joined
  live from the products or customers table at render time. A price change next
  month must not silently rewrite what someone was charged last month, and this
  is the single most common way that happens.
- **Amounts are integer centavos. VAT is computed only by `splitVat`**, once per
  line, then summed. `standard/tax.md` explains why the net is derived by
  subtraction.
- **Every document is reachable for five years** and is never touched by a
  cleanup job. An erasure request unlinks the person and keeps the document —
  `standard/privacy.md`.
- **A customer sees only their own**, by RLS on `user_id` — a document URL is
  guessable if it isn't. The admin list is role-scoped.
- **PDF generation failing never blocks the sale.** The record is written and the
  number allocated first; the PDF is rendered from the stored row and can be
  regenerated at any time. A payment that succeeded and a document that didn't
  render is a support email; a payment lost because a PDF library threw is a lost
  customer.
- **The export is a plain CSV of amounts and dates**, one row per document. Not a
  formatted report, not a tax computation, not an opinion — their accountant has
  their own system and needs numbers, not a PDF to retype.
