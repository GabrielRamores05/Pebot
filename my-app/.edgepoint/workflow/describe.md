---
description: Tell edgepoint what you want to build, in your own words
---

The builder wants to build: **{{ARGS}}**

If that is empty, ask them what they'd like to build and wait. One question, no menu.

## Your job in this phase

Turn what they said into a draft spec. You are writing down *their* intent, not
designing software yet.

Read first, before writing anything:

- `.edgepoint/protocol/decisions.md`
- `.edgepoint/protocol/questions.md`
- `.edgepoint/standard/` — so you know what's already settled
- `.edgepoint/recipes/` — so you know what already exists

## First: have they already been interviewed?

Look at the newest folder in `specs/`. If it holds a `prd.md` and its `spec.md` is
still the untouched template — the two `- When I ..., then ...` stubs still there —
then `/interview` has already done this conversation and that folder is this spec.

In that case: **do not run `edgepoint new`**, and do not ask them anything.

- Write `spec.md` from the brief, section for section. The brief's sections were
  written to match; this is transcription, not interpretation.
- Copy the brief's *Settled without asking* into `decisions.md`, one entry each.
  This is what stops `/clarify` asking them things they have already answered.
- Copy *Needs a developer* into `escalations.md`.
- Only the brief's *Still open* items, plus anything the brief genuinely does not
  answer, become `TO CLARIFY` in the spec. Nothing the interview settled is
  reopened.

Then skip to *Then tell them* below.

If what they typed above describes something different from the brief, it is a
new thing to build — carry on with the steps below and leave that folder alone.

## Steps

1. Run `edgepoint new "<short name for this>"`. It creates `specs/NNN-slug/` and
   prints the path. Everything below goes in there.

2. Write `spec.md` from the template already in that folder. Fill in what they told
   you. Where you don't know, write `TO CLARIFY: <the question>` — do not invent
   business facts, and do not leave a section looking complete when it isn't.

3. Write acceptance criteria as things the builder could check themselves:

   > When I fill in the form and click Send, I see a confirmation, and the enquiry
   > appears in the admin list.

   Not "the POST handler validates the payload". If a criterion isn't something
   they could sit down and try, rewrite it.

4. Note which recipes cover this. If most of the build is recipes, say so — it's
   good news and it means fewer questions for them.

5. Do **not** write code. Do **not** create the project. Do **not** ask business
   questions yet — that is the next phase, and mixing the two produces a scattered
   interrogation instead of a conversation.

## Then tell them

Summarise the spec back in plain language — a short paragraph, not a document dump.
Say how many things you need to ask them about, and tell them to run `/clarify`
when they're ready.

If nothing needs clarifying, say so and point them at `/build`.
