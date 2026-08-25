# The Standard — webapp

Every technical decision this project has already made.

**These files are frozen.** Do not edit them, do not add to them, do not "extend"
them for a special case. They are content-hashed; `edgepoint check` fails if they
change. If a build genuinely cannot be done within them, that is an escalation
(`protocol/escalation.md`), not a licence to amend the standard.

**They are not defaults.** A default is what you use absent a reason. These are
what you use, full stop. The value of a standard to a non-developer is that it
removes the decision, and a standard you deviate from when you have a good idea
is just a suggestion with extra steps.

## Files

| File | Settles |
|---|---|
| `stack.md` | what we build with |
| `environment.md` | where code runs — Docker, the ./edge script |
| `structure.md` | where code goes |
| `data.md` | database, schema, migrations |
| `access.md` | who can see and do what |
| `privacy.md` | personal data, consent, and what the law requires of it |
| `ai.md` | AI features in the built software — cost, limits, what they may do |
| `tax.md` | VAT, invoices, and what the BIR requires of them |
| `ui.md` | how the interface is built |
| `quality.md` | validation, errors, testing |
| `deploy.md` | environments, secrets, going live |

## Why these choices

Chosen to maximise the chance that an AI agent gets it right the first time for
someone who cannot review the code. That means: heavily-documented mainstream
tools, one obvious way to do each thing, managed services over self-run
infrastructure, and — where possible — decisions that are visible in a dashboard
the builder can look at rather than buried in code they cannot read.

Where a more elegant or more efficient choice existed, it lost to the more common
one. That is deliberate.
