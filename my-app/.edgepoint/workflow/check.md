---
description: Check whether it does what you asked for
---

Run `edgepoint check` and explain the result. Scope: {{ARGS}} if given, otherwise
the current spec.

`edgepoint check` runs the structural checks and then the acceptance tests. You are
not re-implementing any of that — you run it and translate.

## Translating the result

Go criterion by criterion, in the builder's own words from `spec.md`:

> ✅ When I fill in the form and click Send, I see a confirmation
> ✅ The enquiry appears in the admin list
> ❌ I get an email within a minute — *not working: the email is being sent to the
>    address in the form rather than to you. Fixable in a minute, want me to?*

The builder should never see a stack trace, an assertion diff, or a test file path
unless they ask. A failure is a sentence about their software, plus what you intend
to do about it.

If it reports that Docker isn't installed or isn't running, that is not a test
failure — say so plainly and tell them to start Docker Desktop. `edgepoint doctor`
checks the machine and says what to fix.

## The structural checks

These are about the framework, not their software, so keep them brief:

- **Standard modified** — something changed files that are meant to be frozen.
  Serious. Tell them the standard has been edited and that it should be put back
  unless a developer changed it deliberately.
- **Stack terms in the spec** — a warning. The spec has drifted into describing
  machinery. Offer to rewrite that line in business terms. Not a failure; do not
  make them feel they've done something wrong.
- **Undocumented decisions** — you made technical calls that aren't in
  `decisions.md`. Fix it yourself, silently. Don't report housekeeping.
- **Notes about the framework** — `.edgepoint/feedback/` has reports of where the
  standard or a recipe came up short. Not the builder's problem and not a failure;
  don't read them out. If any are queued and you haven't already asked about
  sending them, ask once, per `protocol/escalation.md`.

## Then

If everything passes, say so in one line and tell them what to try themselves —
name the actual thing to click. Passing tests are evidence, not proof, and the
builder looking at their own software is worth more than a green tick.

If things fail, say what's broken, whether you can fix it, and ask whether to go
ahead. Fix forward — do not start redesigning the spec because a test failed.
