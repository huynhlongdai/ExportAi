#!/usr/bin/env node

const http = require("node:http");
const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");

const PORT = Number(process.env.EXPORTAI_PORT || 8787);
const ADMIN_TOKEN = process.env.EXPORTAI_ADMIN_TOKEN || "dev-admin-token";
const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE = path.join(DATA_DIR, "store.json");
const ADMIN_HTML_FILE = path.join(__dirname, "admin.html");
const SERVER_VERSION = "0.2.0";
const STORE_SCHEMA_VERSION = 2;

const DEFAULT_STORE = {
  schemaVersion: STORE_SCHEMA_VERSION,
  licenses: {
    "free-local-dev": {
      status: "active",
      plan: "pro",
      quota: { dailyLimit: 999999, monthlyLimit: 999999 },
      features: {
        removeSignature: true,
        batchExport: true,
        automation: true,
        customTemplates: true,
        aiRepair: true,
        remoteAdapters: true
      }
    }
  },
  adapters: {
    chatgpt: [],
    grok: [],
    gemini: [],
    perplexity: [],
    claude: [],
    copilot: [],
    devin: [],
    lovable: []
  },
  diagnostics: [],
  proposals: []
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") {
      return sendJson(response, 204, {});
    }

    const url = new URL(request.url, `http://${request.headers.host}`);
    const body = await readJsonBody(request);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/admin")) {
      return handleAdminUi(response);
    }

    if (request.method === "GET" && url.pathname === "/health") {
      return sendJson(response, 200, { ok: true, service: "exportai-server", time: new Date().toISOString() });
    }

    if (request.method === "GET" && url.pathname === "/api/status") {
      return handleStatus(response);
    }

    if (request.method === "POST" && url.pathname === "/api/license/validate") {
      return handleLicenseValidate(response, body);
    }

    const adapterLatestMatch = url.pathname.match(/^\/api\/adapters\/([^/]+)\/latest$/);
    if (request.method === "GET" && adapterLatestMatch) {
      return handleAdapterLatest(response, adapterLatestMatch[1]);
    }

    const adapterPublishMatch = url.pathname.match(/^\/api\/adapters\/([^/]+)$/);
    if (request.method === "POST" && adapterPublishMatch) {
      requireAdmin(request);
      return handleAdapterPublish(response, adapterPublishMatch[1], body);
    }

    const adapterRollbackMatch = url.pathname.match(/^\/api\/adapters\/([^/]+)\/rollback$/);
    if (request.method === "POST" && adapterRollbackMatch) {
      requireAdmin(request);
      return handleAdapterRollback(response, adapterRollbackMatch[1], body);
    }

    if (request.method === "POST" && url.pathname === "/api/diagnostics") {
      return handleDiagnosticCreate(response, body);
    }

    if (request.method === "GET" && url.pathname === "/api/diagnostics") {
      requireAdmin(request);
      const store = await readStore();
      return sendJson(response, 200, { ok: true, ...paginate(store.diagnostics, url) });
    }

    if (request.method === "POST" && url.pathname === "/api/repair/proposals") {
      return handleRepairProposal(response, body);
    }

    if (request.method === "GET" && url.pathname === "/api/repair/proposals") {
      requireAdmin(request);
      const store = await readStore();
      return sendJson(response, 200, { ok: true, ...paginate(store.proposals, url, "proposals") });
    }

    const approveMatch = url.pathname.match(/^\/api\/repair\/proposals\/([^/]+)\/approve$/);
    if (request.method === "POST" && approveMatch) {
      requireAdmin(request);
      return handleProposalApprove(response, approveMatch[1]);
    }

    const rejectMatch = url.pathname.match(/^\/api\/repair\/proposals\/([^/]+)\/reject$/);
    if (request.method === "POST" && rejectMatch) {
      requireAdmin(request);
      return handleProposalReject(response, rejectMatch[1], body);
    }

    return sendJson(response, 404, { ok: false, error: "Not found" });
  } catch (error) {
    const status = error.statusCode || 500;
    return sendJson(response, status, { ok: false, error: error.message });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`ExportAI server listening on http://127.0.0.1:${PORT}`);
});

