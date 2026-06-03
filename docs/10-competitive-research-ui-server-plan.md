# Competitive Research and Modernization Plan

Research date: 2026-05-30

## Competitor Snapshot

| Product | Visible traction | Positioning | UX/product signals |
| --- | ---: | --- | --- |
| AI Exporter | 100,000 users, 4.8 rating, Featured | Multi-platform export to PDF, Word, MD, JSON, Image, Notion | Sidebar mode, stylish templates, local knowledge base, multi-selection, long chat export, model/timestamp metadata |
| ChatGPT Exporter | 100,000 users, 4.8 rating, Featured | Beautiful ChatGPT PDF/MD/Text/CSV/JSON export | PDF customization, dark/light mode, page numbers, margins, font size/family |
| ExportGPT | 20,000 users, 3.3 rating | Sidebar one-click export and preview/edit/download | Right-side format buttons, custom button visibility, shared-link export, select all/inverse/answer-only |
| Gemini Chat Exporter | 8,000 users, 3.1 rating | Simple Gemini export | One-click PDF/Text/CSV/Excel, lightweight secure message |
| Save my Chatbot | 10,000 users, 4.2 rating, Featured | Clean Markdown export for multiple AI assistants | Minimal, structured markdown, informative file header, custom filename/output |
| Perplexity to Notion | 5,000 users, 4.3 rating | Batch export/scheduled sync to Notion/Markdown | Batch export, Spaces, sources/related questions options, scheduled sync, document export |
| ChatGPT2Notion / AI Exporter Hub | 30+ tools, 13,900+ users claimed | Ecosystem hub across platforms and destinations | Platform x destination matrix, Universal Pass, product-specific landing pages |

## Key Takeaways

- Users understand a small floating/sidebar control faster than a generic popup-only flow.
- Winning listings lead with one-click export, bulk backup, polished PDF, Notion/Obsidian workflows, and privacy.
- The best market position is not only "export file"; it is "turn AI chats into a reusable knowledge archive."
- Platform-specific listings are useful for acquisition, but a universal license/hub should tie them together.
- Server-side repair and remote adapter updates can become a trust feature if framed as "stays working when AI sites change."

## Product Positioning

ExportAI should be positioned as:

> A local-first AI chat archiver with one-click export, task automation, repairable adapters, and Pro workflows for people who use multiple AI tools.

Primary differentiators:

- Full + platform-specific extension strategy from the same codebase.
- Local-first export with optional diagnostics upload.
- Server-provided selector-only adapter updates, never remote JavaScript.
- Task queue, link jobs, scheduled automation, and archive re-export.
- AI-ready exports: Markdown, JSON, JSONL, CSV/TSV, HTML, PDF, PNG.

## Modern UI Direction

### Visual System

- Replace the current plain utility look with a sharper productivity dashboard:
  - Background: `#f7f8f6`.
  - Surface: white.
  - Text: near-black green/charcoal.
  - Accent: emerald/teal for primary actions.
  - Secondary signal colors: amber for warning, red for failure, blue for remote/server.
- Keep 8px radius maximum for panels and cards.
- Use compact density; this is an operational tool, not a marketing page.
- Use icon buttons for export, retry, delete, settings, repair, copy, download, manager.

### Floating Tool

Improve the floating UI into a two-state control:

- Collapsed:
  - 44x44 icon button.
  - Status dot: ready/running/success/error.
  - Tooltip with platform + message count.
- Expanded:
  - Header: platform, title, status, minimize/close.
  - Quick presets as segmented chips.
  - Format grid with icon labels.
  - Primary action: Export now.
  - Secondary actions: Queue task, Open Manager.
  - Error state: Use fallback, Send diagnostic, Try repair.

Avoid:

- Large paragraphs inside the modal.
- Modal opening off-screen.
- Text-only format buttons when icons can explain quickly.

### Popup

Make popup a command center:

- Current page status.
- Big quick action using default preset.
- Two compact rows:
  - Open floating tool.
  - Open manager/side panel.
- Plan/quota bar.
- Warning banner if current platform adapter has diagnostics.

### Manager

Restructure Manager around a left navigation rail on desktop and top segmented nav on narrow side panel:

- Dashboard:
  - Exports today/month.
  - Recent failures.
  - Adapter health.
  - Server/license status.
- Tasks:
  - Queue, waiting link jobs, running, failed, success.
  - Bulk delete/filter.
- Archives:
  - Search by title/platform/date.
  - Re-export formats.
  - Future: IndexedDB large archive.
- Diagnostics:
  - Error type, adapter version, selector counts.
  - Upload private/debug/support.
  - Try repair.
- Adapters:
  - Bundled vs remote vs manual override.
  - Fetch remote, rollback, import.
- Rules:
  - Rule builder with platform/title/url conditions.
  - Schedule interval.
