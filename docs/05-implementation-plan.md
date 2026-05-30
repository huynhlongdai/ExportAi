# Implementation Plan

## Trang thai hien tai

Da co MVP rat som:

- Manifest V3.
- Popup chon format.
- Content script extract co ban.
- Export Markdown, JSON, PDF print, PNG canvas.
- Background download service.

MVP hien tai chua co:

- Floating UI.
- Task queue.
- Manager.
- Quota/signature policy day du.
- Adapter registry.
- AI repair.
- Backend.

## Phase 1 - Local Task Queue and Signature

Muc tieu: moi export deu chay qua task queue, co quota Free va chu ky.

Tasks:

1. Them storage permission.
2. Tao `src/lib/taskStore.js`.
3. Tao `src/lib/quotaService.js`.
4. Tao `src/lib/signatureService.js`.
5. Tao `src/lib/exportRunner.js`.
6. Refactor popup de tao task thay vi export truc tiep.
7. Background xu ly task queued/running/success/failed.
8. Them signature vao Markdown, JSON, PDF, PNG.
9. Gioi han Free: 10 exports/day, 50 exports/month.
10. Hien quota trong popup.

Acceptance criteria:

- Export tao task record.
- Task cap nhat status/progress.
- Free export co chu ky.
- Het quota thi UI chan export va hien upgrade CTA.
- Markdown/JSON/PDF/PNG van export duoc.

## Phase 2 - Floating UI

Muc tieu: user export truc tiep tren trang chat qua floating button/modal.

Tasks:

1. Inject floating button trong content script.
2. Them drag position va save per host.
3. Tao floating modal compact.
4. Modal doc current conversation summary.
5. Chon formats, preset, metadata.
6. Export now tao task va chay ngay.
7. Create task tao task queued.
8. Minimize/close/hide on site.
9. Running/success/error states.

Acceptance criteria:

- Floating icon hien tren ChatGPT/Grok/Gemini.
- Khong che input chat o desktop/mobile co ban.
- Click icon mo modal.
- Export tu modal hoat dong.
- Vi tri icon duoc luu.

## Phase 3 - Export Manager

Muc tieu: quan ly task va lich su export.

Tasks:

1. Tao `manager.html` hoac `sidepanel.html`.
2. Them sidePanel permission neu dung side panel.
3. Tao Tasks tab.
4. Tao History tab.
5. Them Retry/Cancel/Delete/Re-export.
6. Them filter theo platform/status/format/date.
7. Popup co nut Open Manager.
8. Floating modal co nut Manager.

Acceptance criteria:

- Xem duoc queued/running/success/failed tasks.
- Retry task failed.
- Re-export tu captured conversation neu co archive.
- Delete task khong lam hong storage.

## Phase 4 - Presets and Archive

Muc tieu: export co preset va luu transcript de re-export.

Tasks:

1. Tao preset schema va presetStore.
2. Them preset mac dinh: AI Archive, Human Report, Dataset, Visual Snapshot, Full Backup.
3. Them preset selector trong popup/modal.
4. Luu normalized conversation vao IndexedDB.
5. Re-export tu archive.
6. Them filename pattern.
7. Them template options cho Markdown/PDF.

Acceptance criteria:

- Chon preset thay doi formats/options.
- Re-export khong can mo lai trang goc neu da archive.
- Filename pattern ap dung dung.

## Phase 5 - Adapter Registry Local

Muc tieu: tach adapter logic khoi content script nguyen khoi.

Tasks:

1. Tao folder `src/adapters`.
2. Tao common adapter runtime.
3. Tao adapter ChatGPT/Grok/Gemini rieng.
4. Tao adapter config schema.
5. Them fallback strategies.
6. Them adapter version vao task/diagnostic.
7. Tao fixtures local cho moi platform.
8. Tao test runner local cho adapters.

Acceptance criteria:

- Moi platform co adapter rieng.
- Co fixture test cho extraction.
- Failures co error type ro rang.

## Phase 6 - AI Repair Server MVP

Muc tieu: co server nhan diagnostic va tra adapter config moi.

Tasks:

1. Tao backend service.
2. Tao endpoint `GET /adapters/:platform/latest`.
3. Tao endpoint `POST /diagnostics`.
4. Tao storage adapter configs.
5. Extension fetch latest adapter config.
6. Export fail thi prompt user send diagnostic.
7. Server luu diagnostic.
8. Manual admin update adapter config.

Acceptance criteria:

- Extension update adapter config tu server.
- Export fail tao diagnostic package.
- User co consent truoc khi gui report.
- Co rollback adapter config.

## Phase 7 - AI Repair Agent

Muc tieu: AI de xuat patch config.

Tasks:

1. Tao repair-agent service.
2. Prompt AI bang adapter config + diagnostic + DOM snippet.
3. AI output patch JSON.
4. Validate patch schema.
5. Run patch tren fixtures.
6. Luu proposal.
7. Admin approve/publish.
8. Extension retry voi config moi.

Acceptance criteria:

- AI tao patch config hop le.
- Patch khong publish neu fail test.
- Admin co the approve/rollback.

## Phase 8 - Automation and Rules

Muc tieu: Pro automation.

Tasks:

1. Them rule schema.
2. Them Rules UI.
3. Them chrome.alarms scheduler.
4. Auto snapshot current chat theo interval.
5. Rule condition theo platform/title/url.
6. Rule action tao task/export.
7. Pro gate automation.

Acceptance criteria:

- Free khong dung automation.
- Pro tao duoc rule co ban.
- Scheduled task chay va ghi history.

## Recommended Next Sprint

Nen lam Phase 1 va Phase 2 truoc:

1. Task queue.
2. Quota/signature Free.
3. Floating button/modal.
4. Popup launcher update.

Ly do:

- Day la UX va monetization core.
- Chua can backend.
- Tao nen mong cho Manager, Automation, AI Repair.

