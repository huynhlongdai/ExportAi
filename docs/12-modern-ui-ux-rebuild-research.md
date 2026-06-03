# Modern UI/UX Rebuild Research

Date: 2026-06-03

## Research Sources

- Chrome Side Panel API docs and UX guidance: side panel is a persistent companion surface that can stay open across tab navigation, be limited to relevant sites, and should complement browsing without unnecessary distractions.
- Chrome extension UI docs: extension UI surfaces include action popup, side panel, context menus, tooltips, and badges.
- Competitor scan:
  - AI Exporter: multi-platform export, PDF/PNG/Markdown/TXT, Notion sync, partial export, reasoning-step setting, high-quality screenshot.
  - ExportGPT: sidebar buttons, preview/edit/copy/download, customizable visible export buttons, shared-link export, image content, select all/invert/answer-only.
  - XWX AI Chat Exporter: floating export button, PDF/Word/Markdown/TXT/JSON, multi-platform, message selection, Notion, code/charts/formulas positioning.
  - SaveAIChat/Miromap/ChatExport/ChatExport AI: clean PDF/HTML/JSON/CSV, searchable text, many providers, local/privacy positioning.

## Product Direction

Reframe ExportAI as a professional "AI conversation capture workspace", not only a download button.

Primary promise:

> Export, archive, and repair AI conversations from multiple providers with clean structure, assets, tasks, and Pro workflows.

Differentiators to make visible in UI:

- Multi-provider from day one: ChatGPT, Grok, Gemini, Perplexity, Claude, Copilot, Devin, Lovable.
- AI-ready formats: Markdown, JSON, JSONL, CSV/TSV, HTML, Word, PDF, PNG.
- Structure preservation: headings, lists, tables, links, code, images/assets.
- Task automation and link-based jobs.
- Repairable adapters when providers change DOM.
- Local-first/privacy-first, with optional server repair/license.
- Platform-specific extension variants from the same codebase.

## UX Principles

- Popup is a command launcher, not the full product.
- Side panel/Manager is the persistent workspace.
- Floating UI is contextual and lightweight; it should not compete with the chat UI.
- Every export action should show provider, message count, selected scope, chosen preset, quota, and repair status.
- Use icon-first controls with labels only where clarity matters.
- Prefer compact, scannable operational UI over landing-page style cards.
- Avoid nested cards. Use full-width bands, rows, segmented controls, tables, and drawers.
- Keep 8px radius or less.
- No one-note palette; move from current green-only look to neutral base plus provider/status accents.

## Proposed Information Architecture

### 1. Popup

Role: quick status and fastest path.

Layout:

- Header: ExportAI logo/name, provider pill, plan badge.
- Status strip:
  - Provider detected / unsupported
  - Message count: user / AI / assets
  - Adapter status: local / remote / warning
- Primary action: Export current chat
- Compact format segmented control:
  - Doc: Markdown, Word, PDF
  - Data: JSON, JSONL, CSV
  - Visual: PNG, HTML
- Preset selector.
- Secondary icon actions:
  - Open floating
  - Open Manager side panel
  - Diagnostics
  - Settings

Remove:

- Large equal-weight format grid as the primary visual.
- Long status sentences.

### 2. Floating UI

Role: contextual launcher on AI chat pages.

Collapsed state:

- Small draggable pill or square icon.
- Provider mark or short label.
- Status dot:
  - Green: ready
  - Amber: diagnostic warning
  - Red: extraction failed
  - Blue: running task
- Tooltip: provider, messages, click action.

Expanded state:

- Compact contextual panel with tabs:
  - Export
  - Select
  - Repair
- Export tab:
  - Preset chips
  - Scope segmented control: All / User + AI / AI only / Selected
  - Format groups, not a flat grid
  - Export now, Queue task, Open Manager
- Select tab:
  - Message count summary
  - Select all / invert / user only / AI only
  - Optional future message checkboxes injected near turns
- Repair tab:
  - Adapter version/status
  - Last diagnostic
  - Try fallback
  - Send diagnostic / request repair

Important behavior:

- Opening should always choose the side with more space and clamp within viewport.
- Dragging should not open panel on release.
- User can hide per host and restore from popup.

### 3. Manager Side Panel

Role: main workspace.

Navigation:

- Dashboard
- Export
- Tasks
- Archives
- Diagnostics
- Adapters
- Repair
- Presets
- Settings

Dashboard:

- Top status band: current server, plan, quota, adapter health.
- Provider health table: provider, version, source, diagnostics, last export, repair action.
- Recent activity list.

Export:

- Current detected tab summary.
- Preset builder.
- Format matrix by use case:
  - Human documents
  - AI/RAG datasets
  - Visual/share
  - Backup
- Preview pane for Markdown/JSON/HTML text before download.

Tasks:

- Create job from chat link.
- Queue table with status, provider, formats, trigger mode, retry.
- Filters: waiting, running, failed, completed.

Archives:

- Searchable archive list.
- Re-export selected archive.
- Asset count and source URL visible.
- Future: IndexedDB-backed large archive storage.

Diagnostics:

