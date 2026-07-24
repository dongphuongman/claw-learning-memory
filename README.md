# @dongphuongman/openclaw-learning-memory

> **Fork** of [tuanminhhole/openclaw-learning-memory](https://github.com/tuanminhhole/openclaw-learning-memory).
> Forked to add per-group memory and maintain long-term.

## Changes from upstream

- Renamed package to `@dongphuongman/openclaw-learning-memory`
- *(more changes will be listed here as they land)*

## TODO

- [ ] Rename plugin id from `learning-memory` to a custom id — requires
  matching changes in `openclaw.json` (`plugins.entries`, `agents.*.plugins.slots`),
  deferred to avoid breakage.

---

**Always-on memory** for OpenClaw agents.

A [context engine](https://docs.openclaw.ai/concepts/context-engine) that injects a
curated **`MEMORY.md` + `USER.md`** block into **every agent turn — including group and
channel sessions**, which OpenClaw's default memory recall excludes. This is why bots in
Zalo/Telegram groups "forget" context and rules over time; this plugin fixes that by
loading your curated memory on every run (an always-on prompt-memory layer).

## What it does

- **Always-on**: reads the agent's curated memory files and prepends them to the system
  prompt on **every** run (all sessions, groups included) via `systemPromptAddition`.
- **Curated, not bloated**: a tight character budget (default 3500) forces the agent to
  curate — a small sharp memory beats a huge one. Overflow is trimmed, not accumulated.
- **Safe & thin**: it does **not** reinvent history storage or compaction. History is
  passed through untouched and compaction stays with the runtime (`ownsCompaction:false`).
  Any read hiccup degrades to "no injection" for that turn; a hard error quarantines the
  engine and the host falls back to the legacy engine — it can't brick an agent.

It does **not** need a remote memory database. Your memory lives in local workspace files
that the agent already writes (`MEMORY.md`, `USER.md`).

## Install

```
clawhub package install tuanminhhole/openclaw-learning-memory
```

Then select it as the agent's context engine in `openclaw.json`:

```json5
{
  "plugins": { "entries": { "learning-memory": { "enabled": true } } },
  "agents": {
    "defaults": {
      "plugins": { "slots": { "contextEngine": "learning-memory" } }
    }
  }
}
```

## Config

Under `plugins.entries.learning-memory.config`:

| Field | Default | Meaning |
|---|---|---|
| `enabled` | `true` | Toggle the injection. |
| `charBudget` | `3500` | Max characters of memory injected per turn (older/overflow trimmed). |
| `files` | `["MEMORY.md","USER.md"]` | Workspace files injected every turn, in order. |
| `header` | — | Optional heading above the injected block. |

## How the agent keeps memory good

The engine only *loads* memory; the agent *curates* it. Pair this with an agent
instruction to proactively write durable facts and rules into `MEMORY.md` (short,
distilled bullet points) and keep it tight. Because the file is now injected every turn,
what the agent writes actually comes back — so it compounds instead of evaporating.

## License

MIT © dongphuongman
