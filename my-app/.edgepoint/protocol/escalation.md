# The edge

The Standard covers a wide but finite set of software. Sooner or later a builder
will ask for something outside it. What you do at that moment matters more than
anything you do inside it.

**Do not improvise past the edge.** A non-developer cannot evaluate whether your
workaround is sound. If you go off-standard quietly, they will find out months
later, from a bug they cannot describe, in code no one has an opinion about.
Silence at the edge is the single worst failure mode of this framework.

**Do not refuse either.** "I can't do that" is useless to someone who has a real
business need. Say what you can do, and say what the rest needs.

## What counts as the edge

- The request needs a technology the Standard doesn't cover (a mobile app, a
  desktop app, real-time collaboration, video processing, training a model of
  their own)
- It needs an integration with a system that has no recipe and no public,
  documented API
- It touches regulated territory — payments beyond a hosted checkout, or any of
  the Philippine-specific edges below
- It requires changing the Standard itself
- Doing it properly conflicts with a rule in `standard/`
- You have tried twice and the honest answer is that you do not know how

## The Philippine edges

These are the ones that arrive looking like ordinary feature requests, which is
what makes them dangerous. The rules are in the `webapp` standard —
`privacy.md` and `tax.md` — and each is an escalation, never a refusal.

- **Health information**, anything about a **proceeding for an offence**, or data
  about **children under 18**. Sensitive personal information carrying duties the
  Standard does not implement.
- **Storing government ID numbers or ID photographs** — TIN, SSS, PhilHealth,
  PhilSys, passport, driver's licence. Possible under conditions; check first
  whether the builder needs the number kept or only needs the check done.
- **The app issuing the builder's actual BIR invoice.** The system has to be
  registered with the BIR before use, and doing it can pull them into electronic
  invoicing. An order confirmation ships today instead.
- **Zero-rated, VAT-exempt, or export sales**, and anything that computes what the
  builder owes in tax.

The tell is the same in all four: the consequence of getting it wrong lands on
the builder, in a forum they cannot argue in, months later.

## The AI edges

AI features **are** in the Standard — `standard/ai.md` and the four `ai-*`
recipes. What stays outside it:

- **Anything acting on model output without a person** — sending, publishing,
  refunding, deleting. It drafts; a person presses the button.
- **A decision about a person made by a machine** — who gets the loan, the
  interview, the flag.
- **Content that doesn't fit in a prompt**, needing a retrieval or search layer.
- **Sensitive personal information sent to a model** — health records,
  government ID numbers.

Do not improvise around these. The failure is fluent, confident, and wrong, which
is the hardest kind for a non-developer to catch.

## What to do

1. Write it to `escalations.md` in the current spec folder.
2. Build everything around it that *is* in standard. Do not down tools over one
   blocked piece — partial delivery with a clearly marked gap is far more useful
   than a stall.
3. Tell the builder, in their language: what you built, what you couldn't, why it
   needs a person, and roughly what kind of person.

## How it sounds

> I've built the booking form, the confirmation email and the admin list — those
> are all working and you can try them now.
>
> The one part I've stopped short of is **taking card payments directly on your
> site**. Handling card numbers yourself brings in security rules (PCI) that need
> a developer to set up properly, and getting it wrong is the kind of mistake
> that's expensive rather than annoying.
>
> Two ways forward:
>
> - **Use PayMongo's hosted checkout** — your customer clicks Pay and is taken to a
>   PayMongo page where they can use GCash, Maya or a card, then comes back. I can
>   build this now, today. It looks slightly less seamless.
> - **Payments on your own page** — needs a developer for about a day, and a
>   security review.
>
> I'd suggest the hosted checkout to start. Almost everyone begins there, and
> moving to the other later doesn't waste this work.
>
> I've noted this in `escalations.md` so it isn't forgotten.

Note the shape: what works, what doesn't, why in business terms, what it would
take, a recommendation, and a way to keep moving today.

## Escalation entry

```markdown
### Card payments taken directly on the site
- **Asked for:** 2026-08-11, during the checkout spec
- **Why it's blocked:** handling raw card details requires PCI compliance; outside standard
- **Built instead:** PayMongo hosted checkout (recipe: payments)
- **To unblock:** a developer to take card details on-site and complete a PCI SAQ A-EP assessment
- **Builder was told:** yes
```

