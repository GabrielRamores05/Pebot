# A form anyone can fill in

**Gives you:** a public form, validation, spam protection, storage, a notification,
and a confirmation. Contact forms, enquiries, waitlists, applications, bookings.

**Use when:** people who aren't signed in send the builder something.

**Don't use when:** it's behind a login (use `crud-resource.md`).

## Ask the builder

1. **What do you need from them?** Field by field, and which are required. Push
   back gently on long forms — every extra field loses submissions, and they
   usually haven't considered that.
2. **What should they see after sending?** A message on the page, or a thank-you
   page. What should it say?
3. **Do you want to be told when one comes in?** Email, and to which address.
   Immediately, or a daily summary.
4. **Should they get a confirmation email?** If yes, what does it say.
5. **Do you expect spam?** Determines how hard the protection is.
6. **Do you want to email them about anything beyond this enquiry?** Only if they
   haven't already answered it in `personal-data.md`. Yes means an unticked
   marketing box on the form and a consent record; no means no box at all.

Never ask about: honeypots, rate limits, database schema, server actions, CSRF,
lawful bases, consent mechanics.

## Creates

```
supabase/migrations/<ts>_create_<name>.sql    table, insert-only policy
lib/validation/<name>.ts
lib/<name>/submit.ts                          server action
components/<name>/form.tsx
app/(marketing)/<path>/page.tsx
tests/acceptance/<name>.spec.ts
```

## Invariants

- **Insert-only from the public.** Anonymous users may insert and nothing else.
  No select policy for anon — the builder's enquiry list must not be readable by
  the internet. This is the classic mistake in this pattern.
- Server-side validation regardless of client validation.
- Rate limited by IP. Always, even when spam isn't expected — the form is a public
  endpoint and someone will find it.
- A honeypot field, hidden from people and from screen readers.
- Never lose what they typed on a failed submit.
- Submit disables while sending, so nothing is double-submitted.
- If the notification email fails, **the submission still saves**. Never lose a
  customer's enquiry because an email provider had a bad minute.
- Confirmation is specific: *"Thanks — we'll be in touch within one working day."*
  Not "Success". Say what happens next.
- **The privacy notice is linked next to the submit button**, not only in the
  footer. Everything a public form collects is personal data from the moment it
  is submitted — see `standard/privacy.md` and `personal-data.md`.
- **No box asking permission to reply to them.** Answering their enquiry is why
  they filled the form in; a consent box for it implies they had a choice not to
  be replied to. A marketing box is separate, unticked, and never bundled with
  anything else.
- Ask only for fields the build uses. This is the same push-back as question 1,
  but it is also the rule the National Privacy Commission starts from: data
  collected for no reason is a liability with no upside.
