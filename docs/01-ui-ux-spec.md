# UI/UX Spec

## Tong quan

ExportAI co 3 lop UI:

1. Floating button va floating modal tren trang chat.
2. Extension popup tren toolbar.
3. Export manager dang side panel hoac tab rieng.

Muc tieu UX: nguoi dung dang chat co the export trong 1-2 click, nhung van co noi quan ly task, history, quota, preset, va billing.

## Floating Button

### Vi tri

- Mac dinh nam ben phai man hinh, gan khu vuc chat nhung khong che input.
- Co the keo tha.
- Luu vi tri theo hostname bang `chrome.storage.local`.
- Neu viewport nho, hien dang compact icon.

### Trang thai

- Idle: icon ExportAI nho.
- Hover: tooltip "Export conversation".
- Active: modal dang mo.
- Running: co progress ring hoac dot animation.
- Success: check nho trong thoi gian ngan.
- Failed: dot do, click de xem loi.
- Hidden: user co the an tren site hien tai.

### Hanh vi

- Click icon mo floating modal.
- Keo tha thay doi vi tri.
- Double click co the thuc hien quick export preset gan nhat.
- Right click/context menu trong tuong lai: Quick Markdown, Quick JSON, Hide.

## Floating Modal

### Muc tieu

Modal phuc vu export nhanh va tao task. No khong thay the manager.

### Layout mac dinh

```text
+------------------------------+
| ExportAI              _  x   |
| ChatGPT - Current chat        |
+------------------------------+
| Title                         |
| "Build Chrome extension..."   |
| 24 messages - captured now    |
+------------------------------+
| Formats                       |
| [MD] [JSON] [PDF] [PNG]       |
+------------------------------+
| Preset                        |
| [AI archive        v]         |
+------------------------------+
| Options                       |
| [x] Metadata                  |
| [x] Code blocks               |
| [ ] Include screenshots       |
| [x] ExportAI signature Locked |
+------------------------------+
| Free plan: 7/10 today         |
| [Export now] [Create task]    |
|              [Manager]        |
+------------------------------+
```

### Actions

- Export now: tao task va chay ngay.
- Create task: tao task queued/deferred.
- Manager: mo side panel hoac manager page.
- Minimize: thu ve floating button.
- Close: dong modal, giu floating button.
- Hide on this site: an floating UI cho hostname hien tai.

### Trang thai running

```text
Exporting...

[x] Capture conversation
[x] Normalize messages
[ ] Render Markdown
[ ] Download file

Progress 72%
[Run in background]
```

### Trang thai success

```text
Export completed
Markdown downloaded

[Export another] [Manager]
```

### Trang thai failed

```text
Export failed
ChatGPT layout may have changed.

[Try auto repair] [Use fallback] [Send debug report]
```

## Extension Popup

Popup la launcher gon, khong phai manager day du.

### Khi dang o trang duoc ho tro

```text
ExportAI

Current page
ChatGPT conversation detected

Free plan: 7/10 exports left

[Quick export]
[Open floating tool]
[Open manager]
```

### Khi khong o trang duoc ho tro

```text
ExportAI

No supported AI chat found.
Supported: ChatGPT, Grok, Gemini

[Open manager]
[Settings]
```

## Export Manager

Manager nen la side panel truoc, tab rieng sau neu can khong gian lon hon.

### Tabs

- Tasks
- History
- Presets
- Rules
- Plan
- Settings

### Tasks tab

Chuc nang:

- Xem queued/running/completed/failed.
- Retry task loi.
- Cancel task queued/running.
- Delete task.
- Re-export.
- Open source conversation.
- Open downloaded file neu browser cho phep.

### History tab

Filter:

- Platform
- Format
- Date
- Status
- Tags

Item:

```text
Build extension export workflow
ChatGPT - MD, JSON - Today 22:40
[Download again] [Re-export] [Details]
```

### Presets tab

Preset mac dinh:

- AI Archive: Markdown + JSON + metadata.
- Human Report: PDF + clean formatting.
- Dataset: JSON/JSONL only.
- Visual Snapshot: PNG/PDF.
- Full Backup: MD + JSON + PDF.

### Rules tab

Rule automation mau:

```text
When platform is ChatGPT
Export Markdown + JSON
After conversation changes
Save as task, do not auto-download
```

### Plan tab

Hien:

- Current plan.
- Quota hom nay/thang nay.
- Tinh nang bi khoa.
- Upgrade button.
- License status.

## Visual Direction

- Productivity tool, gon, ro, it trang tri.
- Border radius khoang 8px.
- Font system.
- Accent mau teal/green.
- Icon buttons cho dinh dang va action.
- Checkbox cho option nhi phan.
- Dropdown cho preset.
- Progress state ro rang.
- Khong de UI che input chat.