async function handleLicenseValidate(response, body) {
  const store = await readStore();
  const licenseKey = String(body.licenseKey || "");
  const license = store.licenses[licenseKey];
  if (!license || license.status !== "active") {
    return sendJson(response, 401, { ok: false, error: "Invalid or inactive license." });
  }

  return sendJson(response, 200, {
    ok: true,
    status: "active",
    plan: license.plan || "pro",
    quota: license.quota || { dailyLimit: 999999, monthlyLimit: 999999 },
    features: license.features || DEFAULT_STORE.licenses["free-local-dev"].features
  });
}

async function handleAdminUi(response) {
  const html = await fs.readFile(ADMIN_HTML_FILE, "utf8");
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store"
  });
  return response.end(html);
}

async function handleStatus(response) {
  const store = await readStore();
  const adapterCounts = Object.fromEntries(
    Object.entries(store.adapters).map(([platform, releases]) => [
      platform,
      {
        releases: releases.length,
        published: releases.filter((release) => release.status === "published").length,
        latestVersion: releases[0]?.version || null
      }
    ])
  );

  return sendJson(response, 200, {
    ok: true,
    service: "exportai-server",
    version: SERVER_VERSION,
    schemaVersion: store.schemaVersion || 1,
    adapterCounts,
    diagnosticsCount: store.diagnostics.length,
    proposalsCount: store.proposals.length,
    licenseCount: Object.keys(store.licenses).length,
    time: new Date().toISOString()
  });
}

async function handleAdapterLatest(response, platform) {
  const store = await readStore();
  const releases = store.adapters[platform] || [];
  const adapter = releases.find((release) => release.status === "published") || releases[0];
  if (!adapter) {
    return sendJson(response, 404, { ok: false, error: "No remote adapter published for this platform." });
  }

  return sendJson(response, 200, { ok: true, adapter });
}

async function handleAdapterPublish(response, platform, body) {
  const validation = validateAdapter(platform, body.adapter || body);
  if (!validation.ok) {
    return sendJson(response, 400, validation);
  }

  const store = await readStore();
  const adapter = {
    ...validation.adapter,
    version: validation.adapter.version || versionStamp(),
    status: "published",
    source: "server",
    publishedAt: new Date().toISOString(),
    rollbackTarget: body.rollbackTarget || null,
    changelog: body.changelog || "Manual adapter publish."
  };

  store.adapters[platform] = [adapter, ...(store.adapters[platform] || []).map((item) => ({ ...item, status: "superseded" }))];
  await writeStore(store);
  return sendJson(response, 200, { ok: true, adapter });
}

async function handleAdapterRollback(response, platform, body) {
  const store = await readStore();
  if (!store.adapters[platform]) {
    return sendJson(response, 404, { ok: false, error: "Unsupported platform." });
  }

  const releases = store.adapters[platform];
  if (releases.length < 2 && !body.version) {
    return sendJson(response, 409, { ok: false, error: "No previous adapter release to roll back to." });
  }

  const target =
    (body.version && releases.find((release) => release.version === body.version)) ||
    releases.find((release) => release.status !== "published");

  if (!target) {
    return sendJson(response, 404, { ok: false, error: "Rollback target not found." });
  }

  store.adapters[platform] = [
    {
      ...target,
      status: "published",
      source: "rollback",
      rolledBackAt: new Date().toISOString(),
      changelog: `Rolled back to ${target.version}`
    },
    ...releases
      .filter((release) => release.version !== target.version)
      .map((release) => ({ ...release, status: "rolled_back" }))
  ];
  await writeStore(store);
  return sendJson(response, 200, { ok: true, adapter: store.adapters[platform][0] });
}

