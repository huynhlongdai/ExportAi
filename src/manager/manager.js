const taskListEl = document.querySelector("#taskList");
const taskFiltersEl = document.querySelector("#taskFilters");
const planSummaryEl = document.querySelector("#planSummary");
const refreshButton = document.querySelector("#refreshButton");
const viewButtons = [...document.querySelectorAll("[data-view]")];
const filterButtons = [...document.querySelectorAll("[data-filter]")];
let activeView = "tasks";
let activeFilter = "all";
let managerState = {
  tasks: [],
  plan: null,
  presets: [],
  archives: [],
  diagnostics: [],
  rules: [],
  adapters: []
  ,
  settings: null
};

refreshButton.addEventListener("click", loadManager);
viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeView = button.dataset.view;
    viewButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderManager();
  });
});
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter;
    filterButtons.forEach((item) => item.classList.toggle("active", item === button));
    renderManager();
  });
});

taskListEl.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;

  const taskId = button.closest("[data-task-id]")?.dataset.taskId;
  const archiveId = button.closest("[data-archive-id]")?.dataset.archiveId;
  const diagnosticId = button.closest("[data-diagnostic-id]")?.dataset.diagnosticId;
  const ruleId = button.closest("[data-rule-id]")?.dataset.ruleId;
  const presetId = button.closest("[data-preset-id]")?.dataset.presetId;

  if (button.dataset.action === "run" && taskId) {
    await chrome.runtime.sendMessage({ type: "EXPORT_AI_RUN_TASK_BY_ID", taskId });
  }

  if (button.dataset.action === "delete" && taskId) {
    await chrome.runtime.sendMessage({ type: "EXPORT_AI_DELETE_TASK", taskId });
  }

  if (button.dataset.action === "delete-archive" && archiveId) {
    await chrome.runtime.sendMessage({ type: "EXPORT_AI_DELETE_ARCHIVE", archiveId });
  }

  if (button.dataset.action === "reexport-archive" && archiveId) {
    await chrome.runtime.sendMessage({ type: "EXPORT_AI_REEXPORT_ARCHIVE", archiveId });
  }

  if (button.dataset.action === "delete-diagnostic" && diagnosticId) {
    await chrome.runtime.sendMessage({ type: "EXPORT_AI_DELETE_DIAGNOSTIC", diagnosticId });
  }

  if (button.dataset.action === "toggle-rule" && ruleId) {
    await chrome.runtime.sendMessage({
      type: "EXPORT_AI_TOGGLE_RULE",
      ruleId,
      enabled: button.dataset.enabled !== "true"
    });
  }

  if (button.dataset.action === "delete-rule" && ruleId) {
    await chrome.runtime.sendMessage({ type: "EXPORT_AI_DELETE_RULE", ruleId });
  }

  if (button.dataset.action === "create-rule") {
    await createRuleFromForm();
  }

  if (button.dataset.action === "import-adapter") {
    await importAdapterFromTextarea();
  }

  if (button.dataset.action === "fetch-remote-adapters") {
    await chrome.runtime.sendMessage({ type: "EXPORT_AI_FETCH_REMOTE_ADAPTERS" });
  }

  if (button.dataset.action === "save-settings") {
    await saveSettingsFromForm();
  }

  if (button.dataset.action === "validate-license") {
    await validateLicenseFromSettings();
  }

  if (button.dataset.action === "upload-diagnostic" && diagnosticId) {
    await chrome.runtime.sendMessage({
      type: "EXPORT_AI_UPLOAD_DIAGNOSTIC",
      diagnosticId,
      privacyMode: "private"
    });
  }

  if (button.dataset.action === "request-repair" && diagnosticId) {
    await chrome.runtime.sendMessage({
      type: "EXPORT_AI_REQUEST_REPAIR",
      diagnosticId,
      privacyMode: "debug"
    });
  }

  if (button.dataset.action === "create-link-job") {
    await createLinkJobFromForm();
  }

  if (button.dataset.action === "create-preset") {
    await createPresetFromForm();
  }

  if (button.dataset.action === "delete-preset" && presetId) {
    await chrome.runtime.sendMessage({ type: "EXPORT_AI_DELETE_PRESET", presetId });
  }

  await loadManager();
});

