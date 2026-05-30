const EXPORT_AI_SIGNATURE =
  "Exported with ExportAI Free - upgrade to Pro to remove this signature.";
const FLOATING_POSITION_KEY = "exportai.floatingPosition";
const HIDDEN_HOSTS_KEY = "exportai.hiddenHosts";
const EXPORT_FORMATS = [
  { id: "markdown", label: "MD" },
  { id: "json", label: "{}" },
  { id: "pdf", label: "PDF" },
  { id: "png", label: "PNG" },
  { id: "txt", label: "TXT" },
  { id: "csv", label: "CSV" },
  { id: "tsv", label: "TSV" },
  { id: "jsonl", label: "JL" },
  { id: "html", label: "HTML" },
  { id: "word", label: "DOC" }
];

let floatingRoot;
let floatingMount;
let suppressNextFabClick = false;
let adapterOverrides = null;
let floatingState = {
  open: false,
  busy: false,
  selectedFormats: new Set(["markdown"]),
  includeMeta: true,
  activePresetId: "custom",
  presets: [],
  settings: null,
  summary: null,
  plan: null
};

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleContentMessage(message)
    .then((result) => sendResponse(result))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error.message,
        diagnostic: error.diagnostic || collectDiagnostic("CONTENT_ERROR", error.message)
      })
    );

  return true;
});

initFloatingUi();
loadAdapterOverrides();

async function handleContentMessage(message) {
  switch (message?.type) {
    case "EXPORT_AI_PING":
      return { ok: true };
    case "EXPORT_AI_GET_PAGE_SUMMARY":
      return { ok: true, summary: collectSummary() };
    case "EXPORT_AI_OPEN_FLOATING":
      await showFloating(true);
      return { ok: true };
    case "EXPORT_AI_RUN_TASK":
      return runExportTask(message.task, message.plan);
    case "EXPORT_AI_CONVERSATION":
      return runLegacyExport(message);
    default:
      return { ok: false, error: "Unknown content message." };
  }
}

async function runLegacyExport(message) {
  const summary = collectSummary();
  const response = await chrome.runtime.sendMessage({
    type: "EXPORT_AI_CREATE_TASK",
    tabId: null,
    platform: summary.platform,
    platformName: summary.platformName,
    title: summary.title,
    sourceUrl: location.href,
    formats: [message.format || "markdown"],
    includeMeta: message.includeMeta !== false
  });
  return response;
}

async function runExportTask(task, plan) {
  await reportProgress(task.id, 15, "capture");
  const conversation = collectConversation(task.includeMeta, task.exportOptions || {});

  if (!conversation.messages.length) {
    if (task.exportOptions?.enableFallbackExport !== false) {
      const fallbackConversation = collectFallbackConversation(task.includeMeta, task.exportOptions || {});
      if (fallbackConversation.messages.length) {
        fallbackConversation.diagnostic = collectDiagnostic(
          "NO_MESSAGES_FOUND_FALLBACK_USED",
          "Không tìm thấy message node chuẩn, đã dùng raw text fallback."
        );
        return renderConversationTask(task, plan, fallbackConversation);
      }
    }

    const error = new Error("Không tìm thấy nội dung hội thoại trên trang này.");
    error.diagnostic = collectDiagnostic("NO_MESSAGES_FOUND", error.message);
    throw error;
  }

  if (conversation.messages.length < 2) {
    conversation.diagnostic = collectDiagnostic(
      "PARTIAL_CAPTURE",
      "Số message tìm được thấp, có thể DOM nền tảng đã thay đổi."
    );
  }

  return renderConversationTask(task, plan, conversation);
}

async function renderConversationTask(task, plan, conversation) {
  const outputFiles = [];
  await reportProgress(task.id, 35, "render");

  for (const format of task.formats) {
    const filename = buildFilename(conversation, format);
    if (format === "pdf") {
      openPrintablePdf(conversation, task.includeSignature);
      outputFiles.push(`${filename}.pdf`);
      continue;
    }

    if (format === "png") {
      const url = await renderPngDataUrl(conversation, task.includeSignature);
      await download(url, `${filename}.png`);
      outputFiles.push(`${filename}.png`);
      continue;
    }

    const file = renderTextExport(conversation, format, task.includeSignature);
    await download(toDataUrl(file.text, `${file.mime};charset=utf-8`), `${filename}.${file.extension}`);
    outputFiles.push(`${filename}.${file.extension}`);
  }

  await reportProgress(task.id, 90, "download");
  updateFloatingStatus("Export completed", "success");
  return { ok: true, outputFiles, plan, conversation, diagnostic: conversation.diagnostic };
}

function collectSummary() {
  const platform = detectPlatform();
  const title = getConversationTitle();
  const messages = extractMessages(platform);
  const roleCounts = countRoles(messages);

  return {
    platform: platform.id,
    platformName: platform.name,
    title,
    messageCount: messages.length,
    userMessageCount: roleCounts.user,
    assistantMessageCount: roleCounts.assistant,
    sourceUrl: location.href,
    supported: platform.id !== "generic"
  };
}

function collectConversation(includeMeta, exportOptions = {}) {
  const platform = detectPlatform();
  const title = getConversationTitle();
  const messages = extractMessages(platform, exportOptions);
  const capturedAt = new Date().toISOString();
  const assets = messages.flatMap((message) =>
    message.assets.map((asset) => ({
      ...asset,
      messageId: message.id,
      messageOrder: message.position.order,
      role: message.role
    }))
  );

  return {
    schemaVersion: 1,
    conversationId: `${platform.id}:${hashString(location.href)}`,
    platform: platform.id,
    platformName: platform.name,
    title,
    url: location.href,
    capturedAt,
    meta: includeMeta
      ? {
          title,
          platform: platform.name,
          url: location.href,
          exportedAt: capturedAt
        }
      : undefined,
    messages,
    assets: exportOptions.includeAssets === false ? [] : assets
  };
}

function collectFallbackConversation(includeMeta, exportOptions = {}) {
  const platform = detectPlatform();
  const title = getConversationTitle();
  const capturedAt = new Date().toISOString();
  const root = document.querySelector("main") || document.body;
  const content = cleanMarkdown(root?.innerText || "");
  if (content.length < 40) {
    return {
      schemaVersion: 1,
      conversationId: `${platform.id}:${hashString(`${location.href}:fallback`)}`,
      platform: platform.id,
      platformName: platform.name,
      title,
      url: location.href,
      capturedAt,
      messages: [],
      assets: []
    };
  }

  const assets = exportOptions.includeAssets === false ? [] : extractMessageAssets(root, content);
  const message = {
    id: "m_fallback_1",
    role: "assistant",
    roleConfidence: "low",
    roleSource: "fallback-main-innerText",
    content,
    contentType: "markdown",
    assets,
    position: {
      index: 0,
      order: 1,
      selector: "main.innerText fallback",
      rect: getNodeRect(root),
      textHash: hashString(content)
    },
    createdAt: null,
    metadata: {
      tagName: root.tagName.toLowerCase(),
      contentRoot: describeContentRoot(root),
      roleReason: "Fallback raw text export because normal selectors returned no messages."
    }
  };

  return {
    schemaVersion: 1,
    conversationId: `${platform.id}:${hashString(`${location.href}:fallback`)}`,
    platform: platform.id,
    platformName: platform.name,
    title,
    url: location.href,
    capturedAt,
    meta: includeMeta
      ? {
          title,
          platform: platform.name,
          url: location.href,
          exportedAt: capturedAt,
          fallback: true
        }
      : undefined,
    messages: [message],
    assets
  };
}

