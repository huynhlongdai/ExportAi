#!/usr/bin/env node

const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.join(__dirname, "..");
const port = 8797;
const baseUrl = `http://127.0.0.1:${port}`;

const server = spawn(process.execPath, [path.join(root, "server/exportai-server.cjs")], {
  cwd: root,
  env: {
    ...process.env,
    EXPORTAI_PORT: String(port),
    EXPORTAI_ADMIN_TOKEN: "dev-admin-token"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
server.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
server.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

main().finally(() => {
  server.kill("SIGTERM");
});

async function main() {
  await waitForServer();

  const health = await getJson("/health");
  assert(health.ok && health.service === "exportai-server", "health endpoint failed");

  const status = await getJson("/api/status");
  assert(status.ok && status.version, "status endpoint failed");
  assert(status.adapterCounts.chatgpt, "status adapter counts missing");

  const license = await postJson("/api/license/validate", { licenseKey: "free-local-dev" });
  assert(license.ok && license.status === "active", "license validation failed");

  const publish = await postJson(
    "/api/adapters/chatgpt",
    {
      adapter: {
        id: "chatgpt",
        version: "smoke-test-1",
        selectors: ["article"],
        selectorGroups: [["article"]]
      },
      changelog: "Smoke test publish."
    },
    true
  );
  assert(publish.ok && publish.adapter.version === "smoke-test-1", "adapter publish failed");

  const latest = await getJson("/api/adapters/chatgpt/latest");
  assert(latest.ok && latest.adapter.version === "smoke-test-1", "adapter latest failed");

  const publishSecond = await postJson(
    "/api/adapters/chatgpt",
    {
      adapter: {
        id: "chatgpt",
        version: "smoke-test-2",
        selectors: ["[data-message-author-role]"],
        selectorGroups: [["[data-message-author-role]"]]
      },
      changelog: "Smoke test second publish."
    },
    true
  );
  assert(publishSecond.ok && publishSecond.adapter.version === "smoke-test-2", "second adapter publish failed");

  const rollback = await postJson("/api/adapters/chatgpt/rollback", { version: "smoke-test-1" }, true);
  assert(rollback.ok && rollback.adapter.version === "smoke-test-1", "adapter rollback failed");

  const diagnostic = await postJson("/api/diagnostics", {
    platform: "chatgpt",
    errorType: "NO_MESSAGES_FOUND",
    selectorResults: { article: 2 },
    domSignature: { tagCounts: { article: 2 } }
  });
  assert(diagnostic.ok && diagnostic.diagnosticId, "diagnostic create failed");

  const proposal = await postJson("/api/repair/proposals", {
    platform: "chatgpt",
    errorType: "NO_MESSAGES_FOUND",
    selectorResults: { article: 2 },
    domSignature: { tagCounts: { article: 2 } }
  });
  assert(proposal.ok && proposal.proposalId, "repair proposal failed");

  const diagnostics = await getJson("/api/diagnostics?limit=1", true);
  assert(diagnostics.ok && diagnostics.page.total >= 1, "diagnostic pagination failed");

  const proposals = await getJson("/api/repair/proposals?limit=1", true);
  assert(proposals.ok && proposals.page.total >= 1, "proposal pagination failed");

  const reject = await postJson(`/api/repair/proposals/${proposal.proposalId}/reject`, { reason: "Smoke test reject." }, true);
  assert(reject.ok && reject.proposal.status === "rejected", "proposal reject failed");

  console.log(JSON.stringify({ ok: true, server: status.version, proposalId: proposal.proposalId }, null, 2));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (output.includes(baseUrl)) return;
    await delay(100);
  }
  throw new Error(`Server did not start. Output:\n${output}`);
}

async function getJson(pathname, admin = false) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    headers: admin ? { authorization: "Bearer dev-admin-token" } : {}
  });
  return response.json();
}

async function postJson(pathname, body, admin = false) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(admin ? { authorization: "Bearer dev-admin-token" } : {})
    },
    body: JSON.stringify(body)
  });
  return response.json();
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
