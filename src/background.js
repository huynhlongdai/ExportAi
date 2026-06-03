importScripts("shared/platforms.js");

const STORAGE_KEYS = {
  tasks: "exportai.tasks",
  plan: "exportai.plan",
  presets: "exportai.presets",
  archives: "exportai.archives",
  diagnostics: "exportai.diagnostics",
  rules: "exportai.rules",
  adapters: "exportai.adapters",
  settings: "exportai.settings"
};

const FREE_LIMITS = {
  dailyLimit: 10,
  monthlyLimit: 50
};

const DEFAULT_PRESETS = [
  {
    id: "ai_archive",
    name: "AI Archive",
    description: "Markdown + JSON with metadata for long-term reuse.",
    formats: ["markdown", "json"],
    includeMeta: true,
    proRequired: false
  },
  {
    id: "human_report",
    name: "Human Report",
    description: "Readable PDF and Word for sharing.",
    formats: ["pdf", "word"],
    includeMeta: true,
    proRequired: false
  },
  {
    id: "dataset",
    name: "Dataset",
    description: "JSONL and CSV for analysis, evals, or datasets.",
    formats: ["jsonl", "csv"],
    includeMeta: true,
    proRequired: false
  },
  {
    id: "visual_snapshot",
    name: "Visual Snapshot",
    description: "PNG and HTML for visual review.",
    formats: ["png", "html"],
    includeMeta: true,
    proRequired: false
  },
  {
    id: "full_backup",
    name: "Full Backup",
    description: "Markdown, JSON, Word, PDF, HTML, and assets metadata.",
    formats: ["markdown", "json", "word", "pdf", "html"],
    includeMeta: true,
    proRequired: true
  }
];

const DEFAULT_RULES = [
  {
    id: "auto_archive_active_ai_tab",
    name: "Auto archive active AI tab",
    description: "Every 60 minutes, create a Markdown + JSON archive task for the active supported AI chat tab.",
    enabled: false,
    intervalMinutes: 60,
    formats: ["markdown", "json"],
    includeMeta: true,
    presetId: "ai_archive",
    requiresPro: true,
    lastRunAt: null,
    nextRunAt: null
  }
];

const DEFAULT_SETTINGS = {
  includeMetaDefault: true,
  includeAssets: true,
  removeUiWrappers: true,
  removeToolFailureNotices: false,
  enableFallbackExport: true,
  autoFetchRemoteAdapters: false,
  serverUrl: "http://127.0.0.1:8787",
  licenseKey: "",
  defaultPresetId: "ai_archive",
  filenamePattern: "ExportAI-{platform}-{title}-{date}-{format}"
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({ ok: false, error: error.message }));

  return true;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== "complete" || !isSupportedAiUrl(tab.url)) return;
  ensureContentScripts(tabId);
  runWaitingJobsForTab(tab);
});

chrome.tabs.onActivated.addListener(async ({ tabId }) => {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (isSupportedAiUrl(tab.url)) {
      await ensureContentScripts(tabId);
      await runWaitingJobsForTab(tab);
    }
  } catch {
    // Ignore tabs Chrome does not allow extension access to.
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "exportai.rules.tick") {
    runRulesTick();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  scheduleRulesAlarm();
});

scheduleRulesAlarm();
bootstrapRemoteAdapters();

async function handleMessage(message, sender) {
  switch (message?.type) {
    case "EXPORT_AI_CREATE_TASK":
      return createAndRunTask(message, sender);
    case "EXPORT_AI_CREATE_LINK_JOB":
      return createLinkJob(message);
    case "EXPORT_AI_TASK_PROGRESS":
      return updateTask(message.taskId, message.patch);
    case "EXPORT_AI_DOWNLOAD":
      return downloadFile(message.url, message.filename);
    case "EXPORT_AI_GET_PLAN":
      return { ok: true, plan: await getPlanState() };
    case "EXPORT_AI_GET_PRESETS":
      return { ok: true, presets: await getPresets() };
    case "EXPORT_AI_CREATE_PRESET":
      return createPreset(message.preset);
    case "EXPORT_AI_DELETE_PRESET":
      return deletePreset(message.presetId);
    case "EXPORT_AI_GET_ADAPTERS":
      return { ok: true, adapters: await getAdapters() };
    case "EXPORT_AI_GET_SETTINGS":
      return { ok: true, settings: await getSettings() };
    case "EXPORT_AI_UPDATE_SETTINGS":
      return updateSettings(message.patch);
    case "EXPORT_AI_VALIDATE_LICENSE":
      return validateLicense();
    case "EXPORT_AI_FETCH_REMOTE_ADAPTERS":
      return fetchRemoteAdapters();
    case "EXPORT_AI_GET_SERVER_STATUS":
      return getServerStatus();
    case "EXPORT_AI_ROLLBACK_REMOTE_ADAPTER":
      return rollbackRemoteAdapter(message.platform);
    case "EXPORT_AI_IMPORT_ADAPTER":
      return importAdapterConfig(message.adapter);
    case "EXPORT_AI_UPLOAD_DIAGNOSTIC":
      return uploadDiagnostic(message.diagnosticId, message.privacyMode);
    case "EXPORT_AI_REQUEST_REPAIR":
      return requestRepair(message.diagnosticId, message.privacyMode);
    case "EXPORT_AI_CREATE_RULE":
      return createRule(message.rule);
    case "EXPORT_AI_DELETE_RULE":
      return deleteRule(message.ruleId);
    case "EXPORT_AI_GET_MANAGER_STATE":
      return getManagerState();
    case "EXPORT_AI_TOGGLE_RULE":
      return toggleRule(message.ruleId, message.enabled);
    case "EXPORT_AI_RUN_TASK_BY_ID":
      return runTaskById(message.taskId);
    case "EXPORT_AI_DELETE_TASK":
      return deleteTask(message.taskId);
    case "EXPORT_AI_DELETE_ARCHIVE":
      return deleteArchive(message.archiveId);
    case "EXPORT_AI_REEXPORT_ARCHIVE":
      return reExportArchive(message.archiveId);
    case "EXPORT_AI_DELETE_DIAGNOSTIC":
      return deleteDiagnostic(message.diagnosticId);
    case "EXPORT_AI_OPEN_MANAGER":
      await openManager(sender);
      return { ok: true };
    case "EXPORT_AI_OPEN_FLOATING":
      return sendToActiveTab({ type: "EXPORT_AI_OPEN_FLOATING" });
    case "EXPORT_AI_GET_PAGE_SUMMARY":
      return sendToActiveTab({ type: "EXPORT_AI_GET_PAGE_SUMMARY" });
    default:
      return { ok: false, error: "Unknown ExportAI message." };
  }
}