loadManager();

async function loadManager() {
  const response = await chrome.runtime.sendMessage({ type: "EXPORT_AI_GET_MANAGER_STATE" });
  if (!response?.ok) {
    taskListEl.innerHTML = `<div class="empty">Không tải được manager state.</div>`;
    return;
  }

  managerState = response;
  renderManager();
}

function renderManager() {
  renderPlanSummary();
  taskFiltersEl.hidden = activeView !== "tasks";

  if (activeView === "tasks") renderTasks();
  if (activeView === "archives") renderArchives();
  if (activeView === "diagnostics") renderDiagnostics();
  if (activeView === "adapters") renderAdapters();
  if (activeView === "rules") renderRules();
  if (activeView === "presets") renderPresets();
  if (activeView === "settings") renderSettings();
  if (activeView === "plan") renderPlan();
}

function renderSettings() {
  const settings = managerState.settings || {};
  taskListEl.innerHTML = `<article class="card full">
    <div>
      <h2>Export settings</h2>
      <label class="settings-row">
        <input type="checkbox" data-setting="includeMetaDefault" ${settings.includeMetaDefault !== false ? "checked" : ""}>
        <span>Include metadata by default</span>
      </label>
      <label class="settings-row">
        <input type="checkbox" data-setting="includeAssets" ${settings.includeAssets !== false ? "checked" : ""}>
        <span>Include links, images, and file hints</span>
      </label>
      <label class="settings-row">
        <input type="checkbox" data-setting="removeUiWrappers" ${settings.removeUiWrappers !== false ? "checked" : ""}>
        <span>Remove UI wrappers like "Bạn đã nói"</span>
      </label>
      <label class="settings-row">
        <input type="checkbox" data-setting="removeToolFailureNotices" ${settings.removeToolFailureNotices ? "checked" : ""}>
        <span>Remove tool failure notices</span>
      </label>
      <label class="settings-row">
        <input type="checkbox" data-setting="enableFallbackExport" ${settings.enableFallbackExport !== false ? "checked" : ""}>
        <span>Use raw text fallback when message selectors fail</span>
      </label>
      <label class="settings-row">
        <input type="checkbox" data-setting="autoFetchRemoteAdapters" ${settings.autoFetchRemoteAdapters ? "checked" : ""}>
        <span>Auto fetch remote adapter configs when server is available</span>
      </label>
      <label class="settings-field">
        <span>Server URL</span>
        <input type="url" data-setting="serverUrl" value="${escapeHtml(settings.serverUrl || "http://127.0.0.1:8787")}">
      </label>
      <label class="settings-field">
        <span>License key</span>
        <input type="text" data-setting="licenseKey" value="${escapeHtml(settings.licenseKey || "")}" placeholder="free-local-dev or live license key">
      </label>
      <label class="settings-field">
        <span>Default preset id</span>
        <input type="text" data-setting="defaultPresetId" value="${escapeHtml(settings.defaultPresetId || "ai_archive")}">
      </label>
      <label class="settings-field">
        <span>Filename pattern</span>
        <input type="text" data-setting="filenamePattern" value="${escapeHtml(settings.filenamePattern || "")}">
      </label>
      <div id="settingsStatus" class="task-meta"></div>
    </div>
    <div>
      <button type="button" data-action="save-settings">Save</button>
      <button type="button" data-action="validate-license">Validate license</button>
    </div>
  </article>`;
}

