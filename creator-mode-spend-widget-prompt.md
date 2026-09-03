# Creator-mode prompt: persistent AI-spend widget for this harness

How to use: in the harness GUI, start (or switch) a session to **Creator mode** (the
cordis agent preset), paste everything between the `---` markers as one message, and let
the agent run. It should inspect first, ask you one rate question, then build.

---

You are operating in Creator mode of this DeepSeek Harness (the `cordis` agent preset).
Mission: build a **persistent spend widget** for the web GUI at http://127.0.0.1:3080 so
the owner sees, at a glance, how much the AI session currently in front of them is
spending — in dollars, not just tokens — no matter which workspace or session they are in.

Ground rules:

1. Load the skills `cordis-plugin-development` and `editing-cordis-compositions` first
   and follow them.
2. Do not trust this prompt as API truth. Verify everything through
   `cordis_inspect_list` / `cordis_inspect_query` before writing code (Services, Events,
   Builtins, Slots, Theme). Query `Service.listService` and `Event.listEvents` without
   input to find exact keys, then query the exact service/event you will use.
3. Money honesty: this harness records **token counts only**. There is no per-text-token
   dollar price anywhere (only image-request pricing exists), and provider usage carries
   no cost field. Compute dollars as `tokens × owner-supplied rates`. Never invent a
   rate. Never present a partial or guessed figure as a complete bill — fail closed:
   when no reliable figure exists, show nothing or a clear "no rate configured" state,
   never a fabricated number.

What already exists (verify, don't trust the paths blindly):

- A session-level `tokenUsage` projection is available on the client. Reference
  `packages/client/ui-chat/src/client/chat/StatsLine.tsx`, which is mounted on the
  `conversation.composer.dock` slot and reads it via `useProjection('tokenUsage')`.
  Buckets are DISJOINT: billed input = `uncachedInputTokens + cacheReadTokens +
  cacheWriteTokens`; `outputTokens` billed separately; `reasoningTokens` is a subset of
  output — never double-count it.
- A per-turn usage dialog exists (`TurnUsagePanel.tsx`) and already shows the per-turn
  provider/model route, so per-turn dollars can be exact per model.
- The Host exposes a `tokenMeter` service and an `llm` service
  (`imageRequestPricing` exists; text pricing does not).

Build (smallest correct first, then make it durable):

1. Price configuration the owner can edit: a settings namespace (via the `settings`
   service) or one small config file holding, per provider/model: input, cache-read,
   cache-write (if billed), and output — USD per 1M tokens. Discover which models the
   owner's sessions actually call (`llm.listProviders`, model resolution, per-turn
   routes). If the owner does not know exact rates, ask them once — do not assume
   published DeepSeek rates without confirmation. If the owner pays flat monthly with no
   per-token rate, show tokens only and label cost as not applicable.
2. The widget: session spend rendered next to the existing token stats in the same
   `conversation.composer.dock` area, fed by the same `tokenUsage` projection (so paging
   and compaction cannot corrupt it), plus per-turn spend inside the existing per-turn
   dialog wherever a route and rate are both known. Label estimates "est." unless the
   provider reports an exact cost.
3. Persistence — the owner wants this visible "wherever they are", across sessions. A
   session-scoped dynamic plugin dies with the process. So: prove it as a dynamic
   plugin first, then make it durable by registering the client half in the host
   composition (`cordis.yml`) or as a proper package under the harness checkout, and
   rebuild the web artifacts. Verify the existing URL after a page refresh. Only if a
   `dev:web` watcher is confirmed running can you promise automatic updates; otherwise
   say a rebuild + refresh is required.
4. Do not touch the owner's POS repository (Pebot / CaféOS) for this task. The widget
   lives in the harness.

Finish only when: a page refresh shows the widget across sessions; its numbers match the
`tokenUsage` projection; unconfigured rates render an honest empty state; and you can
show the owner exactly where to edit the rates.

---
