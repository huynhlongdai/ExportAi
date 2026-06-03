# ExportAI

Chrome extension giúp export hội thoại từ ChatGPT, Grok, Gemini, Perplexity, Claude, Copilot, Devin và Lovable sang:

- Markdown (`.md`)
- JSON (`.json`)
- PDF qua giao diện in của trình duyệt
- Ảnh PNG (`.png`)
- Plain text (`.txt`)
- CSV / TSV (`.csv`, `.tsv`)
- JSONL (`.jsonl`)
- HTML (`.html`)
- Word-compatible document (`.doc`)

## Cài đặt khi phát triển

1. Mở `chrome://extensions`.
2. Bật `Developer mode`.
3. Chọn `Load unpacked`.
4. Trỏ tới thư mục `/Users/longx/ExportAI`.

## Cách dùng

1. Mở một hội thoại trên ChatGPT, Grok, Gemini, Perplexity, Claude, Copilot, Devin hoặc Lovable.
2. Dùng icon nổi ExportAI trên trang chat hoặc bấm icon ExportAI trên thanh extension.
3. Chọn định dạng muốn export.
4. Mở `Manager` để xem task, retry hoặc xóa lịch sử export.

## Ghi chú kỹ thuật

- Extension dùng Manifest V3.
- Manager có thể mở bằng Chrome side panel, fallback về `manager.html` tab nếu side panel không mở được.
- Content script nhận diện nền tảng theo hostname và selector hiện có của từng trang.
- Mọi export đi qua task queue trong background service worker.
- Gói Free mặc định có quota 10 exports/ngày, 50 exports/tháng và chữ ký ExportAI Free.
- PDF được tạo bằng trang in sạch, sau đó Chrome mở hộp thoại `Save as PDF`.
- PNG được render từ transcript text lên canvas để tránh phụ thuộc thư viện ngoài.
- Nếu selector hỏng, extension có raw text fallback và lưu diagnostic local để gửi lên repair server khi user đồng ý.

## Server MVP

Chạy local server cho license, remote adapter registry, diagnostics và AI repair proposal:

```bash
npm run server
```

Server mặc định chạy tại `http://127.0.0.1:8787`.

- License dev: `free-local-dev`.
- Admin token dev: `dev-admin-token`.
- Validate license trong Manager > Settings bằng cách nhập server URL và license key.
- Diagnostics có thể upload/request repair từ Manager > Diagnostics.
- Remote adapter có thể fetch từ Manager > Adapters.

## Kiểm tra

```bash
npm run check
npm run test:adapters
npm run test:server
```

Build manifest cho bản quảng bá riêng:

```bash
npm run build:chatgpt
npm run build:grok
npm run build:gemini
npm run build:perplexity
npm run build:claude
npm run build:copilot
npm run build:devin
npm run build:lovable
```

## Product spec và plan

- [Overview](docs/00-overview.md)
- [UI/UX Spec](docs/01-ui-ux-spec.md)
- [Technical Architecture](docs/02-technical-architecture.md)
- [Monetization and Quota](docs/03-monetization-quota-spec.md)
- [AI Repair System](docs/04-ai-repair-spec.md)
- [Implementation Plan](docs/05-implementation-plan.md)
- [Backlog](docs/06-backlog.md)
- [Platform Build Strategy](docs/07-platform-build-strategy.md)
- [Current Implementation Notes](docs/08-current-implementation.md)
- [Export Formats Research](docs/09-export-formats-research.md)
- [Competitive Research and UI/Server Modernization Plan](docs/10-competitive-research-ui-server-plan.md)
- [Chrome Web Store Asset Checklist](docs/11-chrome-web-store-assets.md)

## Landing page

Open `landing.html` locally for the first marketing page and screenshot planning.
