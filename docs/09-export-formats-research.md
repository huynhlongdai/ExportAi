# Export Formats Research

Research date: 2026-05-27

## Sources

- OpenAI ChatGPT file uploads support common text, spreadsheet, presentation, document formats including XLSX, XLS, CSV, TSV, DOCX, PPTX, PDF, TXT. It does not support `.gdoc` directly and recommends exporting Google Docs as PDF/DOCX/etc. Source: https://help.openai.com/en/articles/8983675
- OpenAI File Search supported files include `.md`, `.json`, `.pdf`, `.docx`, `.pptx`, `.html`, `.js`, `.ts`, `.py`, `.css`, `.txt`, `.tex`, and more. Source: https://platform.openai.com/docs/assistants/tools/file-search
- OpenAI fine-tuning data is commonly prepared as JSONL. Source: https://help.openai.com/en/articles/6811186-how-do-i-format-my-fine-tuning-data-for-the-openai-api
- Claude document upload support includes common document/text formats; Anthropic notes that for non-PDF documents Claude generally extracts text. Source: https://support.anthropic.com/en/articles/8241126-what-kinds-of-documents-can-i-upload-to-claude-ai
- Gemini Apps support document files including DOC, DOCX, PDF, RTF, DOT, DOTX, HWP, HWPX, and other media/data types depending on plan/context. Source: https://support.google.com/gemini/answer/14903178
- CommonMark defines an interoperable Markdown spec. Source: https://commonmark.org/
- GitHub Flavored Markdown is a formal spec based on CommonMark and adds practical extensions like tables/task lists. Source: https://github.github.com/gfm/
- W3C Web Annotation Data Model can represent annotations in an interoperable structured model. Source: https://www.w3.org/TR/annotation-model/

## Format Strategy

ExportAI should not simply add many extensions. Each format should map to a clear workflow:

- Human reading and sharing.
- Re-uploading to AI tools.
- RAG/search/indexing.
- Dataset/fine-tuning.
- Compliance/archive.
- Developer handoff.
- Visual proof/screenshot.
- Collaboration and annotation.

## Recommended Format Tiers

### Tier 1 - MVP/Core

These should be high quality before adding many niche formats.

| Format | Extension | Use case | Notes |
| --- | --- | --- | --- |
| Markdown | `.md` | AI-friendly transcript, developer notes, docs | Use GFM by default; preserve code fences, tables, links. |
| JSON | `.json` | Structured archive, app import/export, debugging | Include schema version, roles, position metadata, attachments. |
| PDF | `.pdf` | Human sharing, reports, compliance | Print template, optional page footer/signature. |
| PNG | `.png` | Visual snapshot/proof | Best for short conversations or selected ranges. |
| TXT | `.txt` | Universal upload fallback | Clean plain text, no formatting dependency. |

### Tier 2 - AI and Data Workflows

| Format | Extension | Use case | Notes |
| --- | --- | --- | --- |
| JSONL | `.jsonl` | Dataset/fine-tuning/eval rows | One message pair or turn per line. |
| OpenAI fine-tune JSONL | `.jsonl` | Fine-tuning prep | Convert conversations to `messages` examples; require user review. |
| ChatML-style Markdown | `.chat.md` | Prompt replay / model comparison | Explicit `system/user/assistant` blocks. |
| YAML | `.yaml` | Config-like structured transcript | Useful for human-editable structured notes. |
| CSV | `.csv` | Spreadsheet analysis | Columns: order, role, content, timestamp, tokens, selector. |
| TSV | `.tsv` | Safer spreadsheet export for multiline-ish content | Less comma escaping pain than CSV. |

### Tier 3 - Office and Business Sharing

| Format | Extension | Use case | Notes |
| --- | --- | --- | --- |
| DOCX | `.docx` | Client reports, editable docs | Pro candidate; needs reliable generation library. |
| RTF | `.rtf` | Lightweight rich text | Broad compatibility, simpler than DOCX. |
| PPTX | `.pptx` | Conversation summary deck | Better as "summary export", not raw transcript. |
| XLSX | `.xlsx` | Conversation audit/data review | One row per message, filters, sheets per conversation. |

### Tier 4 - Web and Publishing

| Format | Extension | Use case | Notes |
| --- | --- | --- | --- |
| HTML | `.html` | Self-contained readable archive | Can preserve styling/code highlighting. |
| MHTML | `.mhtml` | Browser archive | Harder in extension; optional. |
| EPUB | `.epub` | Long reading/archive | Good for long research chats. |
| Static site bundle | `.zip` | Publishable conversation archive | `index.html`, assets, JSON manifest. |

