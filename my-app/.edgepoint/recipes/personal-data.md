# Personal data — notice, consent, and requests

**Gives you:** a privacy notice written from what the app actually does, a consent
record, a one-click unsubscribe, an export of everything held about a person, a
real deletion path, and the written inventory the builder hands the NPC.

**Use when:** the project stores anything about an identifiable person. For a
webapp that is the first feature, so build this with the first feature rather
than waiting for someone to ask.

**Don't use when:** nothing personal is stored at all — a public price list, a
calculator. Rare.

**Escalate when:**

- The build would store **health information**, anything about a **proceeding for
  an offence**, or data about **children under 18**.
- The builder wants the notice to make a promise the app doesn't keep — "we never
  share your data" when it reaches PayMongo and Resend. Don't quietly soften the
  notice to match the wish; tell them what it has to say and why.

## Ask the builder

Three questions. Everything else in the notice is derivable from the schema, the
recipes in use, and `standard/privacy.md` — and derived beats asked, because the
builder does not know what the app stores and you do.

1. **How long do you keep customer records after someone stops being a customer?**
   Options, with the consequence: *forever* (simplest, but everything you keep is
   something you can lose), *two years after their last order* (the usual answer,
   long enough that a returning customer is recognised), *delete as soon as an
   order is complete* (safest, and they lose their own history). Recommend two
   years unless the business is obviously one-off. Anything they've bought is
   separate and is kept five years regardless — say so, in one line.
2. **Do you want to email customers about anything other than what they've
   ordered?** Offers, newsletters, "we miss you". If no, no consent box is built
   and there is nothing more to ask. If yes, that box appears, unticked, and every
   such email carries an unsubscribe link.
3. **If someone asks to see or delete everything you hold on them, which email
   address should that reach?** It goes in the notice, and it is a real
   obligation with a clock on it, so it should not be an address nobody watches.

Never ask about: lawful bases, controllers and processors, the Act's section
numbers, retention mechanics, whether they want to comply.

## Creates

```
content/privacy-notice.md                        the notice, with a version
app/(marketing)/privacy/page.tsx                 renders it
supabase/migrations/<ts>_create_consents.sql     consent records
lib/privacy/consent.ts                           record and read consent
lib/privacy/export.ts                            everything held about a person
lib/privacy/erase.ts                             the only hard-delete in the app
app/(app)/account/privacy/page.tsx               see it, download it, delete it
app/api/unsubscribe/route.ts                     one click, no sign-in
docs/personal-data.md                            the inventory
tests/acceptance/privacy.spec.ts
```

## The notice is drafted, not demanded

The builder cannot write this — they don't know what the app stores. A lawyer
could write the wording but not the facts. You are the only one who knows both
the schema and the recipes, so draft it, from what is actually there:

what is collected, why, on what basis, how long it is kept, who else it reaches
(PayMongo, Resend, AWS Singapore — and, if an AI feature is built, OpenRouter and
the model provider it routes to, with what that feature sends), that the data is
stored **outside the Philippines**, the rights listed in `standard/privacy.md` and how to exercise
each one, the contact address from question 3, and the date it was last changed.

Then say plainly what it is:

> I've written your privacy notice from what the app actually collects, so it's
> accurate rather than generic. Read it before you go live — it's about your
> business, so you'll spot anything that sounds wrong. If you have a lawyer, this
> is a cheap thing to have them look over; the facts in it are right, it's the
> wording they'd tighten.

Give it a version — a date is enough — and write that version into every consent
row, so the record shows what someone actually agreed to.

## Invariants

- **The notice is linked from every point data is collected**, next to the
  button, not only in the footer.
- **Consent rows are append-only.** Withdrawal inserts `granted = false`. Never
  update, never delete — an editable record is not evidence.
- **No pre-ticked boxes. No bundling** consent to marketing with agreement to
  terms. **No consent box for something the app does anyway** — that is the
  contract basis, and asking implies a choice that doesn't exist.
- **Unsubscribe works in one click, from the email, without signing in.** A signed
  token in the link, no confirmation step, no preference centre gate. Withdrawal
  has to be as easy as consent was.
- **The export is complete.** Every table naming that person, joined by email as
  well as by `user_id` — data collected before they had an account is still
  theirs. JSON, plus their files. If a table is missing from the export it is
  missing from the inventory too; the two are checked against each other.
- **`lib/privacy/erase.ts` is the only place in the app that hard-deletes.**
  It removes the person's rows, their uploaded files, and their object storage
  keys; it nulls the customer link on invoices and payments and leaves those
  rows; it writes a record that an erasure happened, with no personal data in it.
- **Deletion is confirmed in the app and by email**, and says what was kept and
  why. Someone who asked to be erased and then sees an invoice with their name on
  it will assume they were lied to.
- **A request is acknowledged immediately and answered well inside 30 working
  days**, which is what NPC guidance allows. Tell the builder about that clock
  the first time one lands, not when it is nearly up.
- Everything here is covered by acceptance tests in the builder's own words —
  *When I ask to delete my account, then my details are gone and my receipts
  aren't.*
