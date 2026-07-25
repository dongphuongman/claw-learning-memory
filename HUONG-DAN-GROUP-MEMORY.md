# Hướng dẫn sử dụng Group Memory

## Group Memory là gì?

Mỗi group Zalo/Telegram có thể có **file memory riêng**. Khi bot chạy trong group đó, nó sẽ tự đọc file này và tuân theo nội dung bên trong — nội quy, ngữ cảnh, quy tắc riêng cho từng nhóm.

Memory chung (`MEMORY.md`, `USER.md`) vẫn được inject song song — file group chỉ **bổ sung thêm**.

## Cấu trúc thư mục

```
~/.openclaw/workspace/
├── MEMORY.md                              ← memory chung (mọi group đều đọc)
├── USER.md                                ← thông tin user chung
└── memory/
    ├── group-zgr-a72838409c15754b2c04.md  ← memory riêng group A
    ├── group-zgr-f9245df9e39d0ac3538c.md  ← memory riêng group B
    └── 2026-07-25.md                      ← nhật ký ngày (tự động)
```

## Các bước tạo group memory

### Bước 1: Tìm Group ID

Mỗi group có một ID duy nhất trong OpenClaw. Tra bằng lệnh:

```bash
sqlite3 ~/.openclaw/agents/main/agent/openclaw-agent.sqlite \
  "SELECT session_key FROM session_nodes WHERE session_key LIKE '%group%';"
```

Kết quả ví dụ:

```
agent:main:zalo:group:zgr-a72838409c15754b2c04
agent:main:zalo:group:zgr-f9245df9e39d0ac3538c
agent:main:telegram:group:-1001234567890
```

Group ID là phần **sau `:group:`**:
- `zgr-a72838409c15754b2c04` (Zalo)
- `-1001234567890` (Telegram)

### Bước 2: Tạo file memory

Tạo file theo mẫu `memory/group-<groupId>.md` trong thư mục workspace:

```bash
nano ~/.openclaw/workspace/memory/group-zgr-a72838409c15754b2c04.md
```

### Bước 3: Viết nội dung

Viết dạng bullet points ngắn gọn. Ví dụ:

```markdown
- Đây là nhóm dự án Thiên Ba Phủ
- Nội quy: trả lời ngắn gọn, tối đa 3 câu
- Ngôn ngữ: tiếng Việt
- Khi được hỏi "plugin hoạt động chưa", trả lời "Learning-memory đang chạy! Tôi đọc được memory riêng của group này."
- Thành viên chính: Đông (PM), Minh (dev), Hùng (QA)
- Stack: React + Node.js + PostgreSQL
```

### Bước 4: Xong

Không cần restart gateway. Plugin tự đọc file mỗi lượt chạy.

## Ví dụ thực tế

### Nhóm gia đình

```markdown
- Nhóm gia đình, gọi mọi người bằng tên thân mật
- Không dùng thuật ngữ kỹ thuật
- Nhắc sinh nhật: Bố 15/03, Mẹ 22/08, Em Linh 05/11
```

### Nhóm dự án công ty

```markdown
- Dự án: hệ thống quản lý kho cho FPT
- Sprint hiện tại: sprint 12, deadline 01/08
- Ưu tiên: tối ưu performance API, target < 200ms
- Convention: dùng TypeScript strict mode, không any
```

### Nhóm trading

```markdown
- Nhóm phân tích kỹ thuật chứng khoán
- Khi phân tích cổ phiếu, luôn kèm MA20, RSI, MACD
- Khung thời gian chính: daily và weekly
- Cảnh báo khi RSI > 70 hoặc < 30
```

## Ngân sách ký tự

- Tổng budget mặc định: **6000 ký tự**
- Group memory tối đa: **30%** (1800 ký tự)
- Memory chung: **70%** (4200 ký tự)
- Nếu một bên dùng ít, phần dư **tự động chuyển** cho bên kia
- Không có file group → memory chung dùng hết 100%

Thay đổi tỉ lệ trong `openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "learning-memory": {
        "config": {
          "groupBudgetRatio": 0.5
        }
      }
    }
  }
}
```

## Mẹo viết memory hiệu quả

1. **Ngắn gọn**: bullet points, không viết văn dài
2. **Cụ thể**: "trả lời tối đa 3 câu" tốt hơn "trả lời ngắn"
3. **Hành động được**: viết thứ bot CÓ THỂ làm theo, không viết triết lý chung chung
4. **Cập nhật thường xuyên**: xoá rule cũ không còn đúng, thêm rule mới khi cần
5. **Giữ dưới 1500 ký tự**: vừa đủ để bot nhớ hết, không bị cắt bớt

## Xoá / tắt group memory

- **Xoá memory 1 group**: xoá file `memory/group-<groupId>.md`
- **Tắt toàn bộ group memory**: đặt `"groupMemory": false` trong config
- **Đổi đường dẫn file**: đổi `groupMemoryPattern` (mặc định: `"memory/group-{groupId}.md"`)
