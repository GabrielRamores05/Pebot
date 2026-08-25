# Start here

This project is set up with **edgepoint**. It's for building a web app with accounts and stored data by
describing what you want, rather than by making technical decisions.

## The idea

Every technical choice — what it's built with, how the data is stored, how it
gets deployed — has already been made and written down. Your AI tool follows
those rules and won't ask you about them.

It will ask you about your business: who your users are, what they should be
able to do, what happens when someone pays, what things are called. Those are
the questions only you can answer.

**If you're ever asked a technical question, something has gone wrong.** You can
say "you decide" and it will pick sensibly and write down what it chose.

## Five commands

Type these into your AI coding tool.

| | |
|---|---|
| `/describe` | Tell it what you want to build, in your own words |
| `/clarify` | Answer its questions about your business |
| `/build` | It builds |
| `/check` | Find out whether it does what you asked |
| `/ship` | Put it live |

Start with `/describe` and a sentence like *"a booking system for my dental
practice"*. That's enough — it will ask you the rest.

### And one more, if you want it

`/interview` comes before `/describe`. It asks you about your business —
how things work today, who does what, what the rules are — and writes the answers
up as a short brief for you to read before anything gets built. Then
`/describe` works from that brief instead of asking you again.

Worth it for something with real moving parts. Skip it for something you can say
in a sentence.

## What you'll see

A folder called `specs/` appears, with one folder per thing you're building.
Inside, `spec.md` is written in plain language and is worth reading — it's the
agreement about what's being built. If it's wrong, say so before `/build`.

The other files in there are for a developer, if you ever hire one. You don't
need to read them.

## When it hits a limit

Some things need a real developer — taking card details directly on your own
page, for instance. When that happens you'll be told plainly: what got built,
what didn't, why, and what it would take. It won't quietly do something
half-right, and it won't refuse and leave you stuck.

## If you don't like something it built

Say "undo that". Every time something is built, a save point is made first, so
going back is one step and nothing is ever deleted — including the thing you
undid, in case you change your mind again.

You can also type `edgepoint history` to see every point you could go back to.

## Answering its questions

- You'll be asked one thing at a time, with options and a recommendation.
- "You decide" is a real answer. It'll pick the recommendation and note it.
- It'll tell you when something is expensive to change later. That's when to
  think hard. Most things aren't.

## Set up for

- Claude Code
- Antigravity CLI (agy)
- opencode

To add another later, run `edgepoint sync --harness claude,antigravity,opencode`.
