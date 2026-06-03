#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const platformSource = fs.readFileSync(path.join(root, "src/shared/platforms.js"), "utf8");
const context = { globalThis: {} };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(platformSource, context);

const expected = JSON.parse(fs.readFileSync(path.join(root, "fixtures/expected.json"), "utf8"));
const failures = [];

for (const [platformId, spec] of Object.entries(expected)) {
  const platform = context.ExportAIPlatforms.all[platformId];
  const html = fs.readFileSync(path.join(root, spec.file), "utf8");
  const selectorCounts = Object.fromEntries(
    platform.selectors.map((selector) => [selector, countSelectorMatches(html, selector)])
  );
  const bestCount = Math.max(...Object.values(selectorCounts));
  const bestGroupCount = Math.max(
    ...platform.selectorGroups.map((group) =>
      unique(group.flatMap((selector) => Array.from({ length: countSelectorMatches(html, selector) }, (_, index) => `${selector}:${index}`))).length
    )
  );

  if (Math.max(bestCount, bestGroupCount) < spec.minimumSelectorMatches) {
    failures.push({
      platform: platformId,
      reason: `Expected at least ${spec.minimumSelectorMatches} selector or selector-group matches, got selector=${bestCount}, group=${bestGroupCount}.`,
      selectorCounts,
      bestGroupCount
    });
  }

  if (!Array.isArray(platform.selectorGroups) || !platform.selectorGroups.length) {
    failures.push({ platform: platformId, reason: "Missing selectorGroups." });
  }

  const adapterSelectors = [...platform.selectors, ...(platform.selectorGroups || []).flat()];
  for (const selector of spec.requiredAdapterSelectors || []) {
    if (!adapterSelectors.includes(selector)) {
      failures.push({ platform: platformId, reason: `Missing required adapter selector: ${selector}` });
    }
  }

  for (const selector of spec.forbiddenAdapterSelectors || []) {
    if (adapterSelectors.includes(selector)) {
      failures.push({ platform: platformId, reason: `Forbidden adapter selector is still present: ${selector}` });
    }
  }
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, platforms: Object.keys(expected) }, null, 2));

function countSelectorMatches(html, selector) {
  if (/^\w[\w-]*$/.test(selector)) {
    return countRegex(html, new RegExp(`<${escapeRegex(selector)}(?:\\s|>|/)`, "gi"));
  }

  const attrEquals = selector.match(/^\[([\w-]+)="([^"]+)"\]$/);
  if (attrEquals) {
    return countRegex(html, new RegExp(`${escapeRegex(attrEquals[1])}=["']${escapeRegex(attrEquals[2])}["']`, "gi"));
  }

  const attrPrefix = selector.match(/^\[([\w-]+)\^="([^"]+)"\]$/);
  if (attrPrefix) {
    return countRegex(html, new RegExp(`${escapeRegex(attrPrefix[1])}=["']${escapeRegex(attrPrefix[2])}[^"']*["']`, "gi"));
  }

  const attrContains = selector.match(/^\[([\w-]+)\*="([^"]+)"\]$/);
  if (attrContains) {
    return countRegex(html, new RegExp(`${escapeRegex(attrContains[1])}=["'][^"']*${escapeRegex(attrContains[2])}[^"']*["']`, "gi"));
  }

  const classContains = selector.match(/^\[class\*="([^"]+)"\]$/);
  if (classContains) {
    return countRegex(html, new RegExp(`class=["'][^"']*${escapeRegex(classContains[1])}[^"']*["']`, "gi"));
  }

  const dotClass = selector.match(/^\.([\w-]+)$/);
  if (dotClass) {
    return countRegex(html, new RegExp(`class=["'][^"']*\\b${escapeRegex(dotClass[1])}\\b[^"']*["']`, "gi"));
  }

  const tagClass = selector.match(/^(\w[\w-]*)\.([\w-]+)$/);
  if (tagClass) {
    return countRegex(html, new RegExp(`<${escapeRegex(tagClass[1])}[^>]*class=["'][^"']*\\b${escapeRegex(tagClass[2])}\\b[^"']*["']`, "gi"));
  }

  return 0;
}

function countRegex(text, regex) {
  return [...text.matchAll(regex)].length;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unique(values) {
  return [...new Set(values)];
}