async function saveSettingsFromForm() {
  const patch = {};
  document.querySelectorAll("[data-setting]").forEach((input) => {
    const key = input.dataset.setting;
    patch[key] = input.type === "checkbox" ? input.checked : input.value;
  });

  const response = await chrome.runtime.sendMessage({
    type: "EXPORT_AI_UPDATE_SETTINGS",
    patch
  });
  const status = document.querySelector("#settingsStatus");
  if (status) status.textContent = response?.ok ? "Settings saved." : response?.error || "Could not save settings.";
}

async function validateLicenseFromSettings() {
  await saveSettingsFromForm();
  const response = await chrome.runtime.sendMessage({ type: "EXPORT_AI_VALIDATE_LICENSE" });
  const status = document.querySelector("#settingsStatus");
  if (status) status.textContent = response?.ok ? "License active. Pro features unlocked." : response?.error || "License validation failed.";
}

function renderAdapters() {
  if (!managerState.adapters.length) {
    taskListEl.innerHTML = `<div class="empty">Chưa có adapter registry.</div>`;
    return;
  }

  taskListEl.innerHTML = `${renderAdapterImportBox()}${managerState.adapters.map(renderAdapter).join("")}`;
}

function renderAdapterImportBox() {
  return `<article class="card full">
    <div>
      <h2>Import adapter config</h2>
      <div class="task-meta">Paste a validated adapter JSON object. Only selectors and selector groups are accepted; remote JavaScript is never executed.</div>
      <textarea id="adapterImportInput" spellcheck="false" placeholder='{"id":"chatgpt","version":"2026.05.28.2","selectors":["[data-message-author-role]"],"selectorGroups":[["[data-message-author-role]"]]}'></textarea>
      <div id="adapterImportStatus" class="task-meta"></div>
    </div>
    <div>
      <button type="button" data-action="import-adapter">Import</button>
      <button type="button" data-action="fetch-remote-adapters">Fetch remote</button>
    </div>
  </article>`;
}

async function importAdapterFromTextarea() {
  const input = document.querySelector("#adapterImportInput");
  const status = document.querySelector("#adapterImportStatus");
  if (!input || !status) return;

  try {
    const adapter = JSON.parse(input.value);
    const response = await chrome.runtime.sendMessage({
      type: "EXPORT_AI_IMPORT_ADAPTER",
      adapter
    });
    if (!response?.ok) throw new Error(response?.error || "Import failed.");
    status.textContent = "Adapter imported. Reload the chat tab to apply it.";
    await loadManager();
  } catch (error) {
    status.textContent = error.message;
  }
}

function renderAdapter(adapter) {
  const diagnosticCount = managerState.diagnostics.filter(
    (diagnostic) => diagnostic.platform === adapter.id
  ).length;
  const groups = (adapter.selectorGroups || [])
    .map((group) => `<span>${escapeHtml(group.join(", "))}</span>`)
    .join("");

  return `<article class="card">
    <div>
      <h2>${escapeHtml(adapter.name)}</h2>
      <div class="task-meta">Version: ${escapeHtml(adapter.version)} · Source: ${escapeHtml(adapter.source)} · Status: ${escapeHtml(adapter.status)}</div>
      <div class="task-meta">Hosts: ${escapeHtml((adapter.hosts || []).join(", "))}</div>
      ${adapter.lastRemoteError ? `<div class="task-meta">Remote error: ${escapeHtml(adapter.lastRemoteError)}</div>` : ""}
      <div class="format-row diagnostics">${groups}</div>
    </div>
    <div>
      <div class="badge${diagnosticCount ? " failed" : ""}">${diagnosticCount} diagnostics</div>
    </div>
  </article>`;
}

function renderRules() {
  if (!managerState.rules.length) {
    taskListEl.innerHTML = `<div class="empty">Chưa có rule.</div>`;
    return;
  }

  taskListEl.innerHTML = `${renderRuleBuilder()}${managerState.rules.map(renderRule).join("")}`;
}

