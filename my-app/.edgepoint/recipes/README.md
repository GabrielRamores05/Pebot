# Recipes

Pre-decided patterns. Check here before writing anything from scratch.

A recipe is not example code to adapt. It is the decided way this project does a
thing, so that the tenth form behaves like the first and a builder who learns one
screen has learned them all. Consistency is worth more here than local elegance,
because the person maintaining this cannot read the code to discover that two
screens work differently.

## Each recipe tells you

- **Gives you** — what you get
- **Use when / don't use when** — the boundary
- **Ask the builder** — the business questions this pattern genuinely raises.
  These, and no others. If a recipe lists three questions, you ask at most three.
- **Creates** — the files
- **Invariants** — what must stay true. Breaking one is an escalation, not a
  judgement call.

## Available

| Recipe | For |
|---|---|
| `auth.md` | signing in, accounts, protected pages |
| `multi-tenancy.md` | separate companies or teams sharing one app |
| `team-invites.md` | inviting colleagues, roles, removing people |
| `crud-resource.md` | a thing users create, view, edit, remove |
| `public-form.md` | a form anyone can submit — enquiry, signup, booking |
| `admin-table.md` | an internal list to search, filter, act on |
| `file-upload.md` | images and documents |
| `email.md` | transactional email |
| `payments.md` | taking money |
| `invoicing.md` | the document the customer gets for what they bought |
| `personal-data.md` | privacy notice, consent, and "delete everything about me" |
| `ai-assist.md` | AI that drafts or rewrites something a person then sends |
| `ai-extract.md` | AI that reads a document and fills in fields |
| `ai-chat.md` | an assistant answering from the builder's own content |
| `ai-classify.md` | AI that tags, routes, or prioritises what comes in |

## Read `multi-tenancy.md` first

Whether separate companies share the app changes the shape of every table and
every access rule in this list. It is the one decision here that is genuinely
expensive to reverse, so settle it during the first `/clarify` — before any table
exists — rather than discovering it on the third feature.

## The four `ai-*` recipes share one rule file

Read `standard/ai.md` before any of them. It settles the model, the wrapper, the
hard spend ceiling, and — the part that matters most — what an AI feature is
never allowed to do. All four assume it.

## `personal-data.md` applies to nearly every project

If the app stores anything about an identifiable person — and a webapp does from
its first feature — that recipe is not optional and not a later phase. The
obligations in `standard/privacy.md` start with the first row, not with the first
complaint.

## Nothing fits

Build it per the Standard and say so in `plan.md` under *not covered by a recipe*.
That is where risk concentrates, so it should be visible.

**Then log the gap.** Write it to `.edgepoint/feedback/` as
`protocol/escalation.md` describes — silently, without asking, and carry on
building. A missing recipe is a gap in this framework, and you are the only one
who will ever see it: the builder cannot report the absence of something they did
not know existed. That folder is how this list gets longer.

Do not write it into `recipes/` yourself — that directory is frozen and hashed. If
you build the same non-recipe thing a second time, that belongs in the note too;
twice is the difference between an edge case and a missing recipe.
