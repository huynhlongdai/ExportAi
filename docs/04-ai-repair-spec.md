# AI Repair System Spec

## Muc tieu

Khi ChatGPT, Grok, Gemini thay doi DOM lam export loi, ExportAI co the:

- Phat hien loi capture/export.
- Thu thap diagnostic an toan.
- Gui report len server neu user dong y.
- Dung AI de de xuat fix adapter.
- Test fix tren DOM fixtures.
- Phat hanh adapter config moi cho extension.

## Nguyen tac

- Khong gui noi dung hoi thoai mac dinh.
- Uu tien sua remote config thay vi remote code.
- AI khong duoc deploy thang vao production neu chua qua test.
- Moi adapter config co version va rollback.
- User luon co fallback export.

## Failure Types

- `NO_MESSAGES_FOUND`: khong tim thay message node.
- `EMPTY_CONTENT`: co node nhung text rong.
- `ROLE_INFERENCE_FAILED`: khong phan biet user/assistant.
- `PARTIAL_CAPTURE`: so message qua it so voi DOM/signals.
- `RENDER_FAILED`: loi khi render PDF/PNG.
- `DOWNLOAD_FAILED`: loi download API.
- `PERMISSION_FAILED`: host permission/content script issue.
- `TIMEOUT`: page load/lazy loading qua lau.

## Diagnostic Package

Mac dinh:

```json
{
  "platform": "chatgpt",
  "urlHost": "chatgpt.com",
  "extensionVersion": "0.1.0",
  "adapterVersion": "2026.05.27.1",
  "errorType": "NO_MESSAGES_FOUND",
  "selectorResults": {
    "[data-message-author-role]": 0,
    "article": 12
  },
  "domSignature": {
    "tagCounts": { "main": 1, "article": 12 },
    "attributes": ["data-testid", "aria-label"],
    "classTokens": ["markdown", "conversation"]
  },
  "sampleHtml": "sanitized/redacted snippet",
  "userConsent": true
}
```

Privacy modes:

- Private: chi gui selector count va DOM signature.
- Debug: gui HTML snippet da redact text.
- Support: user dong y gui sample co noi dung.

## Repair Flow

```text
Export fails
  -> show error UI
  -> user chooses Try auto repair / Send debug report
  -> extension sends diagnostic
  -> server stores report
  -> AI repair agent proposes adapter patch
  -> test runner runs patch against fixtures
  -> approve/reject
  -> publish adapter config version
  -> extension fetches latest config
  -> retry export
```

## AI Repair Agent

Input:

- Current adapter config.
- Diagnostic package.
- Sanitized DOM sample.
- Existing fixtures.
- Expected normalized schema.

Output:

```json
{
  "patchType": "adapter-config",
  "platform": "chatgpt",
  "confidence": 0.86,
  "changes": {
    "selectors.message": "article[data-testid^='conversation-turn']",
    "selectors.content": ".markdown",
    "roleStrategy": "attributeThenIndex"
  },
  "reason": "Old message selector returned 0 nodes while article nodes match conversation turns."
}
```

## Adapter Config Release

Moi release can co:

- Platform
- Version
- Changelog
- Confidence
- Test result
- Rollback target
- Published timestamp

Extension fetch:

- Khi khoi dong.
- Khi export fail.
- Theo lich moi vai gio.

## Fallback Modes

Khi chua co fix:

- Raw text export tu `main.innerText`.
- Manual selection mode.
- Visible screenshot.
- Browser print current page.
- Copy selected text to Markdown.

## Server Components

- `adapter-registry`: luu adapter config.
- `diagnostic-api`: nhan error reports.
- `repair-agent`: AI phan tich va tao patch.
- `fixture-store`: luu DOM snapshots va expected JSON.
- `test-runner`: chay adapter tren fixtures.
- `release-manager`: approve, publish, rollback adapter config.

## Admin Dashboard

Can co sau MVP:

- List failures theo platform/version.
- Xem AI patch proposals.
- Xem diff adapter config.
- Chay test lai.
- Approve/publish/rollback.