async function openManager(sender) {
  if (chrome.sidePanel?.open) {
    try {
      const windowId = sender.tab?.windowId || (await chrome.windows.getCurrent()).id;
      await chrome.sidePanel.open({ windowId });
      return;
    } catch {
      // Fall back to a manager tab when side panel cannot be opened from this context.
    }
  }

  await chrome.tabs.create({ url: chrome.runtime.getURL("manager.html") });
}

async function createAndRunTask(message, sender) {
  const plan = await getPlanState();
  const quotaCheck = validateQuota(plan, message.formats || []);

  if (!quotaCheck.ok) {
    return { ok: false, error: quotaCheck.error, code: quotaCheck.code, plan };
  }

  const settings = await getSettings();
  const task = {
    id: createId("task"),
    tabId: message.tabId || sender.tab?.id,
    platform: message.platform || "unknown",
    platformName: message.platformName || "AI Chat",
    title: message.title || "AI conversation",
    sourceUrl: message.sourceUrl || "",
    formats: normalizeFormats(message.formats),
    includeMeta: message.includeMeta ?? settings.includeMetaDefault,
    includeSignature: plan.features.removeSignature === false,
    exportOptions: {
      includeAssets: message.exportOptions?.includeAssets ?? settings.includeAssets,
      removeUiWrappers: message.exportOptions?.removeUiWrappers ?? settings.removeUiWrappers,
      removeToolFailureNotices:
        message.exportOptions?.removeToolFailureNotices ?? settings.removeToolFailureNotices
    },
    presetId: message.presetId || "quick_export",
    status: "queued",
    progress: 0,
    steps: [
      { name: "capture", status: "pending" },
      { name: "render", status: "pending" },
      { name: "download", status: "pending" }
    ],
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    error: null,
    outputFiles: []
  };

  await saveTask(task);
  if (message.runNow !== false) {
    runTask(task, plan);
  }
  return { ok: true, task, plan };
}

async function createLinkJob(message) {
  const url = normalizeUrl(message.sourceUrl || "");
  if (!url || !isSupportedAiUrl(url)) {
    return { ok: false, error: "Link không thuộc ChatGPT, Grok hoặc Gemini được hỗ trợ." };
  }

  const settings = await getSettings();
  const platform = ExportAIPlatforms.detectPlatformFromHost(new URL(url).hostname);
  const plan = await getPlanState();
  const formats = normalizeFormats(message.formats);
  const quotaCheck = validateQuota(plan, formats);
  if (!quotaCheck.ok) return { ok: false, error: quotaCheck.error, code: quotaCheck.code, plan };

  const task = {
    id: createId("task"),
    tabId: null,
    triggerMode: "url_match",
    matchUrl: url,
    platform: platform.id,
    platformName: platform.name,
    title: message.title || "Waiting chat export",
    sourceUrl: url,
    formats,
    includeMeta: message.includeMeta ?? settings.includeMetaDefault,
    includeSignature: plan.features.removeSignature === false,
    exportOptions: {
      includeAssets: message.exportOptions?.includeAssets ?? settings.includeAssets,
      removeUiWrappers: message.exportOptions?.removeUiWrappers ?? settings.removeUiWrappers,
      removeToolFailureNotices:
        message.exportOptions?.removeToolFailureNotices ?? settings.removeToolFailureNotices
    },
    presetId: message.presetId || settings.defaultPresetId,
    status: "waiting_for_tab",
    progress: 0,
    steps: [
      { name: "wait_for_tab", status: "pending" },
      { name: "capture", status: "pending" },
      { name: "render", status: "pending" },
      { name: "download", status: "pending" }
    ],
    createdAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    error: null,
    outputFiles: []
  };

  await saveTask(task);
  return { ok: true, task, plan };
}

async function runWaitingJobsForTab(tab) {
  if (!tab?.id || !tab.url) return;
  const normalizedTabUrl = normalizeUrl(tab.url);
  const tasks = await getTasks();
  const matchingTasks = tasks.filter(
    (task) =>
      task.status === "waiting_for_tab" &&
      task.triggerMode === "url_match" &&
      urlsMatch(task.matchUrl || task.sourceUrl, normalizedTabUrl)
  );

  for (const task of matchingTasks) {
    const plan = await getPlanState();
    await updateTask(task.id, {
      tabId: tab.id,
      status: "queued",
      error: null,
      progress: 1
    });
    runTask({ ...task, tabId: tab.id, status: "queued" }, plan);
  }
}

async function createTaskForTab(tab, options) {
  if (!tab?.id) throw new Error("Không tìm thấy tab để tạo task.");
  const summaryResponse = await sendMessageWithInjection(tab.id, { type: "EXPORT_AI_GET_PAGE_SUMMARY" });
  const summary = summaryResponse?.summary;
  if (!summary?.supported) throw new Error("Tab hiện tại không phải AI chat được hỗ trợ.");

  return createAndRunTask(
    {
      tabId: tab.id,
      platform: summary.platform,
      platformName: summary.platformName,
      title: summary.title,
      sourceUrl: summary.sourceUrl,
      formats: options.formats,
      includeMeta: options.includeMeta,
      presetId: options.presetId,
      runNow: true
    },
    { tab }
  );
}