function renderRuleBuilder() {
  const presetOptions = managerState.presets
    .map((preset) => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`)
    .join("");
  const platformOptions = [
    ["any", "Any supported platform"],
    ["chatgpt", "ChatGPT"],
    ["grok", "Grok"],
    ["gemini", "Gemini"]
  ]
    .map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`)
    .join("");

  return `<article class="card full">
    <div>
      <h2>Create automation rule</h2>
      <div class="task-meta">Custom rules are Pro-gated. They run against the active supported AI tab when conditions match.</div>
      <label class="settings-field">
        <span>Name</span>
        <input type="text" id="ruleName" value="Scheduled AI archive">
      </label>
      <label class="settings-field">
        <span>Platform</span>
        <select id="rulePlatform">${platformOptions}</select>
      </label>
      <label class="settings-field">
        <span>Interval minutes</span>
        <input type="text" id="ruleInterval" value="60">
      </label>
      <label class="settings-field">
        <span>Title contains</span>
        <input type="text" id="ruleTitle" placeholder="Optional">
      </label>
      <label class="settings-field">
        <span>URL match</span>
        <input type="url" id="ruleUrl" placeholder="Optional">
      </label>
      <label class="settings-field">
        <span>Preset</span>
        <select id="rulePreset">${presetOptions}</select>
      </label>
      <div id="ruleStatus" class="task-meta"></div>
    </div>
    <div>
      <button type="button" data-action="create-rule">Create rule</button>
    </div>
  </article>`;
}

async function createRuleFromForm() {
  const preset = managerState.presets.find((item) => item.id === document.querySelector("#rulePreset")?.value) || managerState.presets[0];
  const response = await chrome.runtime.sendMessage({
    type: "EXPORT_AI_CREATE_RULE",
    rule: {
      name: document.querySelector("#ruleName")?.value || "Scheduled AI archive",
      matchPlatform: document.querySelector("#rulePlatform")?.value || "any",
      intervalMinutes: document.querySelector("#ruleInterval")?.value || 60,
      matchTitle: document.querySelector("#ruleTitle")?.value || "",
      matchUrl: document.querySelector("#ruleUrl")?.value || "",
      presetId: preset?.id || "ai_archive",
      formats: preset?.formats || ["markdown", "json"],
      includeMeta: preset?.includeMeta !== false,
      enabled: true
    }
  });
  const status = document.querySelector("#ruleStatus");
  if (status) status.textContent = response?.ok ? "Rule created." : response?.error || "Could not create rule.";
}

function renderRule(rule) {
  const formats = (rule.formats || []).map((format) => format.toUpperCase()).join(", ");
  const nextRun = rule.nextRunAt ? new Date(rule.nextRunAt).toLocaleString() : "Not scheduled";
  const lastRun = rule.lastRunAt ? new Date(rule.lastRunAt).toLocaleString() : "Never";
  const locked = rule.requiresPro && managerState.plan?.plan === "free";

  return `<article class="card" data-rule-id="${escapeHtml(rule.id)}">
    <div>
      <h2>${escapeHtml(rule.name)}</h2>
      <div class="task-meta">${escapeHtml(rule.description || "")}</div>
      <div class="task-meta">Every ${escapeHtml(rule.intervalMinutes)} minutes · ${escapeHtml(formats)}</div>
      <div class="task-meta">Last: ${escapeHtml(lastRun)} · Next: ${escapeHtml(nextRun)}</div>
      ${rule.lastError ? `<div class="task-meta">Last error: ${escapeHtml(rule.lastError)}</div>` : ""}
    </div>
    <div>
      <div class="badge${locked ? " failed" : ""}">${locked ? "Pro" : rule.enabled ? "On" : "Off"}</div>
      <div class="task-actions">
        <button type="button" data-action="toggle-rule" data-enabled="${rule.enabled}" ${locked ? "disabled" : ""}>${rule.enabled ? "Disable" : "Enable"}</button>
        <button type="button" data-action="delete-rule">Delete</button>
      </div>
    </div>
  </article>`;
}

