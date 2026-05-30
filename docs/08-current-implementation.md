# Current Implementation Notes

## Implemented

- Shared platform config in `src/shared/platforms.js`.
- Manifest now loads shared platform config before content script.
- Background task engine in `src/background.js`.
- Local task persistence with `chrome.storage.local`.
- Free quota state: 10 exports/day, 50 exports/month.
- Free signature policy for Markdown, JSON, PDF, PNG.
- Free signature policy for Markdown, JSON, TXT, CSV, TSV, JSONL, HTML, PDF, PNG.
- Popup quick export and launcher actions.
- Floating button and modal injected on supported AI chat pages.
- Floating modal supports:
  - Format selection
  - Metadata toggle
  - Export now
  - Create task
  - Open manager
  - Drag position persistence
- Floating UI renders inside Shadow DOM to avoid host page CSS conflicts.
- Floating saved position is clamped back into the viewport.
- Popup/background can inject content scripts into the active tab when an existing chat tab was opened before the extension reload.
- Background now also injects floating UI when supported AI chat tabs finish loading or become active.
- Dragging the floating icon no longer triggers the click-to-open action on pointer release.
- Floating modal uses viewport-aware placement so it opens left/right and clamps vertically instead of being clipped at screen edges.
- Manager is registered as a Chrome side panel and falls back to a manager tab when side panel opening is not available.
- Message extraction now stores role confidence, role source, selector source, DOM order, bounding rectangle, and text hash.
- Message extraction now prefers structured content roots like `.markdown` and preserves `<pre><code>` blocks as fenced Markdown.
- Message extraction captures links, images, and file hints as `assets[]` on each message and at the conversation root.
- Popup/floating summary shows user vs AI message counts.
- Export formats currently implemented: Markdown, JSON, PDF, PNG, TXT, CSV, TSV, JSONL, HTML, Word-compatible DOC.
- Markdown/HTML/Word rendering preserves heading hierarchy, lists, blockquotes, tables, code fences, links, images, and assets where available.
- Manager page with task list, filters, Run/Retry, Delete.
- Preset defaults are stored locally: AI Archive, Human Report, Dataset, Visual Snapshot, Full Backup.
- Popup and floating modal can apply presets to formats and metadata.
- Manager now has Tasks, Presets, and Plan views.
- Background uses a ping guard before programmatic content-script injection to avoid duplicate injection.
- Successful exports now save a compact conversation archive snapshot in `chrome.storage.local`.
- Manager now has an Archives view with message count, asset count, source URL, formats, and delete action.
- Archives can be re-exported from Manager for text/data/html formats: Markdown, JSON, TXT, CSV, TSV, JSONL, HTML.
- Archive re-export creates a task record, consumes quota, and preserves Free signature policy.
- PDF/PNG re-export from archive is not implemented yet; next step is offscreen rendering or shared DOM/canvas rendering.
- Diagnostics module is implemented locally.
- Failed content-script exports return a diagnostic package with platform, selector counts, DOM signature, and error type.
- Background stores diagnostics in `chrome.storage.local` and Manager has a Diagnostics view with delete action.
- Diagnostics can be uploaded to the local repair server with explicit Manager actions; private mode sends hashes, selector counts, DOM signature, and adapter metadata.
- Content script includes a redacted DOM sample in diagnostics for debug/support repair modes.
- Export has raw text fallback when message selectors fail, so the user can still export visible page text while diagnostics are captured.
- Rules/Automation module is implemented locally with `chrome.alarms`.
- Default rule: Auto archive active AI tab every 60 minutes as Markdown + JSON, disabled by default and Pro-gated.
- Manager has a Rules view with rule status, schedule, last/next run, and toggle action.
- Free plan sees Pro-gated automation rules but cannot enable them.
- Adapter Registry Local is implemented.
- Platform adapters now include `adapterVersion` and `adapterStatus`.
- Background stores bundled adapter metadata in `chrome.storage.local`.
- Manager has an Adapters view showing version, source, status, selector groups, hosts, and diagnostic counts per platform.
- Diagnostics now include adapter version/status metadata.
- Manual Adapter Config Import is implemented in Manager > Adapters.
- Imported adapter config is validated against known platform ids and selector-only allowlist rules.
- Content script loads adapter overrides from background and uses override selectors/selectorGroups after chat tab reload.
- Remote JavaScript is never executed; this is designed as the safe local precursor to a server-provided AI repair config.
- Remote adapter fetch is implemented against the server MVP and validates selector-only configs before applying them.
- Backend server MVP is implemented in `server/exportai-server.cjs`.
- Server MVP supports license validation, remote adapter publish/fetch, diagnostics storage, repair proposal creation, and proposal approval.
- Manager Settings supports server URL/license key and Pro license validation.
- Export Settings module is implemented.
- Background stores settings for default metadata, asset inclusion, UI wrapper cleanup, tool failure notice cleanup, default preset, and filename pattern.
- Popup and floating modal read settings for default metadata/preset behavior.
- Content extraction applies settings for asset inclusion and content cleanup.
- Manager has a Settings view to edit export options.
- Manager Presets can create/delete custom presets when Pro is active.
- Link-based Job Queue is implemented.
- Manager Tasks view includes "Create job from chat link".
- Link jobs are saved as `waiting_for_tab` with `triggerMode: url_match`.
- When a supported ChatGPT/Grok/Gemini tab loads or becomes active and its URL matches the waiting job, background injects the content script and runs the export task.
- Link jobs use the user's browser session; no server crawl or cookie/token collection is used.
- Grok adapter was revised to version `2026.05.28.3`; `whitespace-pre-wrap` is no longer used as a message selector because it can match individual list items and split one response into many fake turns.
- Grok extraction now normalizes tiny `li/p/span` candidates up to a likely message container and de-duplicates those containers before role inference.
- Grok extraction now prunes nested/contained candidates so headings, links, and bullet fragments inside one answer are not exported as separate fake turns.
- Gemini exports now clean plain text wrappers like `Bạn đã nói` / `You said` at the start of user messages.
- DOM table extraction now renders Markdown tables instead of concatenating table cells into one line.
- Ordered and unordered lists are preserved in Markdown extraction.
- Content extraction now has a readable `main` fallback for platforms whose DOM does not expose known message selectors.
- Perplexity, Claude, Copilot, Devin, and Lovable support is implemented with local selectors, fixtures, diagnostics, and platform-specific build output.
- Platform build strategy documented for full vs platform-specific extension listings.
- Platform-specific manifest builder is implemented for ChatGPT, Grok, Gemini, Perplexity, Claude, Copilot, Devin, and Lovable variants.
- Local adapter fixtures and a selector-count test runner are implemented for ChatGPT, Grok, Gemini, Perplexity, Claude, Copilot, Devin, and Lovable.

## Not Yet Implemented

- Real payment provider integration and subscription webhook.
- Production account system for shared Pro license across published variants.
- IndexedDB archive for very large transcript storage; current archive uses compact `chrome.storage.local`.
- PDF/PNG re-export from archive via offscreen rendering.
- Fully automated AI code repair agent with model calls and DOM fixture execution; current server creates selector-only repair proposals.
- Admin dashboard UI; current admin operations are HTTP endpoints.
- Chrome Web Store packaging/signing workflow.

## Important Product Direction

The code should continue to separate:

- Core export/task/quota/signature logic.
- Platform-specific adapter logic.
- UI surfaces: popup, floating modal, manager.

This keeps the path open for:

- One full ExportAI extension.
- Separate ExportAI for ChatGPT/Grok/Gemini extensions.
- Shared Pro license across all variants.