async function handleDiagnosticCreate(response, body) {
  const validation = validateDiagnostic(body);
  if (!validation.ok) {
    return sendJson(response, 400, validation);
  }

  const store = await readStore();
  const diagnostic = {
    id: createId("diag"),
    receivedAt: new Date().toISOString(),
    ...validation.diagnostic
  };
  store.diagnostics.unshift(diagnostic);
  store.diagnostics = store.diagnostics.slice(0, 1000);
  await writeStore(store);
  return sendJson(response, 200, { ok: true, diagnosticId: diagnostic.id });
}

async function handleRepairProposal(response, body) {
  const validation = validateDiagnostic(body);
  if (!validation.ok) {
    return sendJson(response, 400, validation);
  }

  const store = await readStore();
  const platform = validation.diagnostic.platform;
  const current = (store.adapters[platform] || [])[0];
  const adapter = proposeAdapter(platform, validation.diagnostic, current);
  const proposal = {
    id: createId("proposal"),
    status: "proposed",
    confidence: adapter ? 0.72 : 0.2,
    platform,
    diagnosticId: validation.diagnostic.localDiagnosticId || validation.diagnostic.id || null,
    reason: adapter
      ? "Generated selector-only repair proposal from diagnostic selector counts."
      : "No safe selector-only repair could be inferred from diagnostic.",
    adapter,
    testStatus: adapter ? "not_run" : "skipped",
    createdAt: new Date().toISOString()
  };

  store.proposals.unshift(proposal);
  store.proposals = store.proposals.slice(0, 500);
  await writeStore(store);

  return sendJson(response, adapter ? 200 : 422, {
    ok: Boolean(adapter),
    proposalId: proposal.id,
    status: proposal.status,
    adapter,
    error: adapter ? undefined : proposal.reason
  });
}

async function handleProposalApprove(response, proposalId) {
  const store = await readStore();
  const proposal = store.proposals.find((item) => item.id === proposalId);
  if (!proposal || !proposal.adapter) {
    return sendJson(response, 404, { ok: false, error: "Proposal not found or has no adapter." });
  }

  proposal.status = "approved";
  proposal.approvedAt = new Date().toISOString();
  proposal.status = "published";
  proposal.publishedAt = new Date().toISOString();
  store.adapters[proposal.platform] = [
    {
      ...proposal.adapter,
      status: "published",
      source: "repair-agent",
      publishedAt: new Date().toISOString(),
      changelog: `Approved repair proposal ${proposal.id}`
    },
    ...(store.adapters[proposal.platform] || []).map((item) => ({ ...item, status: "superseded" }))
  ];
  await writeStore(store);
  return sendJson(response, 200, { ok: true, adapter: proposal.adapter });
}

async function handleProposalReject(response, proposalId, body) {
  const store = await readStore();
  const proposal = store.proposals.find((item) => item.id === proposalId);
  if (!proposal) {
    return sendJson(response, 404, { ok: false, error: "Proposal not found." });
  }

  proposal.status = "rejected";
  proposal.rejectedAt = new Date().toISOString();
  proposal.rejectReason = String(body.reason || "Rejected by admin.").slice(0, 300);
  await writeStore(store);
  return sendJson(response, 200, { ok: true, proposal });
}

function proposeAdapter(platform, diagnostic, current) {
  const selectorResults = diagnostic.selectorResults || {};
  const viableSelectors = Object.entries(selectorResults)
    .filter(([selector, count]) => count >= 2 && isSafeSelector(selector))
    .sort((a, b) => b[1] - a[1])
    .map(([selector]) => selector);

  if (!viableSelectors.length) return null;

  const selectors = unique([
    ...viableSelectors.slice(0, 4),
    ...(current?.selectors || [])
  ]).slice(0, 8);

  return {
    id: platform,
    version: versionStamp(),
    selectors,
    selectorGroups: selectors.map((selector) => [selector]),
    adapterStatus: "remote",
    status: "remote"
  };
}