function renderDiagnostics() {
  if (!managerState.diagnostics.length) {
    taskListEl.innerHTML = `<div class="empty">Chưa có diagnostic report. Khi export lỗi, report riêng tư sẽ xuất hiện ở đây.</div>`;
    return;
  }

  taskListEl.innerHTML = managerState.diagnostics.map(renderDiagnostic).join("");
}

function renderDiagnostic(record) {
  const capturedAt = new Date(record.capturedAt).toLocaleString();
  const selectorResults = record.diagnostic?.selectorResults || {};
  const selectorSummary = Object.entries(selectorResults)
    .slice(0, 8)
    .map(([selector, count]) => `<span>${escapeHtml(selector)}: ${escapeHtml(count)}</span>`)
    .join("");

  return `<article class="card" data-diagnostic-id="${escapeHtml(record.id)}">
    <div>
      <h2>${escapeHtml(record.errorType || "Diagnostic")}</h2>
      <div class="task-meta">${escapeHtml(record.platformName || record.platform)} · ${capturedAt}</div>
      <div class="task-meta">${escapeHtml(record.errorMessage || "")}</div>
      <div class="task-meta">${escapeHtml(record.sourceUrl || "")}</div>
      ${record.uploadedAt ? `<div class="task-meta">Uploaded: ${escapeHtml(new Date(record.uploadedAt).toLocaleString())}</div>` : ""}
      ${record.repairStatus ? `<div class="task-meta">Repair: ${escapeHtml(record.repairStatus)} ${record.repairProposalId ? `· ${escapeHtml(record.repairProposalId)}` : ""}</div>` : ""}
      ${record.uploadError ? `<div class="task-meta">Upload error: ${escapeHtml(record.uploadError)}</div>` : ""}
      ${record.repairError ? `<div class="task-meta">Repair error: ${escapeHtml(record.repairError)}</div>` : ""}
      <div class="format-row diagnostics">${selectorSummary}</div>
    </div>
    <div>
      <div class="badge failed">Local</div>
      <div class="task-actions">
        <button type="button" data-action="upload-diagnostic">Upload</button>
        <button type="button" data-action="request-repair">Try repair</button>
        <button type="button" data-action="delete-diagnostic">Delete</button>
      </div>
    </div>
  </article>`;
}

function renderArchives() {
  if (!managerState.archives.length) {
    taskListEl.innerHTML = `<div class="empty">Chưa có archive. Export thành công một hội thoại để lưu snapshot.</div>`;
    return;
  }

  taskListEl.innerHTML = managerState.archives.map(renderArchive).join("");
}

function renderArchive(archive) {
  const capturedAt = new Date(archive.capturedAt).toLocaleString();
  const formats = (archive.formats || []).map((format) => format.toUpperCase()).join(", ");
  return `<article class="card" data-archive-id="${escapeHtml(archive.id)}">
    <div>
      <h2>${escapeHtml(archive.title || "AI conversation")}</h2>
      <div class="task-meta">${escapeHtml(archive.platformName || archive.platform)} · ${archive.messageCount} messages · ${archive.assetCount} assets · ${capturedAt}</div>
      <div class="task-meta">Formats: ${escapeHtml(formats || "None")}</div>
      <div class="task-meta">${escapeHtml(archive.url || "")}</div>
    </div>
    <div>
      <div class="badge">Archived</div>
      <div class="task-actions">
        <button type="button" data-action="reexport-archive">Re-export</button>
        <button type="button" data-action="delete-archive">Delete</button>
      </div>
    </div>
  </article>`;
}