- Provider grouped failures.
- Detail drawer with selector counts, adapter version, DOM signature.
- Actions: retry fallback, send private diagnostic, request repair.

Adapters:

- Provider table.
- Bundled vs imported vs remote.
- Fetch remote, rollback, import config.
- Show selector groups in a collapsible detail drawer.

Repair:

- Proposal queue.
- Status: proposed, rejected, published.
- Diff-like selector comparison.
- Approve/reject/publish controls.
- Test status and confidence.

Settings:

- Export defaults.
- Asset inclusion.
- Cleanup toggles.
- Server URL.
- License key.
- Admin token in advanced section.
- Platform variant build info.

### 4. Optional Full Manager Page

Keep the side panel as primary, but allow opening a full manager tab for wide views:

- Bulk archive operations.
- Repair proposals.
- Format preview/diff.
- Chrome Web Store asset/testing checklist.

## Visual System

### Palette

Use a neutral operational base with restrained accents:

- Background: `#f7f8fb`
- Surface: `#ffffff`
- Text primary: `#14171f`
- Text secondary: `#596273`
- Border: `#d9dee8`
- Primary: `#2563eb`
- Success: `#168a57`
- Warning: `#b7791f`
- Danger: `#c0362c`
- Purple only as a small Pro accent: `#7c3aed`

Provider accents:

- ChatGPT: green
- Grok: near-black/blue
- Gemini: blue
- Perplexity: teal
- Claude: warm neutral
- Copilot: blue
- Devin: indigo
- Lovable: rose

### Components

- Provider pill
- Plan badge
- Status dot
- Segmented control
- Format chip with icon
- Preset chip
- Action toolbar
- Data table
- Detail drawer
- Toast
- Empty state
- Progress stepper
- Quota meter
- Adapter health row

### Icons

Use a lightweight icon set if added later, or CSS/text fallback first:

- Download
- File text
- Braces for JSON
- Image
- Clock/task
- Archive
- Wrench/repair
- Shield/privacy
- Settings
- Alert
- Refresh/rollback

## Key Workflows

### One-click Export

1. User opens AI chat.
2. Floating icon shows provider and ready dot.
3. User clicks Export now.
4. Status shows task progress.
5. Files download.
6. Archive snapshot is saved.

### Curated Export

1. User opens popup or floating panel.
2. Selects preset.
3. Chooses scope and formats.
4. Opens preview if needed.
5. Exports or queues task.

### Link Job

1. User opens Manager > Tasks.
2. Pastes ChatGPT/Grok/Gemini/etc. link.
3. Job waits for matching authenticated tab.
4. Extension runs export using user's browser session.

### Repair Flow

1. Export fails or captures low-confidence content.
2. Floating/popup shows warning.
3. User opens Diagnostics.
4. User sends private diagnostic.
5. Server creates proposal.
6. Admin approves/rejects in Manager Repair.
7. Remote adapter fetch applies selector-only config.

## Free vs Pro UX

Free:

- Signature visible in exports.
- Daily/monthly quota visible but not noisy.
- Pro features shown as disabled with clear upgrade affordance.

Pro:

- No signature.
- Higher/unlimited export limits.
- Automation rules enabled.
- Custom presets.
- Priority repair/support.
- Future: Notion/sync destinations.

Avoid dark patterns:

- Let free export work well.
- Explain what is locked at point of use.
- Do not block diagnostics or basic repair visibility.

## Implementation Plan

### Phase A - Design Foundation

- Add shared CSS tokens file for popup/manager and mirrored tokens for floating Shadow DOM.
- Normalize typography, spacing, buttons, badges, segmented controls.
- Add provider/status/plan component classes.

### Phase B - Popup Rebuild

- Convert popup to command dashboard.
- Replace flat format grid with grouped format selector.
- Add provider/adapter/server/diagnostic status strip.
- Add icon secondary actions.

### Phase C - Floating Rebuild

- Replace current modal with compact tabbed panel.
- Add scope selector and preset chips.
- Add provider/status pill.
- Add repair tab actions.
- Keep existing viewport-aware placement and drag safeguards.

### Phase D - Manager Rebuild

- Introduce left navigation or top compact nav depending width.
- Upgrade Dashboard provider health table.
- Rework Tasks, Archives, Diagnostics, Adapters, Repair as tables with detail drawers.
- Move Settings into clearer sections.

### Phase E - Preview + Selection

- Add export preview for Markdown/JSON/HTML.
- Add message scope controls.
- Add provider-safe message selection hooks where DOM allows it.

### Phase F - Verification

- Run syntax checks and adapter tests.
- Use Chrome/in-app browser screenshots for popup, side panel, floating panel.
- Verify text fit at narrow popup width and side panel width.
- Verify floating panel on all four screen corners.

## Acceptance Criteria

- Popup works as a 340-380px command center without scrolling for common export.
- Floating icon is visible, draggable, and never opens accidentally after drag.
- Floating panel never clips off-screen.
- Manager side panel can handle all core workflows without needing a full tab.
- Current providers and export formats remain functional.
- Repair/admin workflow remains available.
- UI visually supports full extension and provider-specific variants.
- All tests pass: `npm run check`, `npm run test:adapters`, `npm run test:server`.

