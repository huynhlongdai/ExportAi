const statusEl = document.querySelector("#status");
const commandPanelEl = document.querySelector("#commandPanel");
const includeMetaEl = document.querySelector("#includeMeta");
const presetSelectEl = document.querySelector("#presetSelect");
const formatButtons = [...document.querySelectorAll("button[data-format]")];
const quickExportButton = document.querySelector("#quickExport");
const openFloatingButton = document.querySelector("#openFloating");
const openManagerButton = document.querySelector("#openManager");
const selectedFormats = new Set(["markdown"]);
let activeTab;
let pageSummary;
let planState;
let presets = [];
let settings = null;
let managerState = null;
let activePresetId = "custom";

formatButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const format = button.dataset.format;
    if (selectedFormats.has(format)) {
      selectedFormats.delete(format);
    } else {
      selectedFormats.add(format);
    }
    if (!selectedFormats.size) selectedFormats.add("markdown");
    renderFormatButtons();
  });
});

quickExportButton.addEventListener("click", quickExport);
presetSelectEl.addEventListener("change", () => {
  activePresetId = presetSelectEl.value;
  const preset = presets.find((item) => item.id === activePresetId);
  if (preset) applyPreset(preset);
});
openFloatingButton.addEventListener("click", async () => {
  setBusy(true, "Đang mở floating tool...");
  try {
    const response = await chrome.runtime.sendMessage({ type: "EXPORT_AI_OPEN_FLOATING" });
    if (!response?.ok) throw new Error(response?.error || "Không mở được floating tool.");
    window.close();
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    setBusy(false);
  }
});
openManagerButton.addEventListener("click", async () => {
  await chrome.runtime.sendMessage({ type: "EXPORT_AI_OPEN_MANAGER" });
  window.close();
});

initPopup();

async function initPopup() {
  try {
    [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const [summaryResponse, planResponse, presetResponse, settingsResponse, managerResponse] = await Promise.all([
      chrome.runtime.sendMessage({ type: "EXPORT_AI_GET_PAGE_SUMMARY" }),
      chrome.runtime.sendMessage({ type: "EXPORT_AI_GET_PLAN" }),
      chrome.runtime.sendMessage({ type: "EXPORT_AI_GET_PRESETS" }),
      chrome.runtime.sendMessage({ type: "EXPORT_AI_GET_SETTINGS" }),
      chrome.runtime.sendMessage({ type: "EXPORT_AI_GET_MANAGER_STATE" })
    ]);

    pageSummary = summaryResponse?.summary;
    planState = planResponse?.plan;
    presets = presetResponse?.presets || [];
    settings = settingsResponse?.settings || null;
    managerState = managerResponse?.ok ? managerResponse : null;
    includeMetaEl.checked = settings?.includeMetaDefault !== false;
    renderPresets();

    if (!pageSummary?.supported) {
      statusEl.textContent = "Không thấy trang AI chat được hỗ trợ.";
      renderCommandPanel(null, 0);
      quickExportButton.disabled = true;
      openFloatingButton.disabled = true;
      return;
    }

    const remaining = Math.max(0, planState.quota.dailyLimit - planState.quota.dailyUsed);
    statusEl.textContent = `${pageSummary.platformName}: ${pageSummary.userMessageCount} user / ${pageSummary.assistantMessageCount} AI · Free còn ${remaining}/${planState.quota.dailyLimit}`;
    const diagnosticCount = (managerState?.diagnostics || []).filter((diagnostic) => diagnostic.platform === pageSummary.platform).length;
    renderCommandPanel(pageSummary, diagnosticCount);
  } catch (error) {
    statusEl.textContent = "Mở trang AI chat rồi thử lại.";
    renderCommandPanel(null, 0);
    quickExportButton.disabled = true;
    openFloatingButton.disabled = true;
  }
}

function renderCommandPanel(summary, diagnosticCount) {
  if (!commandPanelEl) return;
  commandPanelEl.hidden = false;
  if (!summary?.supported) {
    commandPanelEl.innerHTML = `<div><strong>No supported chat detected</strong><span>Open ChatGPT, Grok, Gemini, Perplexity, Claude, Copilot, Devin, or Lovable.</span></div>`;
    return;
  }

  const plan = planState?.plan?.toUpperCase?.() || "FREE";
  const server = managerState?.serverStatus?.online ? `Server v${managerState.serverStatus.version}` : "Server offline";
  commandPanelEl.innerHTML = `<div>
    <strong>${escapeHtml(summary.platformName)} detected</strong>
    <span>${escapeHtml(summary.messageCount)} messages · ${escapeHtml(plan)} · ${escapeHtml(server)}</span>
  </div>
  ${diagnosticCount ? `<div class="warning">${diagnosticCount} diagnostics for this provider</div>` : ""}`;
}

async function quickExport() {
  setBusy(true, "Đang tạo task export...");

  try {
    if (!activeTab?.id) throw new Error("Không tìm thấy tab hiện tại.");
    const response = await chrome.runtime.sendMessage({
      type: "EXPORT_AI_CREATE_TASK",
      tabId: activeTab.id,
      platform: pageSummary.platform,
      platformName: pageSummary.platformName,
      title: pageSummary.title,
      sourceUrl: pageSummary.sourceUrl,
      formats: [...selectedFormats],
      includeMeta: includeMetaEl.checked,
      exportOptions: {
        includeAssets: settings?.includeAssets !== false,
        removeUiWrappers: settings?.removeUiWrappers !== false,
        removeToolFailureNotices: settings?.removeToolFailureNotices === true
      },
      presetId: activePresetId,
      runNow: true
    });

    if (!response?.ok) {
      throw new Error(response?.error || "Không tạo được task export.");
    }

    statusEl.textContent = "Đã tạo task. File sẽ tải xuống khi export xong.";
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    setBusy(false);
  }
}

function renderFormatButtons() {
  formatButtons.forEach((button) => {
    button.classList.toggle("active", selectedFormats.has(button.dataset.format));
  });
  if (!presets.some((preset) => preset.id === activePresetId && sameFormats(preset.formats, [...selectedFormats]))) {
    activePresetId = "custom";
    presetSelectEl.value = "custom";
  }
}

function renderPresets() {
  presetSelectEl.innerHTML = [
    `<option value="custom">Custom formats</option>`,
    ...presets.map((preset) => `<option value="${escapeHtml(preset.id)}">${escapeHtml(preset.name)}</option>`)
  ].join("");

  const defaultPreset = presets.find((preset) => preset.id === settings?.defaultPresetId) || presets.find((preset) => preset.id === "ai_archive") || presets[0];
  if (defaultPreset) {
    activePresetId = defaultPreset.id;
    presetSelectEl.value = defaultPreset.id;
    applyPreset(defaultPreset);
  }
}

function applyPreset(preset) {
  selectedFormats.clear();
  preset.formats.forEach((format) => selectedFormats.add(format));
  includeMetaEl.checked = preset.includeMeta !== false;
  renderFormatButtons();
}

function sameFormats(left, right) {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((format) => rightSet.has(format));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setBusy(isBusy, message) {
  [...formatButtons, quickExportButton, openFloatingButton, openManagerButton].forEach((button) => {
    button.disabled = isBusy;
  });

  if (message) statusEl.textContent = message;
}
