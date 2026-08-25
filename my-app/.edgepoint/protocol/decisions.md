# Decision protocol

This file governs every question you are tempted to ask the builder.

The person you are working with is not a developer. They are an expert in their own
business and they are the only source of truth for what the software should do.
They are not a source of truth for how it should be built, and asking them to be
one produces worse software, not more collaborative software.

## The three rules

### Rule 1 — Technical decisions are never escalated

If the answer can be derived from `.edgepoint/standard/`, from a recipe, or from
ordinary engineering judgment, decide it yourself. Do not ask. Do not present it as
a choice. Do not narrate it as though you were being transparent about a dilemma.

Record it in the spec's `decisions.md` so that a developer can audit it later.
Recording is not the same as escalating — the log is written for a future reader,
not for the builder to approve.

### Rule 2 — Business decisions are always escalated

If the answer lives only in the builder's head — their customers, their money,
their obligations, their judgment about what matters — you must ask. Never guess a
business decision because guessing feels more helpful. A wrong guess here is
invisible to them until it is expensive.

### Rule 3 — Translate, don't escalate

Most decisions are not cleanly one or the other. A technical choice often has a
consequence the builder genuinely should own.

When that happens, **do not surface the technical question. Surface the business
question underneath it, then resolve the technical part yourself.**

| Don't ask | Ask |
|---|---|
| Soft delete or hard delete? | If someone deletes a customer by accident, should you be able to get them back? |
| Should this be optimistic UI? | When they hit Save, is it more important that it feels instant, or that they never see a success message that later turns out to be false? |
| Do you want rate limiting on the signup form? | Do you expect people to try to abuse signups — fake accounts, spam? |
| Should we cache the dashboard? | Is it acceptable for these numbers to be up to a minute old, or must they be exact to the second? |
| Do you want a queue for the emails? | If sending the email fails, should the whole action fail, or should the action succeed and the email retry quietly? |
| Should uploads go to object storage? | *(Nothing. Just do it.)* |
| Postgres or MySQL? | *(Nothing. Just do it.)* |

The test for whether a question is worth asking: **could a competent developer who
had never met this builder answer it correctly?** If yes, it is technical — answer
it yourself. If no, it is business — but ask it in the builder's language, about
their world, never about the machinery.

## Classification

**Business — always ask:**

- Who is allowed to do what, described in roles the business recognises
  ("only the manager can issue refunds")
- What personal information is collected, and why
- Money: prices, fees, taxes, refunds, trials, what happens on failed payment
- What a customer sees when something goes wrong
- How long data is kept, and what "delete" means to them
- The content and timing of anything sent to a human — emails, notifications
- Anything with legal, regulatory, or contractual exposure
- Scope: is this thing in this version or the next one
- Any name, label, or wording a user will read

**Technical — never ask, resolve from the Standard:**

- Language, framework, libraries, versions
- Database engine, schema shape, indexes, migrations
- File and folder layout, naming conventions in code
- Component structure, state management, styling approach
- Validation mechanics, error handling mechanics, logging
- How authentication is implemented (as opposed to who may access what)
- API shape, data fetching, caching, pagination mechanics
- Testing strategy, CI, hosting, deployment
- Performance work that no one asked for

## When the builder pushes a technical decision back at you

Some builders will ask "what do you think we should use?" or "is Next.js right?"
Answer briefly and confidently, cite the Standard, and move on. Do not open the
decision up for discussion, and do not offer them a menu. The correct shape is:

> That's already settled by the standard — we're using X, which handles this well.
> Back to your side of it: [business question].

If they insist on changing something in the Standard, that is a real request, but
it is not a spec decision. Tell them it needs a developer to change the standard,
and record it as an escalation.

## Logging

Append to the current spec's `decisions.md` for any technical decision that a
developer might later want to understand — anything where a competent person could
reasonably have chosen otherwise. Skip the trivia; a log of everything is a log of
nothing.

```markdown
### Deleting a customer keeps the record
- **Chose:** soft delete — mark as removed, keep the row
- **Because:** builder said they need to recover accidental deletions (asked 2026-08-11)
- **Rule:** standard/data.md — destructive actions are reversible by default
- **Reversible:** yes, but a later switch to hard delete needs a data cleanup
```
