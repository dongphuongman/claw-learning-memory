# Claw-learning-memory

**Memory luôn bật** cho OpenClaw agent.

Một [context engine](https://docs.openclaw.ai/concepts/context-engine) inject nội dung
**`MEMORY.md` + `USER.md`** đã chắt lọc vào **mọi lượt chạy của agent — kể cả trong
group và channel**, vốn bị cơ chế memory recall mặc định của OpenClaw bỏ qua. Đây là
lý do bot trong các nhóm Zalo/Telegram hay "quên" ngữ cảnh và quy tắc; plugin này khắc
phục bằng cách nạp memory mỗi lượt chạy (lớp prompt-memory luôn bật).

## Plugin làm gì

- **Luôn bật**: đọc các file memory của agent và chèn vào system prompt **mỗi lượt**
  chạy (mọi session, kể cả group) qua `systemPromptAddition`.
- **Memory riêng theo group**: trong group session, tự đọc thêm
  `memory/group-<groupId>.md` để mỗi nhóm có nội quy và ngữ cảnh riêng. Ngân sách ký tự
  được chia theo tỉ lệ cấu hình (mặc định 30% cho group, 70% cho phần chung).
- **Chắt lọc, không phình**: giới hạn ký tự chặt (mặc định 6000) ép agent phải chắt
  lọc — memory nhỏ mà sắc bén tốt hơn memory khổng lồ. Vượt ngưỡng thì cắt bớt.
- **An toàn & mỏng**: plugin **không** tự quản lý lịch sử hội thoại hay nén context.
  Lịch sử được truyền thẳng qua, việc nén do runtime lo (`ownsCompaction:false`).
  Lỗi đọc file → bỏ qua lượt đó; lỗi nặng → OpenClaw cách ly engine và dùng engine
  dự phòng — bot không bao giờ bị chết.

Plugin **không** cần database từ xa. Memory nằm trong file workspace local mà agent
tự viết (`MEMORY.md`, `USER.md`).

## Cài đặt

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

## Cấu hình

Tất cả option đặt trong `plugins.entries.learning-memory.config`.

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

### Bảng tham chiếu

| Trường | Mặc định | Ý nghĩa |
|---|---|---|
| `enabled` | `true` | Bật/tắt toàn bộ plugin. |
| `charBudget` | `6000` | Giới hạn ký tự memory inject mỗi lượt. Vượt quá thì cắt bớt. |
| `files` | `["MEMORY.md","USER.md"]` | Danh sách file memory chung, đọc theo thứ tự. |
| `memoryDir` | `"memory"` | Thư mục chứa nhật ký ngày (`memory/2026-07-24.md`). |
| `recentDays` | `2` | Số file nhật ký ngày gần nhất được inject (đặt `0` để tắt). |
| `header` | — | Tiêu đề tùy chỉnh phía trên khối memory (mặc định có sẵn). |
| `groupMemory` | `true` | Bật/tắt memory riêng theo group. |
| `groupMemoryPattern` | `"memory/group-{groupId}.md"` | Mẫu đường dẫn file group. `{groupId}` được thay bằng ID thật. |
| `groupBudgetRatio` | `0.3` | Tỉ lệ tối đa của `charBudget` dành cho group (0–1). Phần dư chuyển cho memory chung. |

## Memory riêng theo group

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

## Agent giữ memory tốt bằng cách nào

Plugin chỉ **đọc** memory; agent phải tự **viết và chắt lọc** nó. Kết hợp với
instruction dặn agent ghi các sự kiện, quy tắc quan trọng vào `MEMORY.md` (dạng
bullet points ngắn gọn) và giữ file gọn. Vì file được inject mỗi lượt, những gì
agent viết sẽ thực sự quay lại — memory tích lũy thay vì bay hơi.

## Giấy phép

MIT © dongphuongman
