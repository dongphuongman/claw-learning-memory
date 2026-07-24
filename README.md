# Claw-learning-memory

**Always-on memory** for OpenClaw agents.

A [context engine](https://docs.openclaw.ai/concepts/context-engine) that injects a
curated **`MEMORY.md` + `USER.md`** block into **every agent turn — including group and
channel sessions**, which OpenClaw's default memory recall excludes. This is why bots in
Zalo/Telegram groups "forget" context and rules over time; this plugin fixes that by
loading your curated memory on every run (an always-on prompt-memory layer).

## What it does

- **Always-on**: reads the agent's curated memory files and prepends them to the system
  prompt on **every** run (all sessions, groups included) via `systemPromptAddition`.
- **Per-group memory**: in group sessions, loads `memory/group-<groupId>.md` so each
  group has its own rules and context. Budget is split with a configurable ratio (default
  30% for group, 70% for shared).
- **Curated, not bloated**: a tight character budget (default 6000) forces the agent to
  curate — a small sharp memory beats a huge one. Overflow is trimmed, not accumulated.
- **Safe & thin**: it does **not** reinvent history storage or compaction. History is
  passed through untouched and compaction stays with the runtime (`ownsCompaction:false`).
  Any read hiccup degrades to "no injection" for that turn; a hard error quarantines the
  engine and the host falls back to the legacy engine — it can't brick an agent.

It does **not** need a remote memory database. Your memory lives in local workspace files
that the agent already writes (`MEMORY.md`, `USER.md`).

## Install

```
clawhub package install dongphuongman/claw-learning-memory
```

Or from a local path (useful for Docker dev with `--link`):

```
openclaw plugins install -l ./claw-learning-memory
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
| `charBudget` | `6000` | Max characters of memory injected per turn (older/overflow trimmed). |
| `files` | `["MEMORY.md","USER.md"]` | Workspace files injected every turn, in order. |
| `memoryDir` | `"memory"` | Directory holding daily logs (`YYYY-MM-DD.md`). |
| `recentDays` | `2` | How many recent daily logs to inject (0 to disable). |
| `header` | — | Optional heading above the injected block. |
| `groupMemory` | `true` | Enable per-group memory (reads `memory/group-<groupId>.md` in group sessions). |
| `groupMemoryPattern` | `"memory/group-{groupId}.md"` | Path template for group memory files. `{groupId}` is replaced at runtime. |
| `groupBudgetRatio` | `0.3` | Max fraction of `charBudget` for group memory (0–1). Unused space transfers to shared memory. |

## Per-group memory

When the bot runs in a group session (e.g. a Zalo group), the plugin automatically
loads `memory/group-<groupId>.md` alongside the shared memory files. Each group gets
its own rules and context without polluting other groups.

Create a file for each group:

```
memory/group-zgr-a72838409c15754b2c04.md
```

```markdown
- Nhóm này nói tiếng Việt
- Nội quy: không spam, trả lời ngắn gọn
- Dự án chính: Thiên Ba Phủ
```

The group ID comes from the session key (visible in OpenClaw's session database).
Budget is split: group gets up to 30% of `charBudget` by default; if either side
uses less, the unused space goes to the other.

To disable: set `groupMemory: false` in config.

## How the agent keeps memory good

The engine only *loads* memory; the agent *curates* it. Pair this with an agent
instruction to proactively write durable facts and rules into `MEMORY.md` (short,
distilled bullet points) and keep it tight. Because the file is now injected every turn,
what the agent writes actually comes back — so it compounds instead of evaporating.

## License

MIT © dongphuongman
