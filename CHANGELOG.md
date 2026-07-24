# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.2.0] — 2026-07-24

### Thêm mới
- **Memory riêng theo từng group.** Khi chạy trong group session (Zalo, Telegram, …),
  plugin tự đọc `memory/group-<groupId>.md` và inject cùng memory chung. Mỗi nhóm có
  ngữ cảnh/nội quy riêng, không lẫn nhau. Config: `groupMemory` (bật/tắt),
  `groupMemoryPattern` (mẫu đường dẫn), `groupBudgetRatio` (tỉ lệ budget, mặc định 0.3).
- **Chia ngân sách ký tự (budget split).** Group memory dùng tối đa `groupBudgetRatio`
  × `charBudget`; phần dư chuyển cho shared memory và ngược lại. Tổng không vượt
  `charBudget`.

### Sửa lỗi
- **Daily log filter siết lại:** chỉ đọc file tên đúng dạng `YYYY-MM-DD.md` trong thư
  mục memory, tránh nhầm file group hay file khác thành nhật ký ngày.

### Fork
- Đổi tên package thành `@dongphuongman/openclaw-learning-memory`.
- Giữ nguyên plugin id `learning-memory` để tương thích.

## [0.1.1] — 2026-07-24

### Sửa lỗi
- **Nạp thêm nhật ký ngày (`memory/YYYY-MM-DD.md`), không chỉ `MEMORY.md`.** Agent ghi
  điều mới ("nhớ giúp X") vào nhật ký ngày theo thời gian thực; `MEMORY.md` chỉ được
  cron *dreaming* của OpenClaw hợp nhất định kỳ (có độ trễ). Trước đây plugin chỉ đọc
  `MEMORY.md` + `USER.md` nên vừa dặn xong mà hỏi ở nhóm/phiên khác thì bot chưa nhớ.
  Nay inject thêm các nhật ký ngày gần nhất (mặc định 2 ngày, giữ phần đuôi = entry mới
  nhất) → "nhớ giúp X" có hiệu lực ngay lập tức. Config mới: `memoryDir`, `recentDays`;
  `charBudget` mặc định nâng 3500 → 6000.


## [0.1.0] — 2026-07-24

### Thêm mới
- Phiên bản đầu: **context engine `learning-memory`** — inject `MEMORY.md` + `USER.md`
  đã chắt lọc vào **mọi lượt** của agent (kể cả session nhóm/kênh, vốn bị memory recall
  mặc định của OpenClaw loại trừ). Giải quyết việc bot nhóm "quên" ngữ cảnh/quy tắc.
- Budget ký tự (mặc định 3500) ép chắt lọc; tràn thì cắt.
- Engine mỏng & an toàn: passthrough history, `ownsCompaction:false` (ủy quyền runtime
  nén), lỗi đọc → không inject lượt đó; lỗi nặng → host fallback legacy.
- Không cần DB remote — dùng file workspace local.