function collectDiagnostic(errorType, errorMessage) {
  const platform = detectPlatform();
  const selectorResults = {};
  const selectors = [
    ...new Set([
      ...(platform.selectors || []),
      "main",
      "article",
      '[role="article"]',
      ".markdown",
      "pre code",
      "a[href]",
      "img"
    ])
  ];

  selectors.forEach((selector) => {
    try {
      selectorResults[selector] = document.querySelectorAll(selector).length;
    } catch {
      selectorResults[selector] = -1;
    }
  });

  return {
    schemaVersion: 1,
    platform: platform.id,
    platformName: platform.name,
    urlHost: location.hostname,
    sourceUrl: location.href,
    errorType,
    errorMessage,
    capturedAt: new Date().toISOString(),
    adapter: {
      version: platform.adapterVersion || "unknown",
      status: platform.adapterStatus || "local",
      selectors: platform.selectors || [],
      selectorGroups: platform.selectorGroups || []
    },
    selectorResults,
    domSignature: collectDomSignature(),
    sampleHtml: collectSanitizedHtmlSample()
  };
}

function collectDomSignature() {
  const tagCounts = {};
  const classCounts = {};
  const attributeCounts = {};
  const nodes = [...document.querySelectorAll("main, article, section, div, p, pre, code, a, img")].slice(0, 1000);

  nodes.forEach((node) => {
    const tag = node.tagName.toLowerCase();
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;

    String(node.className || "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 8)
      .forEach((className) => {
        classCounts[className] = (classCounts[className] || 0) + 1;
      });

    [...node.attributes].slice(0, 12).forEach((attribute) => {
      attributeCounts[attribute.name] = (attributeCounts[attribute.name] || 0) + 1;
    });
  });

  return {
    tagCounts,
    classTokens: topEntries(classCounts, 40),
    attributes: topEntries(attributeCounts, 40),
    title: cleanText(document.title || ""),
    bodyTextLength: cleanText(document.body?.innerText || "").length
  };
}

function collectSanitizedHtmlSample() {
  const root = document.querySelector("main") || document.body;
  if (!root) return "";

  const clone = root.cloneNode(true);
  clone.querySelectorAll("script, style, svg, canvas, img, video, audio").forEach((node) => node.remove());
  clone.querySelectorAll("*").forEach((node) => {
    [...node.attributes].forEach((attribute) => {
      if (!["class", "data-testid", "role", "aria-label", "dir"].includes(attribute.name)) {
        node.removeAttribute(attribute.name);
      }
    });
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        child.textContent = redactText(child.textContent || "");
      }
    });
  });

  return clone.outerHTML.slice(0, 12000);
}

function redactText(value) {
  return String(value || "")
    .replace(/[A-Za-zÀ-ỹ0-9]{3,}/g, "[text]")
    .replace(/\s{2,}/g, " ");
}

function detectPlatform() {
  const platform = ExportAIPlatforms.detectPlatformFromHost(location.hostname);
  const override = adapterOverrides?.find((adapter) => adapter.id === platform.id);
  if (!override || override.status !== "override") return platform;

  return {
    ...platform,
    adapterVersion: override.version || platform.adapterVersion,
    adapterStatus: override.status,
    selectors: override.selectors || platform.selectors,
    selectorGroups: override.selectorGroups || platform.selectorGroups
  };
}

async function loadAdapterOverrides() {
  try {
    const response = await chrome.runtime.sendMessage({ type: "EXPORT_AI_GET_ADAPTERS" });
    adapterOverrides = response?.adapters || null;
  } catch {
    adapterOverrides = null;
  }
}

function extractMessages(platform, exportOptions = {}) {
  const candidates = selectMessageCandidates(platform);

  const messages = candidates
    .map((candidate, index) => normalizeMessage(candidate, index, platform, exportOptions))
    .filter((message) => message.content.length > 0);

  return mergeAdjacentDuplicates(messages);
}

function selectMessageCandidates(platform) {
  const selectorGroups = (platform.selectorGroups || platform.selectors.map((selector) => [selector])).map((selectors) => {
    const nodes = uniqueElements(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]));
    return {
      selector: selectors.join(", "),
      nodes: sortNodesByDocumentPosition(nodes),
      score: scoreSelectorGroup(nodes)
    };
  });

  const bestGroup = selectorGroups
    .filter((group) => group.nodes.length > 0)
    .sort((a, b) => b.score - a.score)[0];

  const nodes =
    bestGroup && bestGroup.nodes.length >= 2
      ? bestGroup.nodes
      : sortNodesByDocumentPosition(
          uniqueElements(platform.selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))
        );
  const fallbackNodes = nodes.length ? nodes : getReadableFallbackNodes(platform);

  const selector = nodes.length
    ? bestGroup?.nodes.length >= 2
      ? bestGroup.selector
      : "combined-fallback"
    : "readable-main-fallback";

  const normalizedNodes = uniqueElements(fallbackNodes.map((node) => normalizeCandidateNode(node, platform)));
  const prunedNodes = pruneNestedCandidates(normalizedNodes, platform);

  return prunedNodes.map((node) => ({
    node,
    selector,
    rect: getNodeRect(node)
  }));
}

function normalizeCandidateNode(node, platform) {
  if (platform.id !== "grok") return node;

  const tag = node.tagName.toLowerCase();
  if (!["li", "p", "span"].includes(tag)) return node;

  return (
    node.closest('[data-testid*="conversation"]') ||
    node.closest('[data-testid*="message"]') ||
    node.closest('[data-testid*="response"]') ||
    node.closest('[class*="message"]') ||
    node.closest("article") ||
    node.closest("section") ||
    node.parentElement ||
    node
  );
}

function pruneNestedCandidates(nodes, platform) {
  if (platform.id !== "grok") return nodes;

  const uniqueNodes = uniqueElements(nodes);
  if (uniqueNodes.length < 3) return uniqueNodes;

  const textByNode = new Map(
    uniqueNodes.map((node) => [node, cleanText(node.innerText || node.textContent || "")])
  );

  const pruned = uniqueNodes.filter((node) => {
    const text = textByNode.get(node) || "";
    if (text.length < 12) return false;

    return !uniqueNodes.some((other) => {
      if (other === node) return false;

      const otherText = textByNode.get(other) || "";
      if (otherText.length <= text.length + 40) return false;

      if (other.contains(node)) return true;
      if (text.length >= 40 && otherText.includes(text)) return true;

      return false;
    });
  });

  return pruned.length >= 2 ? pruned : uniqueNodes;
}

function scoreSelectorGroup(nodes) {
  if (!nodes.length) return 0;

  const visibleNodes = uniqueElements(nodes);
  const uniqueTextCount = new Set(
    visibleNodes.map((node) => extractMessageContent(node).slice(0, 160))
  ).size;
  const averageTextLength =
    visibleNodes.reduce((total, node) => total + extractMessageContent(node).length, 0) /
    visibleNodes.length;

  return visibleNodes.length * 10 + uniqueTextCount * 6 + Math.min(averageTextLength, 800) / 80;
}

function getReadableFallbackNodes(platform) {
  const main = document.querySelector("main") || document.body;
  if (!main) return [];

  const candidates = [...main.querySelectorAll("article, section, [role='article'], div, p")]
    .filter((node) => isReadableMessageNode(node, platform))
    .filter((node, _index, nodes) => !hasReadableDescendant(node, nodes));

  return sortNodesByDocumentPosition(uniqueElements(candidates)).slice(0, 80);
}

function isReadableMessageNode(node, platform) {
  if (!node || node.offsetParent === null) return false;
  if (shouldSkipUiElement(node)) return false;
  if (platform.id === "grok" && ["li", "p", "span"].includes(node.tagName.toLowerCase())) return false;

  const text = cleanText(node.innerText || node.textContent || "");
  if (text.length < 12 || text.length > 12000) return false;
  if (/^(new chat|history|settings|upgrade|share|copy|retry|regenerate)$/i.test(text)) return false;

  const rect = node.getBoundingClientRect();
  if (rect.width < 120 || rect.height < 12) return false;

  if (platform.id === "grok") {
    const className = String(node.className || "");
    const testId = node.getAttribute("data-testid") || "";
    if (/prose|message|response|whitespace-pre-wrap/i.test(`${className} ${testId}`)) return true;
  }

  return text.split(/\s+/).length >= 4;
}

