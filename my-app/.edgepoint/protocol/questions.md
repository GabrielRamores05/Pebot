# How to ask

Rule 2 says which questions to ask. This file says how. A badly-shaped business
question does as much damage as a technical one, because the builder answers it
anyway — by guessing at what you meant.

## The contract

**One question at a time.** Not a numbered list of eight. The builder cannot hold
eight open decisions, and a batch invites them to skim and answer the easy ones.
Ask, wait, absorb the answer, then ask the next. If you have eight questions, you
have probably not tried hard enough to answer six of them yourself.

**No jargon, and no jargon in disguise.** Not "entity", "record", "persist",
"authenticate", "async", "validation". Say customer, save, sign in, check. If a
term belongs to their business — invoice, shipment, patient — use it exactly as
they use it.

**Always give 2–4 concrete options.** An open question ("how should refunds work?")
puts the design burden back on them. Options turn it into a choice they are
qualified to make. Concrete means specific enough to picture, not "flexible" vs
"strict".

**Always recommend one, and say why.** They are asking you because you know more
than they do about how these usually go. Withholding a recommendation is not
neutrality, it is abdication. Mark it plainly: *I'd suggest the second one.*

**Always state the consequence in their terms.** Not "this adds complexity" — say
what it costs them: what their customer will experience, what work it creates for
their staff, what it will be painful to change later.

**Say when it's cheap to change.** Most decisions are reversible and they should
know that, so they don't freeze. Equally, say plainly when something is expensive
to undo — that is when they should think hard.

## Shape

> **When someone cancels their subscription, what happens to what they've already made?**
>
> - **They keep read-only access forever** — they can see their work but not change it. Friendliest, and makes it easy for them to come back later.
> - **They keep full access until the period they paid for ends, then lose it** — the most common approach, and the fairest-feeling to people who paid.
> - **Access ends immediately** — cleanest, but people who paid for a month and cancel on day 2 will be annoyed and will email you.
>
> I'd suggest the second. It matches what people expect from other subscriptions,
> so you'll get fewer complaints.
>
> Easy to change later either way — this is just a rule we check, not something
> baked into how the data is stored.

## When they don't know

They will sometimes say "I don't know" or "you decide". That is a legitimate
answer, not an obstacle.

Take the recommendation, apply it, log it in `decisions.md` marked as *chosen by
default, not confirmed*, and tell them in one line what you went with so it isn't
a surprise later. Do not re-ask. Do not press them. Do not explain the trade-off
a second time in more detail — if they didn't have an opinion, more information
will not produce one, it will only make them feel stupid.

## When they answer something you didn't ask

Common, and usually valuable — they are telling you about their business. Absorb
it into the spec, then return to the original question once. If they dodge it
twice, treat it as "you decide" and move on.

## What never to ask

- Permission to follow the standard
- Whether to write tests
- Whether they want it done properly
- Anything answered in `standard/` or a recipe
- Anything you have already asked in this spec — read `decisions.md` before asking
