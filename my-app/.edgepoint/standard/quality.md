# Validation, errors, testing

## Validate at the boundary

Zod schemas in `lib/validation/`, one file per feature, shared between client and
server. Parse everything crossing a boundary: form submissions, route handler
bodies, URL params, webhook payloads, and third-party API responses.

Client validation is a courtesy to the user. Server validation is the actual
control. Never rely on the client having done it — the client is a suggestion.

## Errors

Three audiences, three different things:

**The person using it** gets a plain sentence about what happened and what to do:
"We couldn't save that — check your connection and try again." Never a stack
trace, never an error code, never "something went wrong" with no next step.

**The log** gets everything — the error, the stack, and enough context to find it.
Never log personal data, tokens, or card details.

**The builder** gets told, in `/check`, in the same plain language.

Let errors that you cannot handle propagate to the nearest error boundary rather
than swallowing them. A caught-and-ignored error is a bug that has been hidden
rather than fixed, and it will surface later as behaviour nobody can explain.

Every route group has an `error.tsx` and the root has a `not-found.tsx`.

## Testing

Run them with `./edge test`. Never `npx playwright test` — the browsers and their
system libraries live in the container, not on the builder's machine. See
`environment.md`.

**Acceptance tests are the deliverable.** Every criterion in `spec.md` gets one
Playwright test, mapped in `tasks.md`. This is how the builder knows their
software works — they read their own sentence and see it pass. Their tests, in
their words.

Write them the way a person uses the app: find things by their visible label or
role, not by CSS class or test id. Test the path a real person takes, not the
happy path with the awkward parts skipped.

**Unit tests** where logic is genuinely worth pinning down: money arithmetic,
dates, availability rules, anything with edge cases a person would get wrong.
Not for getters, not for framework behaviour, and not for coverage as a number.

Never delete or weaken a test to make a build pass. A failing test is
information. Turning it green by changing what it asserts destroys the only
mechanism the builder has for knowing whether their software works — and they
cannot read the diff to notice you did it.

If a test is genuinely wrong, say so plainly and explain why before changing it.

**The printed test guide is the human half of the same thing.** `./edge guide`
turns the criteria into a step-by-step PDF with screenshots, for whoever is going
to try the software by hand — the builder, their staff, a client. It reads the
same criteria the acceptance tests do, so the two cannot describe different
software. The `test-guide` skill has the detail.

## Types

`strict: true`. No `any`. No `@ts-expect-error` without a comment saying why.
Types on exported functions; inference inside them.

Types generated from the database schema — regenerate after every migration, so
the schema and the code cannot silently disagree.