function hasReadableDescendant(node, nodes) {
  return nodes.some((candidate) => candidate !== node && node.contains(candidate));
}

function normalizeMessage(candidate, index, platform, exportOptions = {}) {
  const { node, selector, rect } = candidate;
  const contentRoot = findContentRoot(node);
  const roleResult = inferRole(node, index, platform);
  const content = applyContentOptions(extractMessageContent(node), exportOptions);
  const assets = exportOptions.includeAssets === false ? [] : extractMessageAssets(contentRoot, content);

  return {
    id: `m_${index + 1}`,
    role: roleResult.role,
    roleConfidence: roleResult.confidence,
    roleSource: roleResult.source,
    content,
    contentType: "markdown",
    assets,
    position: {
      index,
      order: index + 1,
      selector,
      rect,
      textHash: hashString(content)
    },
    createdAt: null,
    metadata: {
      tagName: node.tagName.toLowerCase(),
      contentRoot: describeContentRoot(contentRoot),
      roleReason: roleResult.reason
    }
  };
}

function extractMessageContent(node) {
  const contentRoot = findContentRoot(node);
  return cleanMarkdown(domToMarkdown(contentRoot));
}

function findContentRoot(node) {
  return (
    node.querySelector?.(".markdown") ||
    node.querySelector?.('[class*="markdown"]') ||
    node.querySelector?.('[class*="prose"]') ||
    node.querySelector?.('[class*="whitespace-pre-wrap"]') ||
    node.querySelector?.('[data-message-content]') ||
    node.querySelector?.('[data-testid="message-content"]') ||
    node
  );
}

function domToMarkdown(node) {
  if (!node) return "";
  if (node.nodeType === Node.TEXT_NODE) return node.textContent || "";
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const element = node;
  const tag = element.tagName.toLowerCase();

  if (shouldSkipUiElement(element)) return "";
  if (tag === "br") return "\n";
  if (tag === "table") return renderMarkdownTable(element);
  if (tag === "a") return renderMarkdownLink(element);
  if (tag === "img") return renderMarkdownImage(element);
  if (tag === "pre") return renderCodeBlock(element);
  if (tag === "code" && element.closest("pre")) return cleanCodeText(element.innerText || element.textContent || "");
  if (tag === "code") return `\`${cleanInlineCode(element.innerText || element.textContent || "")}\``;

  const children = [...element.childNodes].map(domToMarkdown).join("");

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1));
    return `\n\n${"#".repeat(level)} ${cleanText(children)}\n\n`;
  }

  if (tag === "li") {
    const parent = element.parentElement;
    if (parent?.tagName?.toLowerCase() === "ol") {
      const index = [...parent.children].filter((child) => child.tagName.toLowerCase() === "li").indexOf(element) + 1;
      return `\n${index}. ${cleanText(children)}`;
    }
    return `\n- ${cleanText(children)}`;
  }
  if (tag === "p") return `\n\n${children}\n\n`;
  if (tag === "blockquote") {
    return `\n\n${cleanText(children)
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n")}\n\n`;
  }
  if (["div", "section", "article", "main", "ul", "ol"].includes(tag)) {
    return `\n${children}\n`;
  }

  return children;
}

function renderMarkdownLink(anchor) {
  const href = toAbsoluteUrl(anchor.getAttribute("href"));
  const text = cleanText([...anchor.childNodes].map(domToMarkdown).join("")) || href;
  if (!href) return text;
  return `[${escapeMarkdownLinkText(text)}](${href})`;
}

function renderMarkdownImage(image) {
  const src = toAbsoluteUrl(image.currentSrc || image.getAttribute("src"));
  const alt = cleanText(image.getAttribute("alt") || image.getAttribute("aria-label") || "Image");
  if (!src) return alt;
  return `\n\n![${escapeMarkdownLinkText(alt)}](${src})\n\n`;
}

function renderCodeBlock(preElement) {
  const codeElement = preElement.querySelector("code") || preElement;
  const language = detectCodeLanguage(codeElement, preElement);
  const code = cleanCodeText(codeElement.innerText || codeElement.textContent || "");
  if (!code) return "";
  return `\n\n\`\`\`${language}\n${code}\n\`\`\`\n\n`;
}

function renderMarkdownTable(tableElement) {
  const rows = [...tableElement.querySelectorAll("tr")]
    .map((row) =>
      [...row.querySelectorAll("th,td")].map((cell) =>
        cleanText([...cell.childNodes].map(domToMarkdown).join(""))
      )
    )
    .filter((cells) => cells.length > 0);

  if (!rows.length) return "";

  const columnCount = Math.max(...rows.map((row) => row.length));
  const normalizedRows = rows.map((row) => {
    const nextRow = [...row];
    while (nextRow.length < columnCount) nextRow.push("");
    return nextRow;
  });
  const header = normalizedRows[0];
  const body = normalizedRows.slice(1);
  const separator = Array.from({ length: columnCount }, () => "---");

  return `\n\n${[header, separator, ...body]
    .map((row) => `| ${row.map(escapeMarkdownTableCell).join(" | ")} |`)
    .join("\n")}\n\n`;
}