async function runTask(task, plan) {
  await updateTask(task.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    progress: 5,
    error: null
  });

  try {
    const result = await chrome.tabs.sendMessage(task.tabId, {
      type: "EXPORT_AI_RUN_TASK",
      task: {
        ...task,
        exportOptions: {
          ...(task.exportOptions || {}),
          enableFallbackExport: task.exportOptions?.enableFallbackExport ?? (await getSettings()).enableFallbackExport
        }
      },
      plan
    });

    if (result?.diagnostic) {
      const diagnostic = await saveDiagnostic(result.diagnostic, task);
      await updateTask(task.id, { diagnosticId: diagnostic.id });
    }

    if (!result?.ok) {
      throw new Error(result?.error || "Export task failed.");
    }

    await updateTask(task.id, {
      status: "success",
      progress: 100,
      completedAt: new Date().toISOString(),
      outputFiles: result.outputFiles || [],
      archiveId: result.conversation?.conversationId || null
    });
    if (result.conversation) {
      await saveArchive(result.conversation, task, result.outputFiles || []);
    }
    await consumeQuota();
  } catch (error) {
    if (error.diagnostic) {
      await saveDiagnostic(error.diagnostic, task);
    }
    await updateTask(task.id, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: error.message,
      progress: 100
    });
  }
}

async function runTaskById(taskId) {
  const tasks = await getTasks();
  const task = tasks.find((item) => item.id === taskId);
  if (!task) throw new Error("Không tìm thấy task.");
  if (!task.tabId) throw new Error("Task này không còn tab nguồn để chạy lại.");

  const plan = await getPlanState();
  const quotaCheck = validateQuota(plan, task.formats || []);
  if (!quotaCheck.ok) {
    return { ok: false, error: quotaCheck.error, code: quotaCheck.code, plan };
  }

  runTask({ ...task, error: null }, plan);
  return { ok: true };
}

async function deleteTask(taskId) {
  const tasks = await getTasks();
  await chrome.storage.local.set({
    [STORAGE_KEYS.tasks]: tasks.filter((task) => task.id !== taskId)
  });
  return { ok: true };
}

async function downloadFile(url, filename) {
  const downloadId = await chrome.downloads.download({
    url,
    filename,
    saveAs: true
  });

  return { ok: true, downloadId };
}

async function sendToActiveTab(payload) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Không tìm thấy tab hiện tại.");

  const response = await sendMessageWithInjection(tab.id, payload);
  return response || { ok: false, error: "Tab không phản hồi." };
}

async function sendMessageWithInjection(tabId, payload) {
  try {
    return await chrome.tabs.sendMessage(tabId, payload);
  } catch (error) {
    await ensureContentScripts(tabId);
    return chrome.tabs.sendMessage(tabId, payload);
  }
}

async function ensureContentScripts(tabId) {
  try {
    const ping = await chrome.tabs.sendMessage(tabId, { type: "EXPORT_AI_PING" });
    if (ping?.ok) return;
  } catch {
    // Content script is not available yet, inject below.
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["src/shared/platforms.js", "src/contentScript.js"]
  });
}

