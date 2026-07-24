# Changelog

Định dạng theo [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

## [0.1.0] — 2026-07-24

### Thêm mới
- Phiên bản đầu: **context engine `learning-memory`** — inject `MEMORY.md` + `USER.md`
  đã chắt lọc vào **mọi lượt** của agent (kể cả session nhóm/kênh, vốn bị memory recall
  mặc định của OpenClaw loại trừ). Giải quyết việc bot nhóm "quên" ngữ cảnh/quy tắc.
- Budget ký tự (mặc định 3500) ép chắt lọc; tràn thì cắt.
- Engine mỏng & an toàn: passthrough history, `ownsCompaction:false` (ủy quyền runtime
  nén), lỗi đọc → không inject lượt đó; lỗi nặng → host fallback legacy.
- Không cần DB remote — dùng file workspace local.