function detectCodeLanguage(codeElement, preElement) {
  const sources = [
    codeElement.getAttribute("class"),
    preElement.getAttribute("class"),
    codeElement.getAttribute("data-language"),
    preElement.getAttribute("data-language")
  ].filter(Boolean);
  const joined = sources.join(" ");
  const match = joined.match(/(?:language-|lang-)([a-z0-9+#.-]+)/i);
  return match ? match[1].toLowerCase() : "";
}

function shouldSkipUiElement(element) {
  const tag = element.tagName.toLowerCase();
  const ariaLabel = element.getAttribute("aria-label") || "";
  const text = cleanText(element.innerText || element.textContent || "");

  if (["button", "svg"].includes(tag)) return true;
  if (/copy|copied|sao chép|share|regenerate/i.test(ariaLabel)) return true;
  if (/^(copy|copied|copy code|sao chép|share|regenerate)$/i.test(text)) return true;

  return false;
}

function describeContentRoot(node) {
  if (!node) return "unknown";
  const tag = node.tagName.toLowerCase();
  const className = String(node.className || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .join(".");
  return className ? `${tag}.${className}` : tag;
}

function extractMessageAssets(root, content) {
  const assets = [];
  const seen = new Set();

  root.querySelectorAll?.("a[href]").forEach((anchor) => {
    const href = toAbsoluteUrl(anchor.getAttribute("href"));
    if (!href || seen.has(`link:${href}`) || shouldSkipUiElement(anchor)) return;
    seen.add(`link:${href}`);
    assets.push({
      id: `asset_${assets.length + 1}`,
      type: "link",
      url: href,
      title: cleanText(anchor.innerText || anchor.textContent || href),
      alt: "",
      mimeType: "",
      source: "anchor"
    });
  });

  root.querySelectorAll?.("img").forEach((image) => {
    const src = toAbsoluteUrl(image.currentSrc || image.getAttribute("src"));
    if (!src || seen.has(`image:${src}`)) return;
    seen.add(`image:${src}`);
    assets.push({
      id: `asset_${assets.length + 1}`,
      type: "image",
      url: src,
      title: cleanText(image.getAttribute("title") || image.getAttribute("alt") || "Image"),
      alt: cleanText(image.getAttribute("alt") || ""),
      mimeType: inferMimeTypeFromUrl(src),
      width: image.naturalWidth || null,
      height: image.naturalHeight || null,
      source: "img"
    });
  });

  detectFileHints(content).forEach((fileName) => {
    const key = `file:${fileName}`;
    if (seen.has(key)) return;
    seen.add(key);
    assets.push({
      id: `asset_${assets.length + 1}`,
      type: "file",
      url: "",
      title: fileName,
      alt: "",
      mimeType: inferMimeTypeFromFileName(fileName),
      source: "text-hint"
    });
  });

  return assets;
}

function detectFileHints(content) {
  const lines = content.split("\n").map(cleanText).filter(Boolean);
  const filePattern = /^[\w .()[\]-]+\.(md|txt|pdf|docx?|xlsx?|csv|tsv|jsonl?|yaml|yml|png|jpe?g|webp|zip|pptx?|rtf)$/i;
  const hints = [];

  lines.forEach((line, index) => {
    if (!filePattern.test(line)) return;
    const nextLine = lines[index + 1] || "";
    if (/^(tệp|file|attachment|attached)$/i.test(nextLine) || index < 2) {
      hints.push(line);
    }
  });

  return hints;
}

function inferRole(node, index, platform) {
  const explicitRole =
    node.getAttribute("data-message-author-role") ||
    node.getAttribute("data-author") ||
    node.getAttribute("aria-label") ||
    "";

  if (platform.roleHints.user.test(explicitRole)) {
    return {
      role: "user",
      confidence: 0.98,
      source: "attribute",
      reason: `Matched user role hint from "${explicitRole}".`
    };
  }
  if (platform.roleHints.assistant.test(explicitRole)) {
    return {
      role: "assistant",
      confidence: 0.98,
      source: "attribute",
      reason: `Matched assistant role hint from "${explicitRole}".`
    };
  }

  const tag = node.tagName.toLowerCase();
  const className = String(node.className || "");
  const testId = node.getAttribute("data-testid") || "";
  const roleContext = `${className} ${testId} ${node.getAttribute("data-author") || ""}`;
  if (platform.id === "grok") {
    if (/user|human|prompt|query/i.test(roleContext)) {
      return {
        role: "user",
        confidence: 0.78,
        source: "grok-class",
        reason: "Grok class/test id matched user-like hint."
      };
    }
    if (/assistant|grok|response|answer|model/i.test(roleContext)) {
      return {
        role: "assistant",
        confidence: 0.78,
        source: "grok-class",
        reason: "Grok class/test id matched assistant-like hint."
      };
    }
  }
  if (platform.id === "gemini") {
    if (tag === "user-query" || /query/i.test(className)) {
      return {
        role: "user",
        confidence: 0.92,
        source: "platform-tag",
        reason: "Gemini user query tag/class matched."
      };
    }
    if (tag === "model-response" || /response/i.test(className)) {
      return {
        role: "assistant",
        confidence: 0.92,
        source: "platform-tag",
        reason: "Gemini model response tag/class matched."
      };
    }
  }
  if (platform.id === "perplexity") {
    if (/query|question|prompt|user/i.test(roleContext)) {
      return {
        role: "user",
        confidence: 0.82,
        source: "perplexity-class",
        reason: "Perplexity class/test id matched user query hint."
      };
    }
    if (/answer|response|assistant|prose/i.test(roleContext)) {
      return {
        role: "assistant",
        confidence: 0.82,
        source: "perplexity-class",
        reason: "Perplexity class/test id matched answer hint."
      };
    }
  }
  if (["claude", "copilot", "devin", "lovable"].includes(platform.id)) {
    if (/user|human|prompt|query/i.test(roleContext)) {
      return {
        role: "user",
        confidence: 0.78,
        source: `${platform.id}-class`,
        reason: `${platform.name} class/test id matched user-like hint.`
      };
    }
    if (/assistant|agent|bot|response|answer|model|claude|copilot|devin|lovable/i.test(roleContext)) {
      return {
        role: "assistant",
        confidence: 0.78,
        source: `${platform.id}-class`,
        reason: `${platform.name} class/test id matched assistant-like hint.`
      };
    }
  }

  return {
    role: index % 2 === 0 ? "user" : "assistant",
    confidence: 0.55,
    source: "position-heuristic",
    reason: "Fallback alternating role by visual order."
  };
}

function mergeAdjacentDuplicates(messages) {
  const merged = [];

  for (const message of messages) {
    const previous = merged[merged.length - 1];
    if (previous && previous.role === message.role && previous.content === message.content) {
      continue;
    }
    merged.push(message);
  }

  return merged;
}

function countRoles(messages) {
  return messages.reduce(
    (counts, message) => ({
      ...counts,
      [message.role]: (counts[message.role] || 0) + 1
    }),
    { user: 0, assistant: 0 }
  );
}

function toMarkdown(conversation, includeSignature) {
  const lines = [];

  if (conversation.meta) {
    lines.push(`# ${conversation.title}`, "");
    lines.push(`- Platform: ${conversation.platformName}`);
    lines.push(`- URL: ${conversation.url}`);
    lines.push(`- Exported: ${new Date(conversation.capturedAt).toLocaleString()}`, "");
  }

  conversation.messages.forEach((message, index) => {
    lines.push(`## ${index + 1}. ${labelRole(message.role)}`, "");
    lines.push(message.content, "");
    appendMarkdownAssets(lines, message.assets);
  });

  if (includeSignature) {
    lines.push("---", EXPORT_AI_SIGNATURE, "");
  }

  return lines.join("\n").trim() + "\n";
}

function appendMarkdownAssets(lines, assets) {
  if (!assets.length) return;

  lines.push("### Assets", "");
  assets.forEach((asset) => {
    if (asset.type === "image" && asset.url) {
      lines.push(`- Image: ![${escapeMarkdownLinkText(asset.alt || asset.title || "Image")}](${asset.url})`);
      return;
    }
    if (asset.url) {
      lines.push(`- ${titleCase(asset.type)}: [${escapeMarkdownLinkText(asset.title || asset.url)}](${asset.url})`);
      return;
    }
    lines.push(`- ${titleCase(asset.type)}: ${asset.title}`);
  });
  lines.push("");
}

function appendPlainTextAssets(lines, assets) {
  if (!assets.length) return;

  lines.push("Assets:");
  assets.forEach((asset) => {
    lines.push(`- ${titleCase(asset.type)}: ${formatAssetText(asset)}`);
  });
}

function renderTextExport(conversation, format, includeSignature) {
  const renderers = {
    markdown: () => ({
      text: toMarkdown(conversation, includeSignature),
      mime: "text/markdown",
      extension: "md"
    }),
    json: () => ({
      text: JSON.stringify(toJsonExport(conversation, includeSignature), null, 2),
      mime: "application/json",
      extension: "json"
    }),
    txt: () => ({
      text: toPlainText(conversation, includeSignature),
      mime: "text/plain",
      extension: "txt"
    }),
    csv: () => ({
      text: toDelimited(conversation, ",", includeSignature),
      mime: "text/csv",
      extension: "csv"
    }),
    tsv: () => ({
      text: toDelimited(conversation, "\t", includeSignature),
      mime: "text/tab-separated-values",
      extension: "tsv"
    }),
    jsonl: () => ({
      text: toJsonl(conversation, includeSignature),
      mime: "application/x-ndjson",
      extension: "jsonl"
    }),
    html: () => ({
      text: toHtmlDocument(conversation, includeSignature),
      mime: "text/html",
      extension: "html"
    }),
    word: () => ({
      text: toWordDocument(conversation, includeSignature),
      mime: "application/msword",
      extension: "doc"
    })
  };

  const renderer = renderers[format] || renderers.markdown;
  return renderer();
}

function toWordDocument(conversation, includeSignature) {
  return toHtmlDocument(conversation, includeSignature)
    .replace("<html lang=\"vi\">", '<html lang="vi" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">')
    .replace(
      "<head>",
      `<head>
  <meta name="ProgId" content="Word.Document">
  <meta name="Generator" content="ExportAI">`
    );
}

function toPlainText(conversation, includeSignature) {
  const lines = [];

  lines.push(conversation.title);
  lines.push(`Platform: ${conversation.platformName}`);
  lines.push(`URL: ${conversation.url}`);
  lines.push(`Exported: ${new Date(conversation.capturedAt).toLocaleString()}`);
  lines.push("");

  conversation.messages.forEach((message, index) => {
    lines.push(`${index + 1}. ${labelRole(message.role)}`);
    lines.push(message.content);
    appendPlainTextAssets(lines, message.assets);
    lines.push("");
  });

  if (includeSignature) {
    lines.push("---");
    lines.push(EXPORT_AI_SIGNATURE);
  }

  return lines.join("\n").trim() + "\n";
}

function toDelimited(conversation, delimiter, includeSignature) {
  const headers = [
    "conversation_id",
    "platform",
    "title",
    "url",
    "message_order",
    "role",
    "role_confidence",
    "role_source",
    "content",
    "asset_count",
    "links",
    "images",
    "files",
    "selector",
    "top",
    "left",
    "content_hash"
  ];
  const rows = conversation.messages.map((message) => [
    conversation.conversationId,
    conversation.platformName,
    conversation.title,
    conversation.url,
    message.position.order,
    message.role,
    message.roleConfidence,
    message.roleSource,
    message.content,
    message.assets.length,
    message.assets.filter((asset) => asset.type === "link").map(formatAssetText).join(" | "),
    message.assets.filter((asset) => asset.type === "image").map(formatAssetText).join(" | "),
    message.assets.filter((asset) => asset.type === "file").map(formatAssetText).join(" | "),
    message.position.selector,
    message.position.rect.top,
    message.position.rect.left,
    message.position.textHash
  ]);

  if (includeSignature) {
    rows.push([
      conversation.conversationId,
      conversation.platformName,
      conversation.title,
      conversation.url,
      "",
      "meta",
      "",
      "signature",
      EXPORT_AI_SIGNATURE,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
    ]);
  }

  return [headers, ...rows].map((row) => row.map((value) => escapeDelimited(value, delimiter)).join(delimiter)).join("\n") + "\n";
}

function toJsonl(conversation, includeSignature) {
  const records = conversation.messages.map((message) =>
    JSON.stringify({
      schemaVersion: 1,
      conversationId: conversation.conversationId,
      platform: conversation.platform,
      platformName: conversation.platformName,
      title: conversation.title,
      url: conversation.url,
      capturedAt: conversation.capturedAt,
      message
    })
  );

  if (includeSignature) {
    records.push(
      JSON.stringify({
        schemaVersion: 1,
        conversationId: conversation.conversationId,
        type: "signature",
        content: EXPORT_AI_SIGNATURE
      })
    );
  }

  return records.join("\n") + "\n";
}

function toHtmlDocument(conversation, includeSignature) {
  const meta = conversation.meta
    ? `<div class="meta">${escapeHtml(conversation.platformName)} · ${escapeHtml(conversation.url)} · ${escapeHtml(new Date(conversation.capturedAt).toLocaleString())}</div>`
    : "";
  const signature = includeSignature ? `<footer>${escapeHtml(EXPORT_AI_SIGNATURE)}</footer>` : "";

  return `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(conversation.title)}</title>
  <style>
    body { margin: 40px; color: #151a18; background: #fbfcfa; font-family: Arial, sans-serif; line-height: 1.58; }
    main { max-width: 920px; margin: 0 auto; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    .meta { color: #607068; font-size: 13px; margin-bottom: 24px; }
    article { border-top: 1px solid #dfe5e1; padding: 18px 0; }
    .role { color: #17694c; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    pre { overflow: auto; padding: 12px; border-radius: 8px; background: #101816; color: #f2f7f4; }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .content { white-space: pre-wrap; }
    .content img, .assets img { display: block; max-width: 100%; height: auto; margin: 12px 0; border-radius: 8px; }
    .assets { margin-top: 12px; padding: 12px; border-radius: 8px; background: #eef5f1; }
    .assets strong { display: block; margin-bottom: 6px; font-size: 13px; }
    .assets ul { margin: 0; padding-left: 18px; }
    a { color: #17694c; }
    footer { margin-top: 28px; border-top: 1px solid #dfe5e1; padding-top: 12px; color: #68756f; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(conversation.title)}</h1>
    ${meta}
    ${conversation.messages
      .map(
        (message) => `<article data-role="${escapeHtml(message.role)}" data-message-id="${escapeHtml(message.id)}">
          <div class="role">${escapeHtml(labelRole(message.role))}</div>
          <div class="content">${markdownLikeToHtml(message.content)}</div>
          ${renderHtmlAssets(message.assets)}
        </article>`
      )
      .join("")}
    ${signature}
  </main>
</body>
</html>`;
}

function renderHtmlAssets(assets) {
  if (!assets.length) return "";

  return `<aside class="assets">
    <strong>Assets</strong>
    <ul>
      ${assets
        .map((asset) => {
          if (asset.type === "image" && asset.url) {
            return `<li>Image: <a href="${escapeHtml(asset.url)}">${escapeHtml(asset.title || asset.url)}</a><img src="${escapeHtml(asset.url)}" alt="${escapeHtml(asset.alt || asset.title || "Image")}"></li>`;
          }
          if (asset.url) {
            return `<li>${escapeHtml(titleCase(asset.type))}: <a href="${escapeHtml(asset.url)}">${escapeHtml(asset.title || asset.url)}</a></li>`;
          }
          return `<li>${escapeHtml(titleCase(asset.type))}: ${escapeHtml(asset.title)}</li>`;
        })
        .join("")}
    </ul>
  </aside>`;
}

function toJsonExport(conversation, includeSignature) {
  const json = {
    ...conversation,
    meta: {
      ...(conversation.meta || {}),
      signature: includeSignature ? "Exported with ExportAI Free" : undefined,
      proRequiredToRemoveSignature: includeSignature
    }
  };

  if (!includeSignature) {
    delete json.meta.signature;
  }

  return json;
}

function openPrintablePdf(conversation, includeSignature) {
  const footer = includeSignature
    ? `<footer>${escapeHtml(EXPORT_AI_SIGNATURE)}</footer>`
    : "";
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(conversation.title)}</title>
  <style>
    body { color: #151a18; font-family: Arial, sans-serif; line-height: 1.55; margin: 40px; }
    h1 { font-size: 24px; margin: 0 0 8px; }
    .meta { color: #58645f; font-size: 12px; margin-bottom: 24px; }
    .message { break-inside: avoid; border-top: 1px solid #dfe5e1; padding: 16px 0; }
    .role { color: #17694c; font-size: 12px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; }
    pre { white-space: pre-wrap; word-wrap: break-word; font-family: inherit; margin: 8px 0 0; }
    footer { border-top: 1px solid #dfe5e1; color: #68756f; font-size: 11px; margin-top: 28px; padding-top: 12px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(conversation.title)}</h1>
  ${
    conversation.meta
      ? `<div class="meta">${escapeHtml(conversation.platformName)} | ${escapeHtml(conversation.url)} | ${escapeHtml(new Date(conversation.capturedAt).toLocaleString())}</div>`
      : ""
  }
  ${conversation.messages
    .map(
      (message) => `<section class="message">
        <div class="role">${escapeHtml(labelRole(message.role))}</div>
        <pre>${escapeHtml(message.content)}</pre>
      </section>`
    )
    .join("")}
  ${footer}
  <script>window.addEventListener("load", () => setTimeout(() => window.print(), 250));</script>
</body>
</html>`;

  window.open(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`, "_blank");
}

async function renderPngDataUrl(conversation, includeSignature) {
  const width = 1200;
  const padding = 48;
  const lineHeight = 28;
  const titleHeight = 86;
  const signatureHeight = includeSignature ? 44 : 0;
  const lines = conversation.messages.flatMap((message) => [
    { text: labelRole(message.role).toUpperCase(), role: true },
    ...wrapText(message.content, 82).map((text) => ({ text })),
    { text: "" }
  ]);
  const height = Math.max(420, titleHeight + padding * 2 + signatureHeight + lines.length * lineHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  context.fillStyle = "#f7f8f4";
  context.fillRect(0, 0, width, height);
  context.fillStyle = "#15201c";
  context.font = "700 32px Arial";
  context.fillText(conversation.title.slice(0, 58), padding, padding + 16);
  context.font = "14px Arial";
  context.fillStyle = "#58645f";
  context.fillText(`${conversation.platformName} | ${new Date(conversation.capturedAt).toLocaleString()}`, padding, padding + 46);

  let y = padding + titleHeight;
  for (const line of lines) {
    context.font = line.role ? "700 18px Arial" : "18px Arial";
    context.fillStyle = line.role ? "#17694c" : "#16201c";
    context.fillText(line.text, padding, y);
    y += line.role ? 32 : lineHeight;
  }

  if (includeSignature) {
    context.font = "14px Arial";
    context.fillStyle = "#68756f";
    context.fillText("ExportAI Free", width - 160, height - 28);
  }

  return canvas.toDataURL("image/png");
}

async function initFloatingUi() {
  if (!document.documentElement) {
    window.setTimeout(initFloatingUi, 250);
    return;
  }

  const hiddenHosts = await getStored(HIDDEN_HOSTS_KEY, []);
  if (hiddenHosts.includes(location.hostname)) return;

  if (document.getElementById("exportai-floating-root")) {
    floatingRoot = document.getElementById("exportai-floating-root");
    floatingMount = floatingRoot.shadowRoot || floatingRoot;
    return;
  }

  floatingRoot = document.createElement("div");
  floatingRoot.id = "exportai-floating-root";
  floatingRoot.style.setProperty("all", "initial");
  document.documentElement.appendChild(floatingRoot);
  floatingMount = floatingRoot.attachShadow({ mode: "open" });
  renderFloating();
}

async function showFloating(open) {
  if (!floatingRoot) await initFloatingUi();
  floatingState.open = open;
  floatingState.summary = collectSummary();
  const [plan, presets, settings] = await Promise.all([getPlan(), getPresets(), getSettings()]);
  floatingState.plan = plan;
  floatingState.presets = presets;
  floatingState.settings = settings;
  floatingState.includeMeta = settings?.includeMetaDefault !== false;
  if (floatingState.activePresetId === "custom" && presets.length) {
    applyFloatingPreset(presets.find((preset) => preset.id === settings?.defaultPresetId) || presets.find((preset) => preset.id === "ai_archive") || presets[0], false);
  }
  renderFloating();
}

function renderFloating() {
  if (!floatingMount) return;

  const summary = floatingState.summary || collectSummary();
  const plan = floatingState.plan;
  const remaining = plan
    ? Math.max(0, plan.quota.dailyLimit - plan.quota.dailyUsed)
    : null;
  const modal = floatingState.open
    ? `<section class="exportai-modal" data-role="modal">
        <header>
          <div>
            <strong>ExportAI</strong>
            <span>${escapeHtml(summary.platformName)} · ${summary.userMessageCount} user / ${summary.assistantMessageCount} AI</span>
          </div>
          <div class="exportai-window-actions">
            <button type="button" data-action="minimize" title="Minimize">_</button>
            <button type="button" data-action="close" title="Close">x</button>
          </div>
        </header>
        <div class="exportai-title">${escapeHtml(summary.title)}</div>
        <div class="exportai-formats">
          ${EXPORT_FORMATS.map((format) => formatButton(format.id, format.label)).join("")}
        </div>
        <label class="exportai-field">
          <span>Preset</span>
          <select data-action="preset">
            <option value="custom">Custom formats</option>
            ${floatingState.presets
              .map(
                (preset) =>
                  `<option value="${escapeHtml(preset.id)}" ${floatingState.activePresetId === preset.id ? "selected" : ""}>${escapeHtml(preset.name)}</option>`
              )
              .join("")}
          </select>
        </label>
        <label class="exportai-check">
          <input type="checkbox" data-action="toggle-meta" ${floatingState.includeMeta ? "checked" : ""}>
          <span>Metadata</span>
        </label>
        <div class="exportai-lock">Signature: ExportAI Free · locked</div>
        <div class="exportai-quota">${remaining === null ? "Loading quota..." : `Free plan: còn ${remaining}/${plan.quota.dailyLimit} exports hôm nay`}</div>
        <div class="exportai-status" data-role="status">Sẵn sàng export.</div>
        <div class="exportai-actions">
          <button type="button" data-action="export-now">Export now</button>
          <button type="button" data-action="create-task">Create task</button>
          <button type="button" data-action="manager">Manager</button>
        </div>
      </section>`
    : "";

  floatingMount.innerHTML = `<style>${floatingCss()}</style>
    <div class="exportai-wrap">
      <button class="exportai-fab" type="button" data-action="toggle" title="Export conversation">⇩AI</button>
    </div>`;
  if (modal) floatingMount.innerHTML += modal;

  restoreFloatingPosition();
  placeFloatingModal();
  wireFloatingEvents();
}

function formatButton(format, label) {
  const active = floatingState.selectedFormats.has(format);
  return `<button type="button" class="${active ? "active" : ""}" data-format="${format}">${label}</button>`;
}

function wireFloatingEvents() {
  const wrap = floatingMount.querySelector(".exportai-wrap");
  floatingMount.querySelector('[data-action="toggle"]')?.addEventListener("click", (event) => {
    if (suppressNextFabClick) {
      event.preventDefault();
      event.stopPropagation();
      suppressNextFabClick = false;
      return;
    }
    showFloating(!floatingState.open);
  });
  floatingMount.querySelector('[data-action="minimize"]')?.addEventListener("click", () => {
    floatingState.open = false;
    renderFloating();
  });
  floatingMount.querySelector('[data-action="close"]')?.addEventListener("click", () => {
    floatingState.open = false;
    renderFloating();
  });
  floatingMount.querySelector('[data-action="manager"]')?.addEventListener("click", () => {
    chrome.runtime.sendMessage({ type: "EXPORT_AI_OPEN_MANAGER" });
  });
  floatingMount.querySelector('[data-action="toggle-meta"]')?.addEventListener("change", (event) => {
    floatingState.includeMeta = event.currentTarget.checked;
  });
  floatingMount.querySelector('[data-action="preset"]')?.addEventListener("change", (event) => {
    const presetId = event.currentTarget.value;
    const preset = floatingState.presets.find((item) => item.id === presetId);
    if (!preset) {
      floatingState.activePresetId = "custom";
      return;
    }
    applyFloatingPreset(preset);
  });
  floatingMount.querySelectorAll("[data-format]").forEach((button) => {
    button.addEventListener("click", () => {
      const format = button.dataset.format;
      if (floatingState.selectedFormats.has(format)) {
        floatingState.selectedFormats.delete(format);
      } else {
        floatingState.selectedFormats.add(format);
      }
      if (!floatingState.selectedFormats.size) floatingState.selectedFormats.add("markdown");
      floatingState.activePresetId = "custom";
      renderFloating();
    });
  });
  floatingMount.querySelector('[data-action="export-now"]')?.addEventListener("click", () => createTaskFromFloating(true));
  floatingMount.querySelector('[data-action="create-task"]')?.addEventListener("click", () => createTaskFromFloating(false));
  enableDrag(wrap);
}

async function createTaskFromFloating(runNow) {
  const summary = collectSummary();
  updateFloatingStatus(runNow ? "Đang tạo task export..." : "Đang lưu task...");
  const response = await chrome.runtime.sendMessage({
    type: "EXPORT_AI_CREATE_TASK",
    platform: summary.platform,
    platformName: summary.platformName,
    title: summary.title,
    sourceUrl: location.href,
    formats: [...floatingState.selectedFormats],
    includeMeta: floatingState.includeMeta,
    exportOptions: {
      includeAssets: floatingState.settings?.includeAssets !== false,
      removeUiWrappers: floatingState.settings?.removeUiWrappers !== false,
      removeToolFailureNotices: floatingState.settings?.removeToolFailureNotices === true
    },
    presetId: floatingState.activePresetId,
    runNow
  });

  if (!response?.ok) {
    updateFloatingStatus(response?.error || "Không tạo được task.", "error");
    return;
  }

  floatingState.plan = response.plan;
  updateFloatingStatus("Task đã được tạo.", "success");
}

function updateFloatingStatus(text, tone = "normal") {
  const status = floatingMount?.querySelector('[data-role="status"]');
  if (!status) return;
  status.textContent = text;
  status.dataset.tone = tone;
}

async function getPlan() {
  const response = await chrome.runtime.sendMessage({ type: "EXPORT_AI_GET_PLAN" });
  return response?.plan || null;
}

async function getPresets() {
  const response = await chrome.runtime.sendMessage({ type: "EXPORT_AI_GET_PRESETS" });
  return response?.presets || [];
}

async function getSettings() {
  const response = await chrome.runtime.sendMessage({ type: "EXPORT_AI_GET_SETTINGS" });
  return response?.settings || null;
}

function applyFloatingPreset(preset, shouldRender = true) {
  floatingState.activePresetId = preset.id;
  floatingState.selectedFormats = new Set(preset.formats);
  floatingState.includeMeta = preset.includeMeta !== false;
  if (shouldRender) renderFloating();
}

async function reportProgress(taskId, progress, stepName) {
  await chrome.runtime.sendMessage({
    type: "EXPORT_AI_TASK_PROGRESS",
    taskId,
    patch: {
      progress,
      steps: [{ name: stepName, status: "done" }]
    }
  });
}

async function download(url, filename) {
  const response = await chrome.runtime.sendMessage({
    type: "EXPORT_AI_DOWNLOAD",
    url,
    filename
  });

  if (!response?.ok) {
    throw new Error(response?.error || "Không tải được file export.");
  }
}

function enableDrag(wrap) {
  const fab = floatingMount.querySelector(".exportai-fab");
  if (!wrap || !fab) return;

  let dragging = false;
  let moved = false;
  let offsetX = 0;
  let offsetY = 0;
  let startX = 0;
  let startY = 0;

  fab.addEventListener("pointerdown", (event) => {
    dragging = true;
    moved = false;
    startX = event.clientX;
    startY = event.clientY;
    offsetX = event.clientX - wrap.offsetLeft;
    offsetY = event.clientY - wrap.offsetTop;
    fab.setPointerCapture(event.pointerId);
  });

  fab.addEventListener("pointermove", (event) => {
    if (!dragging) return;
    if (Math.hypot(event.clientX - startX, event.clientY - startY) > 4) {
      moved = true;
    }
    if (!moved) return;
    const left = clamp(event.clientX - offsetX, 8, window.innerWidth - 76);
    const top = clamp(event.clientY - offsetY, 8, window.innerHeight - 76);
    wrap.style.left = `${left}px`;
    wrap.style.top = `${top}px`;
    wrap.style.right = "auto";
    wrap.style.bottom = "auto";
  });

  fab.addEventListener("pointerup", async (event) => {
    if (!dragging) return;
    dragging = false;
    fab.releasePointerCapture(event.pointerId);
    if (moved) {
      suppressNextFabClick = true;
      window.setTimeout(() => {
        suppressNextFabClick = false;
      }, 250);
      placeFloatingModal();
    }
    await chrome.storage.local.set({
      [FLOATING_POSITION_KEY]: {
        [location.hostname]: {
          left: wrap.style.left,
          top: wrap.style.top
        }
      }
    });
  });
}

function placeFloatingModal() {
  const wrap = floatingMount?.querySelector(".exportai-wrap");
  const modal = floatingMount?.querySelector('[data-role="modal"]');
  if (!wrap || !modal) return;

  const fabRect = wrap.getBoundingClientRect();
  const modalWidth = Math.min(330, window.innerWidth - 28);
  const estimatedHeight = Math.min(520, window.innerHeight - 28);
  const gap = 10;
  const spaceRight = window.innerWidth - fabRect.right;
  const spaceLeft = fabRect.left;
  const openLeft = spaceRight < modalWidth + gap && spaceLeft > spaceRight;
  const left = openLeft
    ? clamp(fabRect.left - modalWidth - gap, 8, window.innerWidth - modalWidth - 8)
    : clamp(fabRect.right + gap, 8, window.innerWidth - modalWidth - 8);
  const top = clamp(fabRect.top, 8, window.innerHeight - estimatedHeight - 8);

  modal.style.width = `${modalWidth}px`;
  modal.style.left = `${left}px`;
  modal.style.top = `${top}px`;
}

async function restoreFloatingPosition() {
  const wrap = floatingMount.querySelector(".exportai-wrap");
  const positions = await getStored(FLOATING_POSITION_KEY, {});
  const position = positions[location.hostname];
  if (!wrap || !position) return;
  const left = clamp(parseCssPixel(position.left, window.innerWidth - 84), 8, window.innerWidth - 76);
  const top = clamp(parseCssPixel(position.top, window.innerHeight - 120), 8, window.innerHeight - 76);
  wrap.style.left = `${left}px`;
  wrap.style.top = `${top}px`;
  wrap.style.right = "auto";
  wrap.style.bottom = "auto";
}

function floatingCss() {
  return `
    .exportai-wrap {
      position: fixed;
      right: 18px;
      bottom: 94px;
      z-index: 2147483647;
      color: #16201c;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .exportai-fab {
      width: 54px;
      height: 44px;
      border: 1px solid #b9d7ca;
      border-radius: 8px;
      background: #ffffff;
      color: #17694c;
      box-shadow: 0 10px 26px rgba(22, 32, 28, 0.16);
      cursor: grab;
      font-weight: 800;
    }
    .exportai-fab:active { cursor: grabbing; }
    .exportai-modal {
      position: fixed;
      width: min(330px, calc(100vw - 28px));
      max-height: calc(100vh - 28px);
      border: 1px solid #dbe4dd;
      border-radius: 8px;
      background: #fbfcfa;
      box-shadow: 0 18px 42px rgba(22, 32, 28, 0.18);
      overflow: auto;
      z-index: 2147483647;
    }
    .exportai-modal header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px;
      border-bottom: 1px solid #e2e8e3;
    }
    .exportai-modal strong { display: block; font-size: 15px; }
    .exportai-modal span { color: #607068; font-size: 12px; }
    .exportai-window-actions { display: flex; gap: 4px; }
    .exportai-window-actions button {
      width: 28px;
      height: 28px;
      border: 1px solid #d7ded8;
      border-radius: 6px;
      background: #ffffff;
      cursor: pointer;
    }
    .exportai-title {
      padding: 12px;
      border-bottom: 1px solid #e2e8e3;
      font-size: 13px;
      font-weight: 700;
      line-height: 1.35;
      max-height: 54px;
      overflow: hidden;
    }
    .exportai-formats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding: 12px;
    }
    .exportai-formats button,
    .exportai-actions button {
      border: 1px solid #d7ded8;
      border-radius: 8px;
      background: #ffffff;
      color: #16201c;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      font-weight: 800;
      min-height: 36px;
    }
    .exportai-formats button.active {
      border-color: #237a5a;
      background: #eaf3ee;
      color: #17694c;
    }
    .exportai-check,
    .exportai-field,
    .exportai-lock,
    .exportai-quota,
    .exportai-status {
      display: flex;
      gap: 8px;
      padding: 0 12px 10px;
      color: #52625b;
      font-size: 12px;
    }
    .exportai-field {
      display: grid;
      gap: 6px;
    }
    .exportai-field select {
      width: 100%;
      min-height: 34px;
      border: 1px solid #d7ded8;
      border-radius: 8px;
      background: #ffffff;
      color: #16201c;
      font: inherit;
      padding: 6px 8px;
    }
    .exportai-status[data-tone="error"] { color: #9b2d22; font-weight: 700; }
    .exportai-status[data-tone="success"] { color: #17694c; font-weight: 700; }
    .exportai-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      padding: 12px;
      border-top: 1px solid #e2e8e3;
    }
    .exportai-actions button:first-child {
      grid-column: span 2;
      background: #17694c;
      border-color: #17694c;
      color: #ffffff;
    }
  `;
}

function getConversationTitle() {
  const heading = document.querySelector("h1")?.innerText;
  const title = cleanText(heading || document.title || "AI conversation");
  return title.replace(/\s+-\s+(ChatGPT|Gemini|Grok).*$/i, "") || "AI conversation";
}

function buildFilename(conversation, format) {
  const date = new Date().toISOString().slice(0, 10);
  const safeTitle = conversation.title
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u1EF9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `ExportAI-${conversation.platformName}-${safeTitle || "conversation"}-${date}-${format}`;
}

function labelRole(role) {
  return role === "user" ? "Bạn" : "AI";
}

function cleanText(text) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanMarkdown(text) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n\s+- /g, "\n- ")
    .trim();
}

function cleanMessageContent(text) {
  return text
    .replace(/^#{1,6}\s*(Bạn đã nói|You said|User said):?\s*\n+/i, "")
    .replace(/^#{1,6}\s*(ChatGPT said|AI said|Assistant said):?\s*\n+/i, "")
    .replace(/^(Bạn đã nói|You said|User said):?\s*\n+/i, "")
    .replace(/^(Gemini said|ChatGPT said|AI said|Assistant said):?\s*\n+/i, "")
    .trim();
}

function applyContentOptions(content, exportOptions) {
  let nextContent = content;

  if (exportOptions.removeUiWrappers !== false) {
    nextContent = cleanMessageContent(nextContent);
  }

  if (exportOptions.removeToolFailureNotices) {
    nextContent = nextContent
      .split("\n")
      .filter((line) => !/It seems like I can.t do more advanced data analysis right now/i.test(line))
      .join("\n");
  }

  return cleanMarkdown(nextContent);
}

function cleanCodeText(text) {
  return String(text).replace(/\u00a0/g, " ").replace(/\n+$/g, "");
}

function cleanInlineCode(text) {
  return String(text).replace(/\s+/g, " ").replaceAll("`", "\\`").trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeMarkdownLinkText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("\n", " ")
    .trim();
}

function escapeMarkdownTableCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replace(/\s*\n+\s*/g, "<br>")
    .trim();
}

function escapeDelimited(value, delimiter) {
  const text = String(value ?? "");
  const mustQuote =
    text.includes(delimiter) || text.includes('"') || text.includes("\n") || text.includes("\r");
  const escaped = text.replaceAll('"', '""');
  return mustQuote ? `"${escaped}"` : escaped;
}

function markdownLikeToHtml(markdown) {
  const parts = [];
  const fenceRegex = /```([^\n`]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = fenceRegex.exec(markdown)) !== null) {
    parts.push(renderParagraphHtml(markdown.slice(lastIndex, match.index)));
    const language = cleanText(match[1] || "");
    const code = match[2] || "";
    parts.push(
      `<pre><code data-language="${escapeHtml(language)}">${escapeHtml(code)}</code></pre>`
    );
    lastIndex = fenceRegex.lastIndex;
  }

  parts.push(renderParagraphHtml(markdown.slice(lastIndex)));
  return parts.join("");
}

function renderParagraphHtml(text) {
  const clean = text.trim();
  if (!clean) return "";

  return clean
    .split(/\n{2,}/)
    .map(renderMarkdownBlockHtml)
    .join("");
}

function renderMarkdownBlockHtml(block) {
  const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return "";

  const heading = lines.length === 1 ? lines[0].match(/^(#{1,6})\s+(.+)$/) : null;
  if (heading) {
    const level = heading[1].length;
    return `<h${level}>${renderInlineMarkdownHtml(heading[2])}</h${level}>`;
  }

  if (lines.every((line) => /^[-*]\s+/.test(line))) {
    return `<ul>${lines.map((line) => `<li>${renderInlineMarkdownHtml(line.replace(/^[-*]\s+/, ""))}</li>`).join("")}</ul>`;
  }

  if (lines.every((line) => /^\d+\.\s+/.test(line))) {
    return `<ol>${lines.map((line) => `<li>${renderInlineMarkdownHtml(line.replace(/^\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
  }

  if (lines.every((line) => /^>\s?/.test(line))) {
    return `<blockquote>${lines.map((line) => renderInlineMarkdownHtml(line.replace(/^>\s?/, ""))).join("<br>")}</blockquote>`;
  }

  if (lines.length >= 2 && lines[0].startsWith("|") && /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[1])) {
    const rows = lines
      .filter((line, index) => index !== 1)
      .map((line) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
    const [header, ...body] = rows;
    return `<table><thead><tr>${header.map((cell) => `<th>${renderInlineMarkdownHtml(cell)}</th>`).join("")}</tr></thead><tbody>${body
      .map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdownHtml(cell)}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;
  }

  return `<p>${renderInlineMarkdownHtml(block)}</p>`;
}

function renderInlineMarkdownHtml(text) {
  return escapeHtml(text)
    .replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      (_match, alt, src) => `<img src="${src}" alt="${alt}">`
    )
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      (_match, label, href) => `<a href="${href}">${label}</a>`
    );
}

function formatAssetText(asset) {
  if (asset.url) return `${asset.title || asset.url} (${asset.url})`;
  return asset.title || asset.alt || asset.type;
}

function titleCase(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toAbsoluteUrl(value) {
  if (!value) return "";
  if (/^(data:|blob:)/i.test(value)) return value;

  try {
    return new URL(value, location.href).href;
  } catch {
    return "";
  }
}

function inferMimeTypeFromUrl(url) {
  try {
    return inferMimeTypeFromFileName(new URL(url).pathname);
  } catch {
    return "";
  }
}

function inferMimeTypeFromFileName(fileName) {
  const extension = String(fileName).split(".").pop()?.toLowerCase();
  const types = {
    md: "text/markdown",
    txt: "text/plain",
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    tsv: "text/tab-separated-values",
    json: "application/json",
    jsonl: "application/x-ndjson",
    yaml: "application/yaml",
    yml: "application/yaml",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    zip: "application/zip",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    rtf: "application/rtf"
  };

  return types[extension] || "";
}

function uniqueElements(elements) {
  return [...new Set(elements)].filter((element) => element.offsetParent !== null);
}

function sortNodesByDocumentPosition(nodes) {
  return [...nodes].sort((a, b) => {
    const rectA = getNodeRect(a);
    const rectB = getNodeRect(b);
    if (Math.abs(rectA.top - rectB.top) > 4) return rectA.top - rectB.top;
    return rectA.left - rectB.left;
  });
}

function getNodeRect(node) {
  const rect = node.getBoundingClientRect();
  return {
    top: Math.round(rect.top + window.scrollY),
    left: Math.round(rect.left + window.scrollX),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
    viewportTop: Math.round(rect.top),
    viewportLeft: Math.round(rect.left)
  };
}

function wrapText(text, maxLength) {
  const lines = [];
  const paragraphs = text.split("\n");

  for (const paragraph of paragraphs) {
    const words = paragraph.split(/\s+/);
    let line = "";

    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxLength) {
        if (line) lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }

    lines.push(line);
  }

  return lines;
}

function toDataUrl(text, mime) {
  const encoded = encodeURIComponent(text).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `data:${mime},${encoded}`;
}

async function getStored(key, fallback) {
  const data = await chrome.storage.local.get(key);
  return data[key] || fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function topEntries(record, limit) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, count]) => ({ key, count }));
}

function parseCssPixel(value, fallback) {
  const parsed = Number.parseFloat(String(value || ""));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