function isSupportedAiUrl(url) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return Object.values(ExportAIPlatforms.all).some((platform) =>
      platform.hosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`))
    );
  } catch {
    return false;
  }
}

function normalizeUrl(url) {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    parsed.search = "";
    return parsed.href.replace(/\/$/, "");
  } catch {
    return "";
  }
}

function urlsMatch(expectedUrl, actualUrl) {
  const expected = normalizeUrl(expectedUrl);
  const actual = normalizeUrl(actualUrl);
  return expected && actual && (expected === actual || actual.startsWith(`${expected}/`));
}

async function getManagerState() {
  const [tasks, plan, presets, archives, diagnostics, rules, adapters, settings, serverStatus] = await Promise.all([
    getTasks(),
    getPlanState(),
    getPresets(),
    getArchives(),
    getDiagnostics(),
    getRules(),
    getAdapters(),
    getSettings(),
    getServerStatus()
  ]);
  return {
    ok: true,
    tasks: tasks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    plan,
    presets,
    archives,
    diagnostics,
    rules,
    adapters,
    settings,
    serverStatus
  };
}

async function getSettings() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const settings = { ...DEFAULT_SETTINGS, ...(data[STORAGE_KEYS.settings] || {}) };
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
  return settings;
}

async function updateSettings(patch) {
  const current = await getSettings();
  const allowedKeys = new Set(Object.keys(DEFAULT_SETTINGS));
  const next = { ...current };

  Object.entries(patch || {}).forEach(([key, value]) => {
    if (allowedKeys.has(key)) next[key] = value;
  });

  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: next });
  return { ok: true, settings: next };
}

async function validateLicense() {
  const settings = await getSettings();
  if (!settings.licenseKey) {
    return { ok: false, error: "Chưa có license key." };
  }

  const response = await serverFetch("/api/license/validate", {
    method: "POST",
    body: {
      licenseKey: settings.licenseKey,
      extensionVersion: chrome.runtime.getManifest().version
    }
  });

  if (!response.ok || response.status !== "active") {
    return { ok: false, error: response.error || "License không hợp lệ." };
  }

  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const plan = {
    plan: "pro",
    licenseStatus: "active",
    licenseCheckedAt: new Date().toISOString(),
    licenseKeyHash: hashString(settings.licenseKey),
    quota: {
      dailyLimit: response.quota?.dailyLimit || 999999,
      dailyUsed: 0,
      monthlyLimit: response.quota?.monthlyLimit || 999999,
      monthlyUsed: 0,
      day: today,
      month
    },
    features: {
      removeSignature: true,
      batchExport: true,
      automation: true,
      customTemplates: true,
      aiRepair: true,
      remoteAdapters: true
    }
  };
  await chrome.storage.local.set({ [STORAGE_KEYS.plan]: plan });
  return { ok: true, plan };
}

async function fetchRemoteAdapters() {
  const adapters = await getAdapters();
  const nextAdapters = [];

  for (const adapter of adapters) {
    try {
      const remote = await serverFetch(`/api/adapters/${encodeURIComponent(adapter.id)}/latest`);
      if (!remote.ok || !remote.adapter) {
        nextAdapters.push(adapter);
        continue;
      }

      const validation = validateAdapterConfig(remote.adapter);
      if (!validation.ok) {
        nextAdapters.push({
          ...adapter,
          lastRemoteError: validation.error,
          remoteCheckedAt: new Date().toISOString()
        });
        continue;
      }

      nextAdapters.push({
        ...adapter,
        ...remote.adapter,
        version: remote.adapter.version || adapter.version,
        status: "remote",
        source: "server",
        remoteCheckedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      nextAdapters.push({
        ...adapter,
        lastRemoteError: error.message,
        remoteCheckedAt: new Date().toISOString()
      });
    }
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.adapters]: nextAdapters });
  return { ok: true, adapters: nextAdapters };
}

async function getServerStatus() {
  try {
    const response = await serverFetch("/api/status");
    return response.ok
      ? {
          ok: true,
          online: true,
          version: response.version || "unknown",
          schemaVersion: response.schemaVersion || null,
          diagnosticsCount: response.diagnosticsCount || 0,
          proposalsCount: response.proposalsCount || 0,
          adapterCounts: response.adapterCounts || {},
          checkedAt: new Date().toISOString()
        }
      : {
          ok: false,
          online: false,
          error: response.error || "Server status failed.",
          checkedAt: new Date().toISOString()
        };
  } catch (error) {
    return {
      ok: false,
      online: false,
      error: error.message,
      checkedAt: new Date().toISOString()
    };
  }
}

async function rollbackRemoteAdapter(platform) {
  if (!platform) return { ok: false, error: "Platform is required." };
  const response = await serverFetch(`/api/adapters/${encodeURIComponent(platform)}/rollback`, {
    method: "POST",
    body: {}
  });
  if (!response.ok || !response.adapter) {
    return { ok: false, error: response.error || "Rollback failed." };
  }
  return importAdapterConfig({
    ...response.adapter,
    status: "override",
    source: "server-rollback"
  });
}

async function bootstrapRemoteAdapters() {
  try {
    const settings = await getSettings();
    if (settings.autoFetchRemoteAdapters) {
      await fetchRemoteAdapters();
    }
  } catch {
    // Remote adapters are optional; bundled adapters remain active offline.
  }
}

async function uploadDiagnostic(diagnosticId, privacyMode = "private") {
  const diagnostics = await getDiagnostics();
  const record = diagnostics.find((item) => item.id === diagnosticId);
  if (!record) return { ok: false, error: "Không tìm thấy diagnostic." };

  const response = await serverFetch("/api/diagnostics", {
    method: "POST",
    body: sanitizeDiagnosticForUpload(record, privacyMode)
  });

  await updateDiagnostic(diagnosticId, {
    uploadedAt: new Date().toISOString(),
    privacyMode,
    serverDiagnosticId: response.diagnosticId || null,
    uploadError: response.ok ? null : response.error || "Upload failed"
  });

  return response.ok ? { ok: true, response } : { ok: false, error: response.error || "Upload failed" };
}

async function requestRepair(diagnosticId, privacyMode = "private") {
  const upload = await uploadDiagnostic(diagnosticId, privacyMode);
  if (!upload.ok) return upload;

  const diagnostics = await getDiagnostics();
  const record = diagnostics.find((item) => item.id === diagnosticId);
  const response = await serverFetch("/api/repair/proposals", {
    method: "POST",
    body: sanitizeDiagnosticForUpload(record, privacyMode)
  });

  if (response.ok && response.adapter) {
    const validation = validateAdapterConfig(response.adapter);
    if (validation.ok) {
      await importAdapterConfig({
        ...response.adapter,
        status: "override",
        source: "repair-proposal"
      });
    }
  }

  await updateDiagnostic(diagnosticId, {
    repairRequestedAt: new Date().toISOString(),
    repairProposalId: response.proposalId || null,
    repairStatus: response.ok ? response.status || "proposed" : "failed",
    repairError: response.ok ? null : response.error || "Repair request failed"
  });

  return response.ok ? { ok: true, response } : { ok: false, error: response.error || "Repair request failed" };
}

async function getAdapters() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.adapters);
  const stored = data[STORAGE_KEYS.adapters];
  if (Array.isArray(stored) && stored.length) return mergeAdapterDefaults(stored);

  const defaults = buildDefaultAdapters();
  await chrome.storage.local.set({ [STORAGE_KEYS.adapters]: defaults });
  return defaults;
}

async function importAdapterConfig(adapter) {
  const validation = validateAdapterConfig(adapter);
  if (!validation.ok) return validation;

  const adapters = await getAdapters();
  const nextAdapters = adapters.map((item) =>
    item.id === adapter.id
      ? {
          ...item,
          ...adapter,
          version: adapter.version || adapter.adapterVersion || item.version,
          status: "override",
          source: "manual-import",
          updatedAt: new Date().toISOString()
        }
      : item
  );

  await chrome.storage.local.set({ [STORAGE_KEYS.adapters]: nextAdapters });
  return { ok: true, adapters: nextAdapters };
}

function validateAdapterConfig(adapter) {
  if (!adapter || typeof adapter !== "object") {
    return { ok: false, error: "Adapter config phải là JSON object." };
  }

  const knownIds = new Set(Object.keys(ExportAIPlatforms.all));
  if (!knownIds.has(adapter.id)) {
    return { ok: false, error: "Adapter id không hợp lệ hoặc chưa được hỗ trợ." };
  }

  if (!Array.isArray(adapter.selectors) || !adapter.selectors.length) {
    return { ok: false, error: "Adapter cần selectors array." };
  }

  if (adapter.selectorGroups && !Array.isArray(adapter.selectorGroups)) {
    return { ok: false, error: "selectorGroups phải là array." };
  }

  const selectorLike = /^[#.:[\]=\-"'\w\s>(),*^$|~+]+$/;
  const selectors = [
    ...adapter.selectors,
    ...(adapter.selectorGroups || []).flat()
  ];

  if (!selectors.every((selector) => typeof selector === "string" && selector.length < 240 && selectorLike.test(selector))) {
    return { ok: false, error: "Selector không hợp lệ hoặc quá dài." };
  }

  return { ok: true };
}

function buildDefaultAdapters() {
  return Object.values(ExportAIPlatforms.all).map((platform) => ({
    id: platform.id,
    name: platform.name,
    productName: platform.productName,
    version: platform.adapterVersion || "unknown",
    status: platform.adapterStatus || "local",
    hosts: platform.hosts,
    matches: platform.matches,
    selectors: platform.selectors,
    selectorGroups: platform.selectorGroups,
    updatedAt: new Date().toISOString(),
    source: "bundled"
  }));
}

function mergeAdapterDefaults(stored) {
  const defaults = buildDefaultAdapters();
  const byId = new Map(stored.map((adapter) => [adapter.id, adapter]));
  return defaults.map((adapter) => ({ ...adapter, ...(byId.get(adapter.id) || {}) }));
}

async function getRules() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.rules);
  const stored = data[STORAGE_KEYS.rules];
  if (Array.isArray(stored) && stored.length) return stored;

  await chrome.storage.local.set({ [STORAGE_KEYS.rules]: DEFAULT_RULES });
  return DEFAULT_RULES;
}

async function toggleRule(ruleId, enabled) {
  const rules = await getRules();
  const nextRules = rules.map((rule) =>
    rule.id === ruleId
      ? {
          ...rule,
          enabled: Boolean(enabled),
          nextRunAt: enabled ? new Date(Date.now() + rule.intervalMinutes * 60_000).toISOString() : null
        }
      : rule
  );
  await chrome.storage.local.set({ [STORAGE_KEYS.rules]: nextRules });
  await scheduleRulesAlarm();
  return { ok: true, rules: nextRules };
}

async function createRule(rule) {
  const plan = await getPlanState();
  if (plan.plan === "free") {
    return { ok: false, error: "Automation custom là tính năng Pro." };
  }

  const rules = await getRules();
  const formats = normalizeFormats(rule?.formats || ["markdown", "json"]);
  const intervalMinutes = Math.max(5, Math.min(Number(rule?.intervalMinutes) || 60, 1440));
  const nextRule = {
    id: createId("rule"),
    name: String(rule?.name || "Custom export rule").slice(0, 80),
    description: String(rule?.description || "Custom scheduled export rule.").slice(0, 180),
    enabled: Boolean(rule?.enabled),
    intervalMinutes,
    formats,
    includeMeta: rule?.includeMeta !== false,
    presetId: rule?.presetId || "ai_archive",
    requiresPro: true,
    matchPlatform: rule?.matchPlatform || "any",
    matchTitle: String(rule?.matchTitle || "").slice(0, 120),
    matchUrl: normalizeUrl(rule?.matchUrl || "") || "",
    lastRunAt: null,
    nextRunAt: rule?.enabled ? new Date(Date.now() + intervalMinutes * 60_000).toISOString() : null
  };

  const nextRules = [nextRule, ...rules].slice(0, 50);
  await chrome.storage.local.set({ [STORAGE_KEYS.rules]: nextRules });
  await scheduleRulesAlarm();
  return { ok: true, rules: nextRules };
}

async function deleteRule(ruleId) {
  const rules = await getRules();
  const nextRules = rules.filter((rule) => rule.id !== ruleId);
  await chrome.storage.local.set({ [STORAGE_KEYS.rules]: nextRules });
  return { ok: true, rules: nextRules };
}

async function scheduleRulesAlarm() {
  try {
    await chrome.alarms.create("exportai.rules.tick", { periodInMinutes: 1 });
  } catch {
    // Alarms are not available in some test contexts.
  }
}

async function runRulesTick() {
  const [rules, plan] = await Promise.all([getRules(), getPlanState()]);
  const now = Date.now();

  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (rule.requiresPro && plan.plan === "free") continue;
    const nextRunAt = rule.nextRunAt ? new Date(rule.nextRunAt).getTime() : 0;
    if (nextRunAt > now) continue;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !isSupportedAiUrl(tab.url)) continue;
      if (!ruleMatchesTab(rule, tab)) continue;
      await createTaskForTab(tab, rule);
      await updateRuleRunState(rule.id, null);
    } catch (error) {
      await updateRuleRunState(rule.id, error.message);
    }
  }
}

function ruleMatchesTab(rule, tab) {
  if (rule.matchPlatform && rule.matchPlatform !== "any") {
    const platform = ExportAIPlatforms.detectPlatformFromHost(new URL(tab.url).hostname);
    if (platform.id !== rule.matchPlatform) return false;
  }

  if (rule.matchUrl && !urlsMatch(rule.matchUrl, tab.url)) return false;
  if (rule.matchTitle && !String(tab.title || "").toLowerCase().includes(rule.matchTitle.toLowerCase())) return false;

  return true;
}

async function updateRuleRunState(ruleId, error) {
  const rules = await getRules();
  const now = new Date();
  const nextRules = rules.map((rule) =>
    rule.id === ruleId
      ? {
          ...rule,
          lastRunAt: now.toISOString(),
          nextRunAt: new Date(now.getTime() + rule.intervalMinutes * 60_000).toISOString(),
          lastError: error || null
        }
      : rule
  );
  await chrome.storage.local.set({ [STORAGE_KEYS.rules]: nextRules });
}

async function getPresets() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.presets);
  const stored = data[STORAGE_KEYS.presets];
  if (Array.isArray(stored) && stored.length) return stored;

  await chrome.storage.local.set({ [STORAGE_KEYS.presets]: DEFAULT_PRESETS });
  return DEFAULT_PRESETS;
}

async function createPreset(preset) {
  const plan = await getPlanState();
  if (plan.plan === "free") {
    return { ok: false, error: "Preset custom là tính năng Pro." };
  }

  const presets = await getPresets();
  const nextPreset = {
    id: createId("preset"),
    name: String(preset?.name || "Custom preset").slice(0, 80),
    description: String(preset?.description || "").slice(0, 180),
    formats: normalizeFormats(preset?.formats || ["markdown"]),
    includeMeta: preset?.includeMeta !== false,
    proRequired: false,
    custom: true,
    createdAt: new Date().toISOString()
  };
  const nextPresets = [...presets, nextPreset].slice(0, 40);
  await chrome.storage.local.set({ [STORAGE_KEYS.presets]: nextPresets });
  return { ok: true, presets: nextPresets };
}

async function deletePreset(presetId) {
  const presets = await getPresets();
  const nextPresets = presets.filter((preset) => preset.id !== presetId || !preset.custom);
  await chrome.storage.local.set({ [STORAGE_KEYS.presets]: nextPresets });
  return { ok: true, presets: nextPresets };
}

async function saveTask(task) {
  const tasks = await getTasks();
  tasks.unshift(task);
  await chrome.storage.local.set({ [STORAGE_KEYS.tasks]: tasks.slice(0, 200) });
}

async function saveArchive(conversation, task, outputFiles) {
  const archives = await getArchives();
  const existingIndex = archives.findIndex((archive) => archive.id === conversation.conversationId);
  const archive = {
    id: conversation.conversationId,
    title: conversation.title,
    platform: conversation.platform,
    platformName: conversation.platformName,
    url: conversation.url,
    capturedAt: conversation.capturedAt,
    updatedAt: new Date().toISOString(),
    messageCount: conversation.messages.length,
    assetCount: conversation.assets?.length || 0,
    formats: task.formats,
    presetId: task.presetId,
    outputFiles,
    conversation: compactConversation(conversation)
  };

  if (existingIndex >= 0) {
    archives.splice(existingIndex, 1, archive);
  } else {
    archives.unshift(archive);
  }

  await chrome.storage.local.set({ [STORAGE_KEYS.archives]: archives.slice(0, 50) });
}

async function getArchives() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.archives);
  return data[STORAGE_KEYS.archives] || [];
}

async function deleteArchive(archiveId) {
  const archives = await getArchives();
  await chrome.storage.local.set({
    [STORAGE_KEYS.archives]: archives.filter((archive) => archive.id !== archiveId)
  });
  return { ok: true };
}

async function saveDiagnostic(diagnostic, task) {
  const diagnostics = await getDiagnostics();
  const record = {
    id: createId("diag"),
    taskId: task.id,
    platform: diagnostic.platform || task.platform,
    platformName: diagnostic.platformName || task.platformName,
    title: task.title,
    sourceUrl: task.sourceUrl,
    errorType: diagnostic.errorType || "UNKNOWN",
    errorMessage: diagnostic.errorMessage || task.error || "",
    capturedAt: diagnostic.capturedAt || new Date().toISOString(),
    diagnostic
  };

  diagnostics.unshift(record);
  await chrome.storage.local.set({ [STORAGE_KEYS.diagnostics]: diagnostics.slice(0, 100) });
  return record;
}

async function getDiagnostics() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.diagnostics);
  return data[STORAGE_KEYS.diagnostics] || [];
}

async function updateDiagnostic(diagnosticId, patch) {
  const diagnostics = await getDiagnostics();
  const nextDiagnostics = diagnostics.map((diagnostic) =>
    diagnostic.id === diagnosticId ? { ...diagnostic, ...patch } : diagnostic
  );
  await chrome.storage.local.set({ [STORAGE_KEYS.diagnostics]: nextDiagnostics });
  return { ok: true };
}

async function deleteDiagnostic(diagnosticId) {
  const diagnostics = await getDiagnostics();
  await chrome.storage.local.set({
    [STORAGE_KEYS.diagnostics]: diagnostics.filter((diagnostic) => diagnostic.id !== diagnosticId)
  });
  return { ok: true };
}

function sanitizeDiagnosticForUpload(record, privacyMode) {
  const diagnostic = record?.diagnostic || {};
  const sanitized = {
    schemaVersion: 1,
    privacyMode,
    localDiagnosticId: record?.id,
    taskId: record?.taskId,
    platform: record?.platform,
    platformName: record?.platformName,
    titleHash: hashString(record?.title || ""),
    urlHost: diagnostic.urlHost,
    sourceUrlHash: hashString(record?.sourceUrl || diagnostic.sourceUrl || ""),
    extensionVersion: chrome.runtime.getManifest().version,
    errorType: record?.errorType,
    errorMessage: record?.errorMessage,
    capturedAt: record?.capturedAt,
    adapter: diagnostic.adapter,
    selectorResults: diagnostic.selectorResults,
    domSignature: diagnostic.domSignature
  };

  if (privacyMode === "debug") {
    sanitized.sampleHtml = diagnostic.sampleHtml || "";
  }

  if (privacyMode === "support") {
    sanitized.title = record?.title || "";
    sanitized.sourceUrl = record?.sourceUrl || diagnostic.sourceUrl || "";
    sanitized.sampleHtml = diagnostic.sampleHtml || "";
  }

  return sanitized;
}

async function reExportArchive(archiveId) {
  const archives = await getArchives();
  const archive = archives.find((item) => item.id === archiveId);
  if (!archive) throw new Error("Không tìm thấy archive.");

  const formats = normalizeArchiveFormats(archive.formats);
  const plan = await getPlanState();
  const quotaCheck = validateQuota(plan, formats);
  if (!quotaCheck.ok) {
    return { ok: false, error: quotaCheck.error, code: quotaCheck.code, plan };
  }

  const task = {
    id: createId("task"),
    tabId: null,
    platform: archive.platform,
    platformName: archive.platformName,
    title: archive.title,
    sourceUrl: archive.url,
    formats,
    includeMeta: true,
    includeSignature: plan.features.removeSignature === false,
    presetId: archive.presetId || "archive_reexport",
    status: "running",
    progress: 20,
    steps: [
      { name: "archive", status: "done" },
      { name: "render", status: "pending" },
      { name: "download", status: "pending" }
    ],
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    archiveId: archive.id,
    outputFiles: []
  };
  await saveTask(task);

  try {
    const conversation = archive.conversation;
    const outputFiles = [];
    for (const format of formats) {
      const file = renderArchiveTextExport(conversation, format, task.includeSignature);
      const filename = `${buildArchiveFilename(conversation, format)}.${file.extension}`;
      await downloadFile(toDataUrl(file.text, `${file.mime};charset=utf-8`), filename);
      outputFiles.push(filename);
    }

    await updateTask(task.id, {
      status: "success",
      progress: 100,
      completedAt: new Date().toISOString(),
      outputFiles
    });
    await consumeQuota();
    return { ok: true, taskId: task.id, outputFiles };
  } catch (error) {
    await updateTask(task.id, {
      status: "failed",
      progress: 100,
      completedAt: new Date().toISOString(),
      error: error.message
    });
    return { ok: false, error: error.message };
  }
}

function compactConversation(conversation) {
  return {
    ...conversation,
    messages: conversation.messages.map((message) => ({
      ...message,
      content: message.content.length > 20000 ? `${message.content.slice(0, 20000)}\n\n[Truncated]` : message.content
    }))
  };
}

function normalizeArchiveFormats(formats) {
  const textFormats = new Set(["markdown", "json", "txt", "csv", "tsv", "jsonl", "html", "word"]);
  const normalized = (formats || []).filter((format) => textFormats.has(format));
  return normalized.length ? normalized : ["markdown"];
}

function renderArchiveTextExport(conversation, format, includeSignature) {
  const renderers = {
    markdown: () => ({
      text: archiveToMarkdown(conversation, includeSignature),
      mime: "text/markdown",
      extension: "md"
    }),
    json: () => ({
      text: JSON.stringify(archiveToJson(conversation, includeSignature), null, 2),
      mime: "application/json",
      extension: "json"
    }),
    txt: () => ({
      text: archiveToPlainText(conversation, includeSignature),
      mime: "text/plain",
      extension: "txt"
    }),
    csv: () => ({
      text: archiveToDelimited(conversation, ",", includeSignature),
      mime: "text/csv",
      extension: "csv"
    }),
    tsv: () => ({
      text: archiveToDelimited(conversation, "\t", includeSignature),
      mime: "text/tab-separated-values",
      extension: "tsv"
    }),
    jsonl: () => ({
      text: archiveToJsonl(conversation, includeSignature),
      mime: "application/x-ndjson",
      extension: "jsonl"
    }),
    html: () => ({
      text: archiveToHtml(conversation, includeSignature),
      mime: "text/html",
      extension: "html"
    }),
    word: () => ({
      text: archiveToWord(conversation, includeSignature),
      mime: "application/msword",
      extension: "doc"
    })
  };

  return (renderers[format] || renderers.markdown)();
}

function archiveToWord(conversation, includeSignature) {
  return archiveToHtml(conversation, includeSignature)
    .replace("<html lang=\"vi\">", '<html lang="vi" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">')
    .replace(
      "<head>",
      `<head>
  <meta name="ProgId" content="Word.Document">
  <meta name="Generator" content="ExportAI">`
    );
}

function archiveToMarkdown(conversation, includeSignature) {
  const lines = [];
  lines.push(`# ${conversation.title}`, "");
  lines.push(`- Platform: ${conversation.platformName}`);
  lines.push(`- URL: ${conversation.url}`);
  lines.push(`- Exported: ${new Date(conversation.capturedAt).toLocaleString()}`, "");

  conversation.messages.forEach((message, index) => {
    lines.push(`## ${index + 1}. ${labelRole(message.role)}`, "");
    lines.push(message.content, "");
    appendMarkdownAssets(lines, message.assets || []);
  });

  if (includeSignature) lines.push("---", freeSignature(), "");
  return lines.join("\n").trim() + "\n";
}