### Tier 5 - RAG, Search, and Knowledge Base

| Format | Extension | Use case | Notes |
| --- | --- | --- | --- |
| Chunked JSON | `.chunks.json` | RAG ingestion | Include chunk IDs, source message IDs, token estimates. |
| NDJSON chunks | `.chunks.ndjson` | Streaming ingestion pipelines | One chunk per line. |
| Embedding manifest | `.manifest.json` | Vector DB import | Include document IDs, chunk metadata, hashes. |
| Obsidian vault | `.zip` | Personal knowledge base | Markdown plus frontmatter/tags. |
| Notion-ready Markdown | `.md` | Import to Notion | Avoid unsupported syntax where possible. |
| Docusaurus/MkDocs docs | `.zip` | Docs site import | Useful for developer teams. |

### Tier 6 - Annotation, Audit, and Provenance

| Format | Extension | Use case | Notes |
| --- | --- | --- | --- |
| Web Annotation JSON-LD | `.annotation.jsonld` | Highlight/comment interoperability | Based on W3C Web Annotation model. |
| Provenance JSON | `.prov.json` | Audit trail | Capture source URL, export time, adapter version, hash. |
| HAR-like capture manifest | `.capture.json` | Debug/AI repair | Redacted DOM signatures and selector results. |
| Signed archive manifest | `.sig.json` | Integrity verification | Future enterprise feature. |

### Tier 7 - Images and Visual Evidence

| Format | Extension | Use case | Notes |
| --- | --- | --- | --- |
| JPEG | `.jpg` | Smaller visual sharing | Less ideal for text, but compact. |
| WebP | `.webp` | Smaller high-quality screenshot | Modern browser support. |
| SVG | `.svg` | Structured visual transcript | Could render text/cards as vector. |
| Multi-page PNG ZIP | `.zip` | Very long visual transcript | Split long chat into pages/images. |

## AI-Friendly Format Recommendations

### Best default for AI re-upload

1. Markdown/GFM
2. TXT
3. JSON
4. PDF only when visual layout matters

Reason:

- Markdown preserves headings, lists, code blocks and is widely accepted.
- TXT is the safest fallback.
- JSON is best for tools, but less friendly for direct human prompting.
- PDF is common but can lose structure depending on parser.

### Best for fine-tuning/evals

1. JSONL conversation examples.
2. CSV/TSV audit table.
3. JSON canonical archive.

Important: fine-tuning exports should require a warning step because conversations may contain private data, copyrighted content, or low-quality examples.

### Best for RAG

1. Chunked JSON/NDJSON.
2. Markdown with frontmatter.
3. HTML if preserving links/code is important.

Chunk metadata should include:

- conversationId
- messageId
- role
- order
- platform
- sourceUrl
- exportedAt
- adapterVersion
- tokenEstimate
- contentHash

## Proposed Product Packaging

### Free

- Markdown
- JSON
- TXT
- Basic PDF
- Basic PNG
- Signature required
- Limited quota

### Pro

- DOCX
- XLSX
- JSONL fine-tune/eval
- Chunked RAG JSON/NDJSON
- HTML self-contained
- ZIP bundle
- Custom templates
- No signature
- Higher/unlimited quota

### Team/Enterprise Later

- Signed archives
- Provenance/audit JSON
- Web Annotation JSON-LD
- Bulk exports
- Cloud sync
- Adapter repair priority

## Implementation Priority

1. Improve Markdown/GFM fidelity. Implemented initially.
2. Add TXT. Implemented.
3. Add CSV/TSV. Implemented.
4. Add JSONL. Implemented.
5. Add HTML. Implemented.
6. Add ZIP bundle.
7. Add DOCX/XLSX.
8. Add RAG chunked JSON/NDJSON.
9. Add annotation/provenance formats.
10. Add EPUB/PPTX/SVG if demand appears.

## Format Picker UX

Group formats in the UI:

- Quick: MD, JSON, PDF, PNG, TXT
- Data: CSV, TSV, JSONL
- AI/RAG: Chunked JSON, NDJSON, ChatML
- Office: DOCX, XLSX, RTF
- Web: HTML, ZIP
- Audit: Provenance, Annotation JSON-LD

Avoid showing every format in the compact floating modal. The floating modal should show 4-6 common options and a "More formats" link to Manager/Export Settings.
