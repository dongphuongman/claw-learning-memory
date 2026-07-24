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

### Bước 1 — Cài plugin

Chọn **một** trong hai cách:

**Cách 1: Cài từ ClawHub (khuyên dùng cho production)**

```bash
clawhub package install dongphuongman/claw-learning-memory
```

**Cách 2: Cài từ thư mục local (khuyên dùng khi dev/debug với Docker)**

```bash
openclaw plugins install -l ./claw-learning-memory
```

> Với Docker, mount thư mục plugin vào container trước, ví dụ:
> `volumes: ["./claw-learning-memory:/app/plugins/claw-learning-memory"]`,
> rồi chạy lệnh install bên trong container.

### Bước 2 — Bật plugin và chọn làm context engine

Mở file `openclaw.json` (trong thư mục cấu hình của agent) và thêm:

```json5
{
  "plugins": {
    "entries": {
      "learning-memory": { "enabled": true }
    }
  },
  "agents": {
    "defaults": {
      "plugins": {
        "slots": {
          "contextEngine": "learning-memory"
        }
      }
    }
  }
}
```

Restart gateway sau khi cấu hình xong.

## Config

Tất cả option cấu hình đặt trong `plugins.entries.learning-memory.config`.

Ví dụ đầy đủ:

```json5
{
  "plugins": {
    "entries": {
      "learning-memory": {
        "enabled": true,
        "config": {
          "charBudget": 6000,
          "files": ["MEMORY.md", "USER.md"],
          "recentDays": 2,
          "groupMemory": true,
          "groupBudgetRatio": 0.3
        }
      }
    }
  }
}
```

### Bảng tham chiếu config

| Field | Default | Ý nghĩa |
|---|---|---|
| `enabled` | `true` | Bật/tắt toàn bộ plugin. |
| `charBudget` | `6000` | Giới hạn ký tự memory inject mỗi lượt. Vượt quá thì cắt bớt. |
| `files` | `["MEMORY.md","USER.md"]` | Danh sách file memory chung, đọc theo thứ tự. |
| `memoryDir` | `"memory"` | Thư mục chứa nhật ký ngày (`memory/2026-07-24.md`). |
| `recentDays` | `2` | Số file nhật ký ngày gần nhất được inject (đặt `0` để tắt). |
| `header` | — | Tiêu đề tùy chỉnh phía trên khối memory (mặc định có sẵn). |
| `groupMemory` | `true` | Bật/tắt memory riêng theo group. |
| `groupMemoryPattern` | `"memory/group-{groupId}.md"` | Mẫu đường dẫn file group. `{groupId}` sẽ được thay bằng ID thật. |
| `groupBudgetRatio` | `0.3` | Tỉ lệ tối đa của `charBudget` dành cho group (0–1). Phần dư sẽ chuyển cho memory chung. |

## Per-group memory

### Vấn đề

Khi bot chạy trong nhiều group Zalo/Telegram, mỗi group có nội quy và ngữ cảnh khác
nhau. Nếu gộp hết vào `MEMORY.md` chung thì vừa lẫn lộn, vừa đốt hết ngân sách ký tự.

### Giải pháp

Plugin tự phát hiện group session và đọc thêm file memory riêng cho group đó.
Memory chung (`MEMORY.md`, `USER.md`) vẫn được inject — file group chỉ **bổ sung thêm**.

### Cách dùng

**1. Tìm group ID:**

Group ID nằm trong session key của OpenClaw. Tra trong database:

```bash
sqlite3 ~/.openclaw/agents/main/agent/openclaw-agent.sqlite \
  "SELECT session_key FROM session_nodes WHERE session_key LIKE '%group%';"
```

Kết quả ví dụ: `agent:main:zalo:group:zgr-a72838409c15754b2c04`
→ Group ID là phần sau `:group:` = `zgr-a72838409c15754b2c04`

**2. Tạo file memory cho group đó:**

```
memory/group-zgr-a72838409c15754b2c04.md
```

Nội dung ví dụ:

```markdown
- Nhóm này nói tiếng Việt
- Nội quy: không spam, trả lời ngắn gọn
- Dự án chính: Thiên Ba Phủ
```

**3. Xong.** Lần chạy tiếp theo trong group đó, bot sẽ tự đọc file này.

### Cách chia ngân sách ký tự

- Group memory được dùng tối đa **30%** của `charBudget` (mặc định 1800/6000 ký tự).
- Memory chung dùng **70%** còn lại.
- Nếu một bên dùng ít hơn phần của mình, phần dư **tự động chuyển** cho bên kia.
- Không có file group → memory chung dùng hết 100% (hoạt động y hệt bản gốc).

Muốn đổi tỉ lệ: chỉnh `groupBudgetRatio` trong config (ví dụ `0.5` = chia đều 50/50).

Muốn tắt hẳn: đặt `"groupMemory": false`.

## How the agent keeps memory good

Plugin chỉ **đọc** memory; agent phải tự **viết và chắt lọc** nó. Kết hợp với
instruction dặn agent ghi các sự kiện, quy tắc quan trọng vào `MEMORY.md` (dạng
bullet points ngắn gọn) và giữ file gọn. Vì file được inject mỗi lượt, những gì
agent viết sẽ thực sự quay lại — memory tích lũy thay vì bay hơi.

## License

MIT © dongphuongman
