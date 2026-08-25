# An assistant that answers from the builder's own content

**Gives you:** a chat box that answers questions using material the builder wrote
— opening hours, policies, FAQ, price list, how their service works — held in a
cached prompt, streamed, with a spend limit and a clear handover to a human.

**Use when:** the builder answers the same handful of questions all day.

**Don't use when:** the answer changes per customer and lives in the database. An
assistant that has to look things up per person is a different, larger thing —
see the escalation below.

**Escalate when:**

- **Their content doesn't fit.** A document library, thousands of products, years
  of archives. `standard/ai.md` deliberately has no retrieval layer; do not
  improvise one. Say plainly that this needs a developer, and offer the assistant
  over their main content today.
- **They want it to look up a specific customer's data** — order status, balance,
  booking. Doable, but it is an authorization design, not a chat feature, and it
  is where this pattern most often leaks one customer's data to another. Offer
  the signed-in version: the person is already authenticated, application code
  fetches *their* rows under `withUser`, and only those go in the prompt.
- **They want it to take an action** — cancel a booking, issue a refund. Nothing
  irreversible happens on model output (`standard/ai.md`).

## Ask the builder

1. **What do people ask you again and again?** Their list is the content, in
   their words. Push for the actual answers too — this assistant knows what they
   write down and nothing else.
2. **What should it do when it doesn't know?** The most important question here.
   Options: say so and show a contact form; say so and give a phone number; hand
   off to email. Recommend saying so plainly and offering the contact form —
   people forgive "I don't know, here's who does" and do not forgive a confident
   wrong answer.
3. **Is this for anyone visiting, or only people signed in?** Changes the cost
   exposure and the access rules.
4. **What's the most you'd want this to cost you in a month?** Per
   `standard/ai.md`. If the answer to 3 was "anyone visiting", say plainly that a
   public chat box can be used by anyone who finds it, which is why the limit is
   there.

Never ask about: embeddings, vector databases, context windows, RAG, chunking,
tokens, which model, which provider.

## Creates

```
lib/ai/client.ts                        the wrapper — see standard/ai.md
lib/ai/limits.ts                        spend ceiling, per person and per IP
content/assistant/*.md                  the builder's content, editable by them
lib/ai/assistant.ts                     cached system block + the question
app/api/ai/chat/route.ts                streams
components/assistant/chat.tsx
tests/acceptance/assistant.spec.ts      runs with AI_FAKE=1
```

## Invariants

- **Tier `WRITE`** (`standard/ai.md`). A customer reads the answer with nobody in
  between, which is the whole reason this tier exists.
- **It answers only from the supplied content.** The instructions say so, and say
  what to do otherwise — the answer from question 2, in the builder's words.
  Never "answer as best you can".
- **The content sits at the top of the system message and the question goes
  last.** Nothing that changes per request — no timestamp, no session id, no name
  — goes anywhere near the stable part. Where the routed model supports prompt
  caching, that ordering is what makes repeat questions cheap; where it doesn't,
  it cost nothing to get right. Don't promise the builder a saving that depends
  on which provider served the request (`standard/ai.md`).
- **The content lives in files the builder can edit**, not in code. They will
  change their opening hours, and that must not be a deploy.
- **Rate limited by IP as well as by person** when it's public. It's a public
  endpoint that spends money on every call — the one place in this Standard where
  those two facts meet.
- **The handover is always visible.** A way to reach a human is on screen from
  the first message, not offered only after the assistant fails.
- **It says it's an assistant**, per `standard/ai.md`. Someone who thinks they're
  talking to the owner will act on what it says.
- **Conversations are personal data.** People type their name, their order
  number, their problem. Kept per the retention answer in `personal-data.md`,
  included in an export, deleted on erasure, and never written to the log.
- **Signed-in version: rows come from `withUser` first.** The model never picks
  what to fetch — `standard/ai.md`. This is the invariant that keeps one
  customer's data out of another's answer.
- Acceptance tests run against the fake: an answer appears, the don't-know path
  shows the handover, the limit stops it, a failure leaves the contact route
  working.
