---
name: "speck-plan"
description: "Run the spec-kit implementation planning workflow (alias for /speckit-plan). Use when the user invokes speck-plan or asks to plan a feature spec."
user-invocable: true
disable-model-invocation: false
metadata:
  alias-of: "speckit-plan"
---

## User Input

```text
$ARGUMENTS
```

The user invoked this alias for the **speckit-plan** workflow. Run it exactly as
`speckit-plan` would: read the current feature spec and
`.specify/memory/constitution.md`, execute the plan workflow from
`.specify/templates/plan-template.md` (setup via
`.specify/scripts/bash/setup-plan.sh --json` when bash is available; otherwise
replicate the script's output by hand), and generate the design artifacts
(research.md, data-model.md, contracts/, quickstart.md) inside the active
`specs/NNN-slug/` directory. Apply the same gate checks and completion report
rules as the canonical skill.
