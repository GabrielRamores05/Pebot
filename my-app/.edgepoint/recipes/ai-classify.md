# AI that sorts things

**Gives you:** incoming items tagged, routed, or prioritised automatically —
enquiries by topic, applications by urgency, messages by which team handles them
— against a fixed list the builder chose, with an "unsure" outcome and a way to
correct it.

**Use when:** something arrives in volume and someone currently reads each one to
decide where it goes.

**Don't use when:** a rule would do it. If "contains the word invoice" is right
99% of the time, write that — it's free, instant, and explainable.

**Escalate when:** the decision has a consequence for the person being sorted —
who gets a loan, who gets an interview, who gets flagged. That is a decision
about a person made by a machine, it carries obligations beyond this Standard,
and it needs a person accountable for it.

## Ask the builder

1. **What are the categories?** Their exact words, and a fixed list — the same
   labels their staff already use. If they can't list them, they aren't ready to
   automate this yet, and saying so is more useful than guessing.
2. **What should happen when it isn't sure?** Options: leave it untagged for
   someone to sort; put it in a "needs a look" pile; guess anyway. Recommend the
   middle one — an unsure pile is checked, a wrong confident tag is not.
3. **What's the most you'd want this to cost you in a month?** Per
   `standard/ai.md`. Volume is predictable here — it's one call per item — so the
   estimate can be honest.

Never ask about: models, prompts, confidence thresholds, tokens, training,
fine-tuning.

## Creates

```
lib/ai/client.ts                        the wrapper — see standard/ai.md
lib/ai/limits.ts                        spend ceiling
lib/validation/<name>-category.ts       Zod enum of the builder's categories
lib/ai/classify.ts                      structured output, low effort
supabase/migrations/<ts>_add_<name>_category.sql
app/(app)/admin/<name>/page.tsx         the list, filterable, per admin-table.md
tests/acceptance/classify.spec.ts       runs with AI_FAKE=1
```

## Invariants

- **Classifying never blocks or fails the thing that triggered it.** The enquiry
  saves first, always, and is then classified. Same rule as the notification
  email in `public-form.md`, and for the same reason: never lose a customer's
  message because a third party had a bad minute.
- **Run it inline, right after the save, not as a scheduled job.** Background jobs
  connect as `postgres` and bypass RLS entirely (`access.md`), which is where
  leaks actually happen. Inline keeps the safety net on. A queue is an escalation.
- **The categories are a Zod enum**, so the only possible outcomes are the
  builder's list plus "unsure". Anything else fails validation and lands in the
  unsure pile — a model cannot invent a nineteenth category.
- **"Unsure" is a real outcome, not a failure.** The instructions tell it to say
  so rather than pick the closest thing, and the answer to question 2 decides
  what happens next.
- **A person can always change the tag**, and the change sticks. Nothing
  re-classifies over a human correction — the fastest way to make staff stop
  trusting the whole feature.
- **What it chose is recorded** — the tag, when, and that it was automatic rather
  than a person's. When the builder asks "why is this in here?", that needs an
  answer.
- **Only the item goes in the prompt.** One enquiry, not the enquiry list.
- **Tier `FAST`, and a tight `max_tokens`.** The answer is one label from the
  builder's own list, checked by the unsure path and correctable by hand — which
  is exactly what licenses the cheap tier (`standard/ai.md`). There is no reason
  to leave room for an essay, and this runs on every item that arrives.
- Prompts and items are not logged; the item is a customer's words
  (`standard/privacy.md`).
- Acceptance tests run against the fake: a tagged item lands in the right list,
  an unsure one lands in the unsure pile, a human correction survives, and a
  failure to classify still leaves the item saved.
