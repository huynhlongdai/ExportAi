# Technical Architecture

## Tong quan

Extension dung Manifest V3 va gom cac thanh phan:

```text
popup / sidepanel / floating modal
    |
    v
background service worker
    |
    +-- taskStore
    +-- exportRunner
    +-- adapterRegistry
    +-- quotaService
    +-- signatureService
    +-- downloadService
    +-- repairClient
    |
    v
content scripts
    |
    +-- platform adapters
```

## Thanh phan

### Content Script

Trach nhiem:

- Inject floating button/modal.
- Capture DOM cua conversation hien tai.
- Chay platform adapter local.
- Tra ve normalized conversation.
- Hien fallback UI khi capture fail.

Khong nen:

- Luu task dai han.
- Xu ly billing/license.
- Chay AI repair truc tiep.

### Background Service Worker

Trach nhiem:

- Dieu phoi task queue.
- Goi content script capture.
- Render/export file.
- Goi download API.
- Cap nhat task status.
- Sync adapter config.
- Sync license/quota.
- Xu ly alarms.

### Manager UI

Trach nhiem:

- Hien task/history/preset/rule/plan.
- Cho phep retry/cancel/delete/re-export.
- Tao preset/rule.
- Hien quota va upsell.

### Storage

Ban dau:

- `chrome.storage.local` cho task metadata, settings, plan cache.
- IndexedDB cho transcript archive lon.

De xuat key:

```text
settings
planState
quotaState
adapterVersions
taskIndex
presetIndex
ruleIndex
```

Transcript archive nen luu trong IndexedDB:

```text
conversations
exports
diagnostics
```

## Data Models

### Conversation

```json
{
  "schemaVersion": 1,
  "conversationId": "chatgpt:abc",
  "platform": "chatgpt",
  "title": "Build Chrome extension",
  "url": "https://chatgpt.com/c/...",
  "capturedAt": "2026-05-27T15:30:00.000Z",
  "messages": [
    {
      "id": "m1",
      "role": "user",
      "content": "Hello",
      "contentType": "markdown",
      "assets": [
        {
          "id": "asset_1",
          "type": "link",
          "url": "https://example.com",
          "title": "Example",
          "alt": "",
          "mimeType": "",
          "source": "anchor"
        }
      ],
      "roleConfidence": 0.98,
      "roleSource": "attribute",
      "position": {
        "index": 0,
        "order": 1,
        "selector": "[data-message-author-role]",
        "rect": {
          "top": 1200,
          "left": 320,
          "width": 720,
          "height": 96,
          "viewportTop": 180,
          "viewportLeft": 320
        },
        "textHash": "abc123"
      },
      "createdAt": null,
      "metadata": {
        "tagName": "div",
        "roleReason": "Matched user role hint from attribute."
      }
    }
  ],
  "assets": [
    {
      "id": "asset_1",
      "type": "link",
      "url": "https://example.com",
      "title": "Example",
      "messageId": "m1",
      "messageOrder": 1,
      "role": "assistant"
    }
  ],
  "metadata": {}
}
```

### ExportTask

```json
{
  "id": "task_...",
  "conversationId": "chatgpt:abc",
  "platform": "chatgpt",
  "title": "Build Chrome extension",
  "sourceUrl": "https://chatgpt.com/c/...",
  "formats": ["markdown", "json"],
  "presetId": "ai_archive",
  "status": "queued",
  "progress": 0,
  "steps": [
    { "name": "capture", "status": "pending" },
    { "name": "normalize", "status": "pending" },
    { "name": "render", "status": "pending" },
    { "name": "download", "status": "pending" }
  ],
  "createdAt": "2026-05-27T15:30:00.000Z",
  "startedAt": null,
  "completedAt": null,
  "error": null,
  "outputFiles": []
}
```

### ExportPreset

```json
{
  "id": "ai_archive",
  "name": "AI Archive",
  "formats": ["markdown", "json"],
  "includeMetadata": true,
  "includeSignature": true,
  "includeCodeBlocks": true,
  "filenamePattern": "{platform}-{title}-{date}",
  "proRequired": false
}
```

### PlanState

```json
{
  "plan": "free",
  "licenseStatus": "inactive",
  "licenseCheckedAt": null,
  "quota": {
    "dailyLimit": 10,
    "dailyUsed": 0,
    "monthlyLimit": 50,
    "monthlyUsed": 0
  },
  "features": {
    "removeSignature": false,
    "batchExport": false,
    "automation": false,
    "customTemplates": false,
    "aiRepairPriority": false
  }
}
```

## Export Runner Flow

```text
User action
  -> create ExportTask
  -> validate quota
  -> capture conversation
  -> normalize conversation
  -> apply signature policy
  -> render selected formats
  -> download files
  -> update history
  -> update quota
```

## Platform Adapters

Moi adapter gom:

- `matchHost`
- `detectConversation`
- `extractMessages`
- `inferRole`
- `extractTitle`
- `fallbackExtract`
- `selectorGroups` de gom cac selector user/assistant cung mot strategy, tranh viec chi lay mot nua conversation.

Message extraction can luu them:

- Visual order cua message tren document.
- Bounding rectangle cua node message.
- Selector source.
- Role confidence va role source.
- Text hash de debug duplicate ma khong can gui noi dung day du.
- Assets trong message: links, images, file hints/attachments.
- Assets tong hop o conversation root de RAG/export formats truy cap nhanh.

Adapter runtime nen ho tro remote config:

```json
{
  "platform": "chatgpt",
  "version": "2026.05.27.1",
  "strategy": "selectorPipeline",
  "selectors": {
    "message": "[data-message-author-role]",
    "content": ".markdown",
    "roleAttribute": "data-message-author-role"
  },
  "fallbacks": ["article", "main [role='article']"]
}
```

## Security va Privacy

- Khong gui transcript len server neu user chua dong y.
- Diagnostic mac dinh phai redact text.
- License sync chi gui license/account token can thiet.
- Remote adapter update chi nen la config JSON allowlisted, khong remote JS tuy y.
- Neu can code fix lon, phat hanh ban extension moi.