function archiveToJson(conversation, includeSignature) {
  const json = {
    ...conversation,
    meta: {
      ...(conversation.meta || {}),
      signature: includeSignature ? "Exported with ExportAI Free" : undefined,
      proRequiredToRemoveSignature: includeSignature
    }
  };
  if (!includeSignature) delete json.meta.signature;
  return json;
}

function archiveToPlainText(conversation, includeSignature) {
  const lines = [
    conversation.title,
    `Platform: ${conversation.platformName}`,
    `URL: ${conversation.url}`,
    `Exported: ${new Date(conversation.capturedAt).toLocaleString()}`,
    ""
  ];

  conversation.messages.forEach((message, index) => {
    lines.push(`${index + 1}. ${labelRole(message.role)}`);
    lines.push(message.content);
    appendPlainTextAssets(lines, message.assets || []);
    lines.push("");
  });

  if (includeSignature) lines.push("---", freeSignature());
  return lines.join("\n").trim() + "\n";
}

function archiveToDelimited(conversation, delimiter, includeSignature) {
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
    message.position?.order || "",
    message.role,
    message.roleConfidence || "",
    message.roleSource || "",
    message.content,
    (message.assets || []).length,
    (message.assets || []).filter((asset) => asset.type === "link").map(formatAssetText).join(" | "),
    (message.assets || []).filter((asset) => asset.type === "image").map(formatAssetText).join(" | "),
    (message.assets || []).filter((asset) => asset.type === "file").map(formatAssetText).join(" | "),
    message.position?.selector || "",
    message.position?.rect?.top || "",
    message.position?.rect?.left || "",
    message.position?.textHash || ""
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
      freeSignature(),
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

function archiveToJsonl(conversation, includeSignature) {
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
    records.push(JSON.stringify({
      schemaVersion: 1,
      conversationId: conversation.conversationId,
      type: "signature",
      content: freeSignature()
    }));
  }

  return records.join("\n") + "\n";
}