function validateAdapter(platform, adapter) {
  if (!["chatgpt", "grok", "gemini", "perplexity", "claude", "copilot", "devin", "lovable"].includes(platform)) {
    return { ok: false, error: "Unsupported platform." };
  }
  if (!adapter || adapter.id !== platform) {
    return { ok: false, error: "Adapter id must match platform." };
  }
  if (!Array.isArray(adapter.selectors) || !adapter.selectors.length) {
    return { ok: false, error: "Adapter selectors are required." };
  }
  if (!adapter.selectors.every(isSafeSelector)) {
    return { ok: false, error: "Adapter contains unsafe selectors." };
  }
  return {
    ok: true,
    adapter: {
      id: adapter.id,
      version: adapter.version || versionStamp(),
      selectors: adapter.selectors,
      selectorGroups: Array.isArray(adapter.selectorGroups) ? adapter.selectorGroups : adapter.selectors.map((selector) => [selector])
    }
  };
}

function validateDiagnostic(diagnostic) {
  if (!diagnostic || typeof diagnostic !== "object") {
    return { ok: false, error: "Diagnostic must be a JSON object." };
  }
  const platform = String(diagnostic.platform || "");
  if (!Object.keys(DEFAULT_STORE.adapters).includes(platform)) {
    return { ok: false, error: "Diagnostic platform is unsupported." };
  }
  const errorType = String(diagnostic.errorType || "UNKNOWN").slice(0, 80);
  const selectorResults = diagnostic.selectorResults && typeof diagnostic.selectorResults === "object"
    ? Object.fromEntries(
        Object.entries(diagnostic.selectorResults)
          .filter(([selector, count]) => isSafeSelector(selector) && Number.isFinite(Number(count)))
          .slice(0, 80)
          .map(([selector, count]) => [selector, Number(count)])
      )
    : {};

  return {
    ok: true,
    diagnostic: {
      ...diagnostic,
      platform,
      errorType,
      privacyMode: ["private", "debug", "support"].includes(diagnostic.privacyMode) ? diagnostic.privacyMode : "private",
      selectorResults,
      errorMessage: String(diagnostic.errorMessage || "").slice(0, 500),
      capturedAt: diagnostic.capturedAt || new Date().toISOString()
    }
  };
}

function isSafeSelector(selector) {
  return typeof selector === "string" && selector.length > 0 && selector.length < 240 && /^[#.:[\]=\-"'\w\s>(),*^$|~+]+$/.test(selector);
}

async function readStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8");
    return migrateStore({
      ...DEFAULT_STORE,
      ...JSON.parse(raw)
    });
  } catch {
    await writeStore(DEFAULT_STORE);
    return JSON.parse(JSON.stringify(DEFAULT_STORE));
  }
}

function migrateStore(store) {
  return {
    ...DEFAULT_STORE,
    ...store,
    schemaVersion: STORE_SCHEMA_VERSION,
    licenses: {
      ...DEFAULT_STORE.licenses,
      ...(store.licenses || {})
    },
    adapters: {
      ...DEFAULT_STORE.adapters,
      ...(store.adapters || {})
    },
    diagnostics: Array.isArray(store.diagnostics) ? store.diagnostics : [],
    proposals: Array.isArray(store.proposals) ? store.proposals : []
  };
}

async function writeStore(store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`);
}

async function readJsonBody(request) {
  if (!["POST", "PUT", "PATCH"].includes(request.method)) return {};
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function requireAdmin(request) {
  const token = String(request.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (token !== ADMIN_TOKEN) {
    const error = new Error("Admin token required.");
    error.statusCode = 401;
    throw error;
  }
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type,authorization",
    "content-type": "application/json; charset=utf-8"
  });
  if (statusCode === 204) return response.end();
  return response.end(JSON.stringify(payload));
}

function paginate(items, url, key = "diagnostics") {
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 50, 200));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
  return {
    [key]: items.slice(offset, offset + limit),
    page: {
      limit,
      offset,
      total: items.length,
      nextOffset: offset + limit < items.length ? offset + limit : null
    }
  };
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

function versionStamp() {
  return new Date().toISOString().slice(0, 10).replaceAll("-", ".") + `.${Date.now().toString(36).slice(-4)}`;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}
