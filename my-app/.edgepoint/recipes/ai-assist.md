# AI that drafts and rewrites

**Gives you:** a button that writes something for the person using the app — a
reply to an enquiry, a product description, a summary of a long thread — shown as
an editable draft, streamed as it's written, with a spend limit and a working
fallback when it fails.

**Use when:** the builder or their staff spend time writing the same kind of thing
over and over.

**Don't use when:** the text goes straight to a customer without anyone reading
it. That is not this recipe, and per `standard/ai.md` nothing irreversible
happens on AI output alone.

**Escalate when:**

- **They want it to send, publish, or post the result automatically.** The value
  they're imagining is real, and so is the first time it emails a customer
  something wrong in their name. Offer one-click *send after reading* — nearly
  the same saving, none of the exposure.
- **The material is sensitive personal information** — health notes, anything on
  the list in `standard/privacy.md`.

## Ask the builder

1. **What do you write over and over that you'd like a first draft of?** Their
   answer names the feature. Ask for two or three real examples of what they'd
   normally write — those become the instructions, in their voice rather than a
   generic one.
2. **Who's allowed to use it?** Everyone signed in, or only some roles. An
   authorization question, so it goes in the spec and gets a policy.
3. **What's the most you'd want this to cost you in a month?** In pesos. Follow
   the script in `standard/ai.md` — hard ceiling, no surprises.

Never ask about: models, tokens, prompts, streaming, temperature, context
windows, which provider, which AI company.

## Creates

```
lib/ai/client.ts                        the wrapper — see standard/ai.md
lib/ai/limits.ts                        spend ceiling, per person per day
lib/ai/draft.ts                         this feature's instructions and call
supabase/migrations/<ts>_create_ai_usage.sql
app/api/ai/draft/route.ts               streams to the browser
components/<feature>/draft-button.tsx
tests/acceptance/draft.spec.ts          runs with AI_FAKE=1
```

## Invariants

- **Tier `WRITE`** (`standard/ai.md`). The output is prose going to a customer in
  the builder's name; nothing downstream catches a subtly poor one except the
  person reading it, so this is not tiered down to save money.
- **It produces a draft, in an editable box, that a person sends.** Never the
  final artefact. Labelled as a draft where it appears.
- **Streamed**, so text appears as it's written. A ten-second spinner reads as
  broken; the same ten seconds with words arriving reads as fast.
- **Whatever they had already typed survives.** Generating a draft never
  overwrites their own words without an undo — the fastest way to make someone
  distrust a feature permanently.
- **The spend ceiling is checked before the call, not after.** At the limit, the
  plain sentence from `standard/ai.md`, and the normal write-it-yourself path
  still works.
- **Refusals and errors fall back to the manual path** with nothing lost, per
  `standard/ai.md`.
- **Only the records the person can already see go into the prompt**, fetched by
  application code under `withUser` first. The model never queries anything.
- **The builder's examples live in the system message**; the specific thing being
  drafted goes last, in a user message. That order is also what lets prompt
  caching help where the routed model supports it — `standard/ai.md`.
- **Prompts and drafts are not written to the log** — they contain customer
  wording, which is personal data.
- Every acceptance test runs against the fake. Assert that a draft appears, is
  editable, can be discarded, and that the limit and the failure path both behave.
