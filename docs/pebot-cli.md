# The `pebot` command

One command, two halves:

- **Spec-driven development** — `pebot init`, `pebot spec …`. A thin wrapper over
  [GitHub Spec Kit](https://github.com/github/spec-kit)'s `specify` CLI.
- **Project ops** — `pebot dev`, `pebot db …`, `pebot check`, `pebot doctor`.
  Wraps the npm scripts in `my-app/`, so you don't have to remember which one is
  called `test:unit` and which is `electron:build:win`.

Run `pebot --help` for the full list.

## Install

### 1. Spec Kit (once per machine)

```bash
uv tool install specify-cli --from git+https://github.com/github/spec-kit.git
```

Needs [uv](https://docs.astral.sh/uv/). Verify with `specify --version`.

### 2. `pebot` on your PATH (once per machine)

**Windows (PowerShell):** add a function to your profile so it works in every new
shell. Open the profile with `notepad $PROFILE` and add:

```powershell
function pebot { & "C:\path\to\Pebot\tools\pebot.ps1" @args }
```

Then `. $PROFILE` to load it now.

**macOS / Linux:**

```bash
ln -s "$PWD/tools/pebot" ~/.local/bin/pebot
```

Make sure `~/.local/bin` is on your `PATH`.

Either way, `pebot doctor` from anywhere is the check that it worked.

## Why it works in any directory

`pebot init` passes `--here` to `specify`, meaning "scaffold into the folder I am
standing in" — that's the whole trick; there is no global-vs-local mode to think
about. The ops commands go the other way: they walk *up* from the current
directory looking for `my-app/package.json` or `.specify/`, so `pebot check` works
from a subdirectory as well as from the repo root.

## What `pebot init` does

```bash
specify init --here --force --integration claude   # skills in .claude/skills/
specify integration install kilocode --force      # commands in .kilo/commands/
specify integration install opencode  --force
specify integration use claude                    # default integration
```

The `--force` on the extra integrations is required because opencode is not
declared multi-install safe by Spec Kit; Claude Code and Kilo Code are.

Run it again any time to refresh the generated adapter files after a Spec Kit
upgrade. It is safe to re-run: `.specify/memory/constitution.md` and `specs/` are
yours, not Spec Kit's, and are not overwritten.

## Naming

The CLI is `pebot`. The slash commands stay `/speckit-*` (Claude Code) and
`/speckit.*` (Kilo Code, opencode) because Spec Kit has no supported way to
rename its command prefix, and forking it to change cosmetics would mean owning
upstream merges forever. The project's identity lives in
`.specify/memory/constitution.md`, not in a command prefix.

## Not implemented yet

`pebot db backup` and `pebot db restore <file>` are specified in the constitution
(hardened restore: authenticated admin, checksum verification, pre-swap snapshot,
controlled restart) but the underlying scripts don't exist yet, so the CLI
deliberately doesn't offer them rather than shipping a command that half-works.
Today, backup/restore goes through the admin UI and `/api/restore`.
