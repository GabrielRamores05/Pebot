# Interface

This file settles **how the interface is built and how it behaves**. It is
deliberately silent on what it looks like — type, colour, density, motion. That
belongs to the `frontend-design` skill, which is installed alongside the
workflow commands.

Where the two ever appear to disagree, **this file wins**. A distinctive look is
a theme applied to the primitives below; it is never a reason to hand-write a
component, skip one of the three states, or drop an accessibility rule.

## Components

shadcn/ui primitives from `components/ui/`, composed into feature components.
Don't hand-write a button, dialog, dropdown, or form control that shadcn provides,
and don't restyle a primitive at the call site — if it needs to look different
everywhere, change the primitive once.

Tailwind utilities for layout and spacing. No CSS files, no CSS-in-JS, no inline
`style` except for genuinely dynamic values.

## Every list has three other states

The empty state, the loading state, and the error state are part of the feature,
not polish to add later. A non-developer's app is *mostly* empty states — they
will look at it for the first time with no data in it, and "blank white page"
reads as broken.

- **Empty** — say what would be here and how to add the first one, with the button
  to do it right there.
- **Loading** — a skeleton in the shape of the content. Not a spinner mid-page.
- **Error** — what went wrong in plain words and a way to retry. Never a raw error.

## Forms

react-hook-form with a Zod resolver, sharing the exact schema the server uses.
One schema in `lib/validation/`, imported both sides.

Validate on blur, not on every keystroke — an error appearing while someone is
still typing their email reads as an accusation.

Errors sit next to the field they're about. The submit button disables and shows
progress while submitting. Success is visible and specific: "Booking confirmed",
not "Success".

Never lose what someone typed. Not on validation failure, not on a server error,
not on a navigation. Re-typing a long form because the server hiccuped is the
single most enraging thing software does.

## Feedback

Every action a person takes produces visible evidence it happened, within 100ms —
even if the work is still running. Destructive actions confirm first, and the
confirmation names the specific thing: "Delete booking for Sarah Chen?", not
"Are you sure?".

## Accessible by default

Real semantic elements. `<button>` for actions, `<a>` for navigation — never a
`div` with an onClick. Every input has a label. Every image has alt text. Focus is
visible and keyboard order is sane. Text contrast at least 4.5:1.

This is not asked about, negotiated, or deferred to a later pass. It is also how
Playwright finds things, so an inaccessible interface is an untestable one.

## Responsive

Mobile first. It works at 375px wide. The builder will show their app to someone
on a phone within a day of it existing.

## Dark mode

Only if the builder asks. Half-done dark mode looks worse than none.