- Presets:
  - Default presets + custom preset editor.
- Plan:
  - Free vs Pro comparison.
  - License key/server validation.

## Server Improvements

### Short-Term MVP Hardening

- Persist store with migration version.
- Add `/api/status` with server version, adapter counts, diagnostics counts.
- Add admin list endpoints with pagination.
- Add adapter rollback endpoint.
- Add proposal status states: proposed, approved, rejected, published, rolled_back.
- Add strict schema validation for adapters and diagnostics.

### License and Billing

- Add production license table:
  - license key hash.
  - plan.
  - status.
  - seats.
  - domains/devices if needed.
  - renewal date.
- Add payment webhook adapter:
  - Stripe/LemonSqueezy/Paddle compatible layer.
  - webhook signature verification.
  - idempotency keys.
- Extension should cache license state with expiry and work offline for a grace period.

### AI Repair

Current implementation is selector-only proposal. Next level:

- Store sanitized DOM fixtures by platform/version/error type.
- Run repair proposal against fixture runner before publish.
- Add admin approval UI.
- Add automatic extension retry after remote adapter update.
- Keep hard rule: remote config only, no remote JavaScript.

### Privacy

- Default upload mode: private.
- Debug upload: redacted DOM sample.
- Support upload: explicit user consent and clear warning.
- Never upload transcript content unless support mode is selected.

## Implementation Roadmap

### Sprint 1 - UI Polish

1. Add shared CSS tokens.
2. Redesign popup as compact command center.
3. Redesign floating modal states.
4. Add status/repair actions to floating error state.
5. Improve Manager layout with dashboard and left/top responsive nav.

### Sprint 2 - Manager Depth

1. Add task/archive search and filters.
2. Add adapter health cards.
3. Add diagnostic detail drawer.
4. Add preset editor modal.
5. Add rule builder validation.

### Sprint 3 - Server Hardening

1. Add `/api/status`.
2. Add adapter rollback.
3. Add diagnostic/proposal pagination.
4. Add JSON schema validation.
5. Add server tests.

### Sprint 4 - Monetization

1. Add production license model.
2. Add payment webhook provider.
3. Add license cache/grace period.
4. Add Pro upgrade states in popup/floating/manager.

### Sprint 5 - AI Repair v2

1. Add fixture store.
2. Add real fixture runner.
3. Add AI repair worker.
4. Add admin approve/reject dashboard.
5. Add extension retry after remote adapter update.

## Store Listing Plan

Create four listing paths:

- ExportAI - universal.
- ExportAI for ChatGPT.
- ExportAI for Grok.
- ExportAI for Gemini.
- ExportAI for Perplexity.
- ExportAI for Claude.
- ExportAI for Copilot.
- ExportAI for Devin.
- ExportAI for Lovable.

Each listing should have:

- 5 screenshots: floating export, format picker, manager dashboard, diagnostics repair, archive/re-export.
- One short demo video.
- Privacy-first copy.
- Clear Free vs Pro copy.
- Links to universal license.

## Immediate Next Build Tasks

1. Implement the redesigned UI surfaces.
2. Expand provider support beyond ChatGPT/Grok/Gemini, starting with Perplexity.
3. Add Word export and preserve heading/list/table structure across Markdown/HTML/Word.
4. Add `/api/status` and adapter rollback server endpoints.
5. Add diagnostic detail view in Manager.
6. Add Chrome Web Store asset checklist.
7. Add first landing page or README screenshots for GitHub.

## Implementation Status - 2026-06-03

- Redesigned UI surfaces are implemented for the current MVP:
  - Popup command panel shows provider, message count, plan, server status, and diagnostic warnings.
  - Floating tool has provider tooltip, status dot, viewport-aware modal, presets/formats, task creation, fallback retry, and diagnostics CTA.
  - Manager Dashboard shows export counts, archive counts, failures, waiting jobs, adapter health, server status, and recent failures.
  - Manager Diagnostics has detail JSON, upload, repair, and delete actions.
  - Manager Adapters can fetch remote configs and request server rollback.
  - Manager Repair lists server proposals and supports approve/reject actions.
- Provider support now includes ChatGPT, Grok, Gemini, Perplexity, Claude, Copilot, Devin, and Lovable.
- Word-compatible DOC export is implemented, and Markdown/HTML/Word preserve headings, lists, blockquotes, tables, code, links, images, and assets where available.
- Server hardening is implemented:
  - `/api/status`
  - paginated diagnostics/proposals
  - adapter rollback
  - proposal reject
  - proposal approve/publish from Manager
  - schema version migration
  - adapter/diagnostic validation
  - `npm run test:server` smoke test
- Chrome Web Store asset checklist is implemented in `docs/11-chrome-web-store-assets.md`.
- First local landing page is implemented in `landing.html`.