## The other edge: when you are stuck, not blocked

Different situation, same honesty. If you have tried a thing twice and it is not
working, say so on the second failure, not the sixth. Describe what is failing in
plain words and say what you are going to try next. Non-developers watching an
agent loop silently cannot tell the difference between hard work and thrashing,
and they will not interrupt you, because they assume you know what you are doing.

## Report the gap back

Everything above handles *this* builder. This handles the next one.

The Standard and the recipes are finite, and the only people who find their edges
are you and the builder you are working with. If a gap is not written down at the
moment it is found, nobody ever learns about it: the builder cannot describe it,
and you will not be here next week.

**Write a report when any of these happens:**

- No recipe covers what you are building, and it is not at the edge either — the
  Standard is simply silent, and you had to decide something it should have
  decided for you.
- A recipe exists but did not fit, so you deviated from it. Note what did not fit.
- Two rules conflict, or one is ambiguous enough that two readings give different
  software.
- You got stuck twice on the same thing (above). What confused you will confuse
  the next model.
- You filed an escalation. Every escalation is a gap by definition — that report
  is two lines and a pointer to the spec's `escalations.md`.

**Do not write one** for a business decision that is properly the builder's, for a
bug in code you wrote and then fixed, or for something already sitting in
`.edgepoint/feedback/`. Read that folder first; a second copy of a known gap is
noise that buries the rest.

### Writing it is silent housekeeping

Write it to `.edgepoint/feedback/<date>-<short-slug>.md` and carry on. Do not
interrupt the build for it, do not ask permission to write it, and do not report
having written it — it is the same register as tidying up `decisions.md`. The
builder hired software, not a research project.

### Describe the gap, never the business

These reports leave the project. Somebody who has never met this builder reads
them, and they may end up in a public issue.

So write about the **shape** of what was missing, not about the business it was
missing from. No business names, no customer data, no personal data of any kind,
no `spec.md` text quoted verbatim, no domain names, no keys, no file paths outside
the framework's own. "A booking app needed appointments that repeat weekly" is
right. "Dr Reyes at Cebu Smile Dental needs..." is a disclosure, and there is no
version of this that is worth making one.

If the gap cannot be described without the business, it is not a framework gap.
Leave it in the spec's `decisions.md` and move on.

### The report

```markdown
# Records that repeat had no recipe

- **Framework:** 0.9.0, webapp pack
- **Found:** 2026-08-13, building a booking feature
- **Trigger:** no recipe covered it

## What was being built
Appointments that repeat weekly, where cancelling one week must not cancel the
rest of the series.

## What I looked for
`recipes/crud-resource.md`, `recipes/admin-table.md`, `standard/data.md`. Nothing
covers a record that stands for a series rather than one thing.

## What I did instead
One row per occurrence with a shared `series_id`, `crud-resource.md` followed for
everything else. Logged in the spec's `decisions.md`.

## What would have helped
A recipe for a record that repeats: whether occurrences exist up front or are
generated, what "change this one" versus "change all of them" does, and what
happens to occurrences already in the past.
```

The last section is the one that matters. A report that only says what went wrong
tells a maintainer they have a problem; one that says what would have helped tells
them what to write.

### Sending it is the builder's call

The reports sit in the project until somebody sends them. **Never send one
without being asked**, and never mid-build.

At the end of a build, alongside the other things you collected for them, ask
once — plainly, and in the shape `questions.md` requires:

> One thing for later. Your toolkit didn't have a pattern for appointments that
> repeat, so I worked one out. I've written a note about what was missing — it
> describes the missing pattern, nothing about your business or your customers.
> Send it to the people who maintain the toolkit?
>
> - **Yes, send it** *(recommended)* — it's how the gap gets filled, for you and
>   everyone else using this
> - **No, leave it** — it stays in your project and nothing goes anywhere

On yes, run `edgepoint feedback --send`. On no, leave it queued and do not ask
again — asking twice about the same note is pestering someone who has already
answered.

If `edgepoint feedback --send` reports that it cannot reach GitHub, that is the
end of it: say nothing to the builder about tokens, `gh`, or authentication, and
never tell them to install anything. Leave the notes queued for a developer.
