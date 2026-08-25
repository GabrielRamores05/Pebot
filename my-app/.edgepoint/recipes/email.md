# Email

**Gives you:** transactional email via Resend, with React templates, retries, and
a log of what was sent.

**Use when:** the software emails a person — confirmations, notifications, receipts.

**Don't use when:** it's bulk marketing to a list. Sending campaigns is a mailing
platform's job, not this app's. Escalate.

**But the consent is still this app's job.** Marketing that goes out from
elsewhere still has to be sent only to people who agreed to it, and stop when
they say stop. Recording that, and honouring withdrawal, is `personal-data.md` —
and the export that feeds the mailing platform contains only addresses with a
current `granted = true` consent row. A list assembled by exporting every
customer is the most common privacy breach a small business commits.

## Ask the builder

1. **What should it say?** Their words. Don't write corporate filler on their
   behalf and don't ship placeholder copy — they will not notice it before their
   customer does.
2. **Who's it from?** Name and address. They'll need to verify the domain; say so.
3. **When exactly does it go?** On the action, or later.
4. **Should anyone be copied?** Themselves, a shared inbox.
5. **If it fails to send, does the action still count?** Usually yes for
   notifications, sometimes no for confirmations. This is the one that looks
   technical and isn't — it decides whether a customer's booking exists when the
   email provider is down.

Never ask about: providers, SPF/DKIM records, queues, retry strategy, HTML email.

## Creates

```
lib/email/send.ts                  wrapper with retry + logging
lib/email/templates/<name>.tsx     React Email template
supabase/migrations/<ts>_email_log.sql
```

## Invariants

- Sending never blocks the user's action. Save first, then send.
- Failure is logged and retried, and — per the answer to question 5 — does not
  roll back the thing that triggered it unless the builder said it should.
- Every send is logged: to, template, when, outcome. When the builder says "did
  they get it?", that question needs an answer.
- Plain-text alternative alongside the HTML.
- Every email says who it's from and why it was received.
- **Preview and production must not share a sending identity.** A test run must
  never email a real customer — this is the accident that happens most.
- Anything recurring or bulk gets an unsubscribe link. Anything at all if in doubt.
  One click, no sign-in — `personal-data.md`.
- **Transactional email needs no consent and must not ask for it.** A booking
  confirmation is part of what they asked for. Do not add a marketing sentence to
  the bottom of one and call it transactional; that reclassifies the whole email.
- Never put a password, token, or full card number in an email body.
- **A notification to the builder links to the submission; it does not paste it.**
  An inbox is not access-controlled and never expires, so emailing customer
  details in bulk moves personal data somewhere none of the rules in
  `standard/privacy.md` reach.
