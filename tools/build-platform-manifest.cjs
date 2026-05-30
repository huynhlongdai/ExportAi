#!/usr/bin/env node

const fs = require("node:fs/promises");
const path = require("node:path");
const vm = require("node:vm");

const platformId = process.argv[2];
const root = path.join(__dirname, "..");
const outDir = path.join(root, "dist", platformId || "full");

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

async function main() {
  const manifest = JSON.parse(await fs.readFile(path.join(root, "manifest.json"), "utf8"));
  const platforms = await loadPlatforms();

  if (!platformId || platformId === "full") {
    await writeManifest("full", manifest);
    return;
  }

  const platform = platforms[platformId];
  if (!platform) {
    throw new Error(`Unknown platform "${platformId}". Use chatgpt, grok, gemini, perplexity, or full.`);
  }

  const nextManifest = {
    ...manifest,
    name: platform.productName,
    description: `Export ${platform.name} conversations to Markdown, JSON, PDF, images, and AI-ready data files.`,
    content_scripts: manifest.content_scripts.map((script) => ({
      ...script,
      matches: platform.matches
    })),
    host_permissions: [
      ...platform.matches,
      "http://127.0.0.1:8787/*",
      "http://localhost:8787/*"
    ]
  };

  await writeManifest(platformId, nextManifest);
}

async function loadPlatforms() {
  const source = await fs.readFile(path.join(root, "src/shared/platforms.js"), "utf8");
  const context = { globalThis: {} };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.ExportAIPlatforms.all;
}

async function writeManifest(name, manifest) {
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(path.join(outDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${name} manifest to ${path.relative(root, path.join(outDir, "manifest.json"))}`);
}