function archiveToHtml(conversation, includeSignature) {
  const signature = includeSignature ? `<footer>${escapeHtml(freeSignature())}</footer>` : "";
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
    .assets { margin-top: 12px; padding: 12px; border-radius: 8px; background: #eef5f1; }
    footer { margin-top: 28px; border-top: 1px solid #dfe5e1; padding-top: 12px; color: #68756f; font-size: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(conversation.title)}</h1>
    <div class="meta">${escapeHtml(conversation.platformName)} · ${escapeHtml(conversation.url)} · ${escapeHtml(new Date(conversation.capturedAt).toLocaleString())}</div>
    ${conversation.messages.map((message) => `<article>
      <div class="role">${escapeHtml(labelRole(message.role))}</div>
      <div class="content">${markdownLikeToHtml(message.content)}</div>
      ${renderHtmlAssets(message.assets || [])}
    </article>`).join("")}
    ${signature}
  </main>
</body>
</html>`;
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
  assets.forEach((asset) => lines.push(`- ${titleCase(asset.type)}: ${formatAssetText(asset)}`));
}

function renderHtmlAssets(assets) {
  if (!assets.length) return "";
  return `<aside class="assets"><strong>Assets</strong><ul>${assets.map((asset) => {
    if (asset.url) return `<li>${escapeHtml(titleCase(asset.type))}: <a href="${escapeHtml(asset.url)}">${escapeHtml(asset.title || asset.url)}</a></li>`;
    return `<li>${escapeHtml(titleCase(asset.type))}: ${escapeHtml(asset.title || "")}</li>`;
  }).join("")}</ul></aside>`;
}

function markdownLikeToHtml(markdown) {
  const parts = [];
  const fenceRegex = /```([^\n`]*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = fenceRegex.exec(markdown)) !== null) {
    parts.push(renderParagraphHtml(markdown.slice(lastIndex, match.index)));
    parts.push(`<pre><code data-language="${escapeHtml(match[1] || "")}">${escapeHtml(match[2] || "")}</code></pre>`);
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
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_match, alt, src) => `<img src="${src}" alt="${alt}">`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => `<a href="${href}">${label}</a>`);
}

function buildArchiveFilename(conversation, format) {
  const date = new Date().toISOString().slice(0, 10);
  const title = String(conversation.title || "conversation")
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u1EF9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `ExportAI-${conversation.platformName || conversation.platform}-${title || "conversation"}-${date}-archive-${format}`;
}

function toDataUrl(text, mime) {
  const encoded = encodeURIComponent(text).replace(/[!'()*]/g, (char) =>
    `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `data:${mime},${encoded}`;
}

function labelRole(role) {
  return role === "user" ? "Bạn" : "AI";
}

function freeSignature() {
  return "Exported with ExportAI Free - upgrade to Pro to remove this signature.";
}

function formatAssetText(asset) {
  if (asset.url) return `${asset.title || asset.url} (${asset.url})`;
  return asset.title || asset.alt || asset.type;
}

function titleCase(value) {
  const text = String(value || "");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function escapeDelimited(value, delimiter) {
  const text = String(value ?? "");
  const mustQuote =
    text.includes(delimiter) || text.includes('"') || text.includes("\n") || text.includes("\r");
  const escaped = text.replaceAll('"', '""');
  return mustQuote ? `"${escaped}"` : escaped;
}

function escapeMarkdownLinkText(value) {
  return String(value ?? "")
    .replaceAll("\\", "\\\\")
    .replaceAll("[", "\\[")
    .replaceAll("]", "\\]")
    .replaceAll("\n", " ")
    .trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function updateTask(taskId, patch) {
  const tasks = await getTasks();
  const nextTasks = tasks.map((task) =>
    task.id === taskId ? { ...task, ...patch } : task
  );
  await chrome.storage.local.set({ [STORAGE_KEYS.tasks]: nextTasks });
  return { ok: true };
}

async function getTasks() {
  const data = await chrome.storage.local.get(STORAGE_KEYS.tasks);
  return data[STORAGE_KEYS.tasks] || [];
}

async function getPlanState() {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const data = await chrome.storage.local.get(STORAGE_KEYS.plan);
  const stored = data[STORAGE_KEYS.plan] || {};
  const quota = stored.quota || {};

  const plan = {
    plan: stored.plan || "free",
    licenseStatus: stored.licenseStatus || "inactive",
    quota: {
      dailyLimit: quota.dailyLimit || FREE_LIMITS.dailyLimit,
      dailyUsed: quota.day === today ? quota.dailyUsed || 0 : 0,
      monthlyLimit: quota.monthlyLimit || FREE_LIMITS.monthlyLimit,
      monthlyUsed: quota.month === month ? quota.monthlyUsed || 0 : 0,
      day: today,
      month
    },
    features: {
      removeSignature: stored.features?.removeSignature || false,
      batchExport: stored.features?.batchExport || false,
      automation: stored.features?.automation || false,
      customTemplates: stored.features?.customTemplates || false
    }
  };

  await chrome.storage.local.set({ [STORAGE_KEYS.plan]: plan });
  return plan;
}

async function consumeQuota() {
  const plan = await getPlanState();
  if (plan.plan !== "free") return;

  plan.quota.dailyUsed += 1;
  plan.quota.monthlyUsed += 1;
  await chrome.storage.local.set({ [STORAGE_KEYS.plan]: plan });
}

function validateQuota(plan, formats) {
  if (plan.plan !== "free") return { ok: true };

  if (formats.length > 2) {
    return {
      ok: false,
      code: "FREE_FORMAT_LIMIT",
      error: "Gói Free chỉ export tối đa 2 định dạng mỗi lần."
    };
  }

  if (plan.quota.dailyUsed >= plan.quota.dailyLimit) {
    return {
      ok: false,
      code: "FREE_DAILY_LIMIT",
      error: "Bạn đã hết lượt export Free hôm nay."
    };
  }

  if (plan.quota.monthlyUsed >= plan.quota.monthlyLimit) {
    return {
      ok: false,
      code: "FREE_MONTHLY_LIMIT",
      error: "Bạn đã hết lượt export Free trong tháng này."
    };
  }

  return { ok: true };
}

function normalizeFormats(formats) {
  const allowed = new Set([
    "markdown",
    "json",
    "pdf",
    "png",
    "txt",
    "csv",
    "tsv",
    "jsonl",
    "html",
    "word"
  ]);
  const normalized = (formats || ["markdown"]).filter((format) => allowed.has(format));
  return normalized.length ? normalized : ["markdown"];
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

async function serverFetch(path, options = {}) {
  const settings = await getSettings();
  const baseUrl = String(settings.serverUrl || DEFAULT_SETTINGS.serverUrl).replace(/\/+$/, "");
  const headers = {
    "content-type": "application/json"
  };

  if (settings.licenseKey) {
    headers.authorization = `Bearer ${settings.licenseKey}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  return {
    ok: response.ok && json.ok !== false,
    statusCode: response.status,
    ...json
  };
}

function hashString(value) {
  const text = String(value || "");
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