function renderPlanSummary() {
  const plan = managerState.plan;
  if (!plan) {
    planSummaryEl.textContent = "Đang tải quota...";
    return;
  }

  const remaining = Math.max(0, plan.quota.dailyLimit - plan.quota.dailyUsed);
  planSummaryEl.textContent = `${plan.plan.toUpperCase()} · còn ${remaining}/${plan.quota.dailyLimit} exports hôm nay`;
}

function renderTasks() {
  const visibleTasks =
    activeFilter === "all"
      ? managerState.tasks
      : managerState.tasks.filter((task) => task.status === activeFilter);

  const linkJobBox = renderLinkJobBox();

  if (!visibleTasks.length) {
    taskListEl.innerHTML = `${linkJobBox}<div class="empty">Chưa có task nào trong nhóm này.</div>`;
    return;
  }

  taskListEl.innerHTML = `${linkJobBox}${visibleTasks.map(renderTask).join("")}`;
}

function renderLinkJobBox() {
  const presetOptions = managerState.presets
    .map((preset) => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`)
    .join("");

  return `<article class="card full">
    <div>
      <h2>Create job from chat link</h2>
      <div class="task-meta">Paste a ChatGPT, Grok, or Gemini conversation link. The job waits until you open that link in Chrome, then exports with your logged-in session.</div>
      <label class="settings-field">
        <span>Chat link</span>
        <input type="url" id="linkJobUrl" placeholder="https://chatgpt.com/c/...">
      </label>
      <label class="settings-field">
        <span>Preset</span>
        <select id="linkJobPreset">${presetOptions}</select>
      </label>
      <div id="linkJobStatus" class="task-meta"></div>
    </div>
    <div>
      <button type="button" data-action="create-link-job">Create job</button>
    </div>
  </article>`;
}

async function createLinkJobFromForm() {
  const urlInput = document.querySelector("#linkJobUrl");
  const presetSelect = document.querySelector("#linkJobPreset");
  const status = document.querySelector("#linkJobStatus");
  const preset = managerState.presets.find((item) => item.id === presetSelect?.value) || managerState.presets[0];

  try {
    const response = await chrome.runtime.sendMessage({
      type: "EXPORT_AI_CREATE_LINK_JOB",
      sourceUrl: urlInput?.value || "",
      formats: preset?.formats || ["markdown"],
      includeMeta: preset?.includeMeta !== false,
      presetId: preset?.id || "ai_archive"
    });
    if (!response?.ok) throw new Error(response?.error || "Không tạo được job.");
    if (status) status.textContent = "Waiting job created. Open that chat link to run export.";
  } catch (error) {
    if (status) status.textContent = error.message;
  }
}

function renderTask(task) {
  const statusClass = task.status === "failed" ? " failed" : "";
  const createdAt = new Date(task.createdAt).toLocaleString();
  const formats = task.formats.map((format) => format.toUpperCase()).join(", ");
  const error = task.error ? `<div class="task-meta">Lỗi: ${escapeHtml(task.error)}</div>` : "";
  const preset = task.presetId ? `<div class="task-meta">Preset: ${escapeHtml(task.presetId)}</div>` : "";
  const waiting = task.status === "waiting_for_tab" ? `<div class="task-meta">Waiting for: ${escapeHtml(task.matchUrl || task.sourceUrl || "")}</div>` : "";

  const canRun = task.status === "queued" || task.status === "failed";
  const actions = `<div class="task-actions">
    ${canRun ? `<button type="button" data-action="run">${task.status === "failed" ? "Retry" : "Run"}</button>` : ""}
    <button type="button" data-action="delete">Delete</button>
  </div>`;

  return `<article class="task" data-task-id="${escapeHtml(task.id)}">
    <div>
      <h2>${escapeHtml(task.title || "AI conversation")}</h2>
      <div class="task-meta">${escapeHtml(task.platformName || task.platform)} · ${formats} · ${createdAt}</div>
      ${preset}
      ${waiting}
      ${error}
    </div>
    <div>
      <div class="badge${statusClass}">${escapeHtml(task.status)}</div>
      ${actions}
    </div>
  </article>`;
}

function renderPresets() {
  const presetBuilder = renderPresetBuilder();

  if (!managerState.presets.length) {
    taskListEl.innerHTML = `${presetBuilder}<div class="empty">Chưa có preset.</div>`;
    return;
  }

  taskListEl.innerHTML = presetBuilder + managerState.presets
    .map(
      (preset) => `<article class="card" data-preset-id="${escapeHtml(preset.id)}">
        <div>
          <h2>${escapeHtml(preset.name)}</h2>
          <div class="task-meta">${escapeHtml(preset.description || "")}</div>
          <div class="format-row">${preset.formats.map((format) => `<span>${escapeHtml(format.toUpperCase())}</span>`).join("")}</div>
        </div>
        <div>
          <div class="badge${preset.proRequired ? " failed" : ""}">${preset.proRequired ? "Pro" : preset.custom ? "Custom" : "Free"}</div>
          ${preset.custom ? `<div class="task-actions"><button type="button" data-action="delete-preset">Delete</button></div>` : ""}
        </div>
      </article>`
    )
    .join("");
}

function renderPresetBuilder() {
  return `<article class="card full">
    <div>
      <h2>Create custom preset</h2>
      <div class="task-meta">Custom presets are Pro-gated. Use comma-separated formats: markdown,json,pdf,png,txt,csv,tsv,jsonl,html.</div>
      <label class="settings-field">
        <span>Name</span>
        <input type="text" id="presetName" value="Research backup">
      </label>
      <label class="settings-field">
        <span>Description</span>
        <input type="text" id="presetDescription" value="Markdown, JSONL, and HTML with metadata.">
      </label>
      <label class="settings-field">
        <span>Formats</span>
        <input type="text" id="presetFormats" value="markdown,jsonl,html">
      </label>
      <label class="settings-row">
        <input type="checkbox" id="presetIncludeMeta" checked>
        <span>Include metadata</span>
      </label>
      <div id="presetStatus" class="task-meta"></div>
    </div>
    <div>
      <button type="button" data-action="create-preset">Create preset</button>
    </div>
  </article>`;
}

async function createPresetFromForm() {
  const formats = String(document.querySelector("#presetFormats")?.value || "markdown")
    .split(",")
    .map((format) => format.trim())
    .filter(Boolean);
  const response = await chrome.runtime.sendMessage({
    type: "EXPORT_AI_CREATE_PRESET",
    preset: {
      name: document.querySelector("#presetName")?.value || "Custom preset",
      description: document.querySelector("#presetDescription")?.value || "",
      formats,
      includeMeta: document.querySelector("#presetIncludeMeta")?.checked !== false
    }
  });
  const status = document.querySelector("#presetStatus");
  if (status) status.textContent = response?.ok ? "Preset created." : response?.error || "Could not create preset.";
}

function renderPlan() {
  const plan = managerState.plan;
  if (!plan) {
    taskListEl.innerHTML = `<div class="empty">Không tải được plan.</div>`;
    return;
  }

  const dailyRemaining = Math.max(0, plan.quota.dailyLimit - plan.quota.dailyUsed);
  const monthlyRemaining = Math.max(0, plan.quota.monthlyLimit - plan.quota.monthlyUsed);
  taskListEl.innerHTML = `<article class="card">
    <div>
      <h2>${escapeHtml(plan.plan.toUpperCase())} plan</h2>
      <div class="task-meta">License: ${escapeHtml(plan.licenseStatus)}</div>
      <div class="metric-grid">
        <div><strong>${dailyRemaining}</strong><span>daily remaining</span></div>
        <div><strong>${monthlyRemaining}</strong><span>monthly remaining</span></div>
        <div><strong>${plan.features.removeSignature ? "Off" : "On"}</strong><span>Free signature</span></div>
      </div>
    </div>
  </article>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
