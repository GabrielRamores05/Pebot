# AI that reads a document

**Gives you:** structured fields pulled out of an uploaded document or photo — a
receipt, an invoice, a filled-in form — validated against a schema, shown to a
person to confirm before anything is saved.

**Use when:** the builder or their customers are retyping what's already printed
on something.

**Don't use when:** the document has a fixed machine-readable format already. A
CSV is parsed, not read.

**Escalate when:**

- **It's a government ID** — passport, driver's licence, PhilID, or anything
  showing a TIN, SSS or PhilHealth number. That is sensitive personal
  information, `standard/privacy.md` sets conditions on holding it at all, and
  `file-upload.md` already escalates the upload. Before escalating, check what
  they actually need: usually it is *that the ID was checked*, not the number.
  Sending one to a third party to be read is a separate decision on top.
- **It's a medical document**, or anything where a wrong number has a legal or
  clinical consequence.
- **They want it to post the result straight into their accounts** with nobody
  looking. See the confirmation invariant below.

## Ask the builder

1. **What are they uploading, and what do you need off it?** Field by field. The
   list becomes the schema, so be exact — "supplier, date, total, VAT" rather
   than "the details".
2. **What happens if it can't read one?** A blank to fill in is usually right.
   Their answer decides whether a field is required.
3. **What's the most you'd want this to cost you in a month?** Per
   `standard/ai.md`. Worth mentioning that a page of scanned text costs more to
   read than a line of typing.

Never ask about: vision models, OCR, tokens, confidence scores, schemas, JSON.

## Creates

```
lib/ai/client.ts                        the wrapper — see standard/ai.md
lib/ai/limits.ts                        spend ceiling
lib/validation/<name>-extract.ts        the Zod schema — the contract
lib/ai/extract.ts                       calls with structured output
components/<feature>/confirm-fields.tsx review-before-save form
tests/acceptance/extract.spec.ts        runs with AI_FAKE=1
```

## Invariants

- **Tier `FAST`** (`standard/ai.md`) — but only because of the next invariant.
  The tier that serves this recipe must accept images, since what arrives is
  usually a photo; a text-only model here is a feature that silently cannot do
  its job. Verify that against the live model list before pinning one.
- **A person confirms every field before anything is saved.** Not a preview they
  can skip — a form they submit. Extraction is a typing aid, and a wrong total
  that nobody looked at is worse than one nobody typed. This is what licenses the
  cheap tier: the rail catches the miss.
- **Ask for the schema, then validate it anyway**, per `standard/ai.md` — request
  `json_schema` with `require_parameters`, then check the reply with Zod before
  anything downstream sees it. Enforcement varies by which model served the
  request, so the Zod parse is the part that actually holds. A response that
  fails it is a failure, handled like one. Never regex fields out of prose.
- **Money and dates are re-validated after extraction.** Amounts land as integer
  centavos with a currency (`data.md`), and a date that didn't parse is empty
  rather than guessed. This is where a plausible-looking wrong value does real
  damage.
- **Empty beats invented.** If a field isn't on the document, it comes back
  blank. The instructions say so explicitly, because fluent invention is the
  characteristic failure here.
- **The file follows `file-upload.md`** — private bucket, row-level permission,
  server-side type and size checks. Extraction changes none of that.
- **The uploaded document is personal data.** It's included in the person's
  export, really deleted on erasure, and listed in `docs/personal-data.md` —
  `standard/privacy.md`.
- Spend ceiling before the call; refusals and errors fall back to typing it in by
  hand, with the upload kept.
