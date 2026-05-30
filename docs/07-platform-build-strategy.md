# Platform Build Strategy

## Muc tieu

ExportAI can ho tro hai cach dong goi:

1. Full extension: mot extension ho tro ChatGPT, Grok, Gemini va cac platform khac.
2. Platform-specific extension: moi extension rieng cho mot platform, vi du:
   - ExportAI for ChatGPT
   - ExportAI for Grok
   - ExportAI for Gemini

Cach nay giup marketing de hon vi moi listing co keyword, screenshot, thong diep va landing page rieng.

## Nguyen tac code

- Core logic dung chung: task queue, quota, signature, manager, exporter.
- Platform config tach rieng trong `src/shared/platforms.js`.
- Adapter moi platform can co `id`, `name`, `productName`, `hosts`, `matches`, `selectors`.
- Manifest full build se gom tat ca `matches`.
- Manifest platform build chi gom `matches` cua platform do.

## De xuat folder tuong lai

```text
src/
  core/
    exportRunner.js
    taskStore.js
    quotaService.js
    signatureService.js
  adapters/
    chatgpt.js
    grok.js
    gemini.js
  shared/
    platforms.js
  ui/
    floating/
    popup/
    manager/
```

## Build variants

### Full

```json
{
  "name": "ExportAI",
  "matches": [
    "https://chatgpt.com/*",
    "https://grok.com/*",
    "https://gemini.google.com/*"
  ]
}
```

### ChatGPT-only

```json
{
  "name": "ExportAI for ChatGPT",
  "matches": [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*"
  ]
}
```

### Grok-only

```json
{
  "name": "ExportAI for Grok",
  "matches": [
    "https://grok.com/*",
    "https://x.com/i/grok*"
  ]
}
```

### Gemini-only

```json
{
  "name": "ExportAI for Gemini",
  "matches": [
    "https://gemini.google.com/*"
  ]
}
```

## Marketing loi ich

- Full extension: tot cho power users, SEO theo "AI chat exporter".
- ChatGPT-only: tot cho keyword "ChatGPT export", "export ChatGPT to PDF/Markdown".
- Grok-only: tot cho nguoi dung X/Grok.
- Gemini-only: tot cho Google ecosystem.

## Can lam khi co build pipeline

1. Tao `build.config.json` liet ke variants.
2. Tao script generate manifest theo variant.
3. Tao icon/screenshot/listing rieng.
4. Tao landing page rieng cho tung platform.
5. Dung cung license backend de Pro co the mo khoa full suite hoac tung app.

