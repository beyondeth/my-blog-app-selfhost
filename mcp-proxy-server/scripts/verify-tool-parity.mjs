#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const mcpRoot = path.resolve(repoRoot, "mcp-proxy-server");

const TOOL_NAMES = [
  "check_auth",
  "get_writing_style_guide",
  "create_post",
  "get_image_upload_url",
  "finalize_uploaded_image",
];

const STYLE_PRESETS = [
  "default",
  "novel",
  "tutorial",
  "comedy",
  "podcast",
  "vibe",
  "research",
  "human",
];

function fail(message) {
  console.error(`✗ ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`✓ ${message}`);
}

async function read(relPath) {
  return fs.readFile(path.resolve(repoRoot, relPath), "utf8");
}

function parseCatalogNames(content) {
  const blockMatch = content.match(
    /export const TOOL_NAMES = \[(?<body>[\s\S]*?)\] as const;/
  );
  if (!blockMatch?.groups?.body) return [];

  return [...blockMatch.groups.body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

function parsePresetNames(content) {
  const blockMatch = content.match(
    /export const WRITING_STYLE_PRESETS = \[(?<body>[\s\S]*?)\] as const;/
  );
  if (!blockMatch?.groups?.body) return [];

  return [...blockMatch.groups.body.matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

async function verifyStaticParity() {
  const catalogContent = await fs.readFile(
    path.resolve(mcpRoot, "src/tools/catalog.ts"),
    "utf8"
  );
  const catalogNames = parseCatalogNames(catalogContent);

  if (catalogNames.length !== TOOL_NAMES.length) {
    fail(
      `TOOL_NAMES length mismatch: expected ${TOOL_NAMES.length}, got ${catalogNames.length}`
    );
  } else if (catalogNames.some((name, idx) => name !== TOOL_NAMES[idx])) {
    fail(`TOOL_NAMES order mismatch in src/tools/catalog.ts`);
  } else {
    ok(`Tool catalog has ${TOOL_NAMES.length} tools in expected order`);
  }

  const presetNames = parsePresetNames(catalogContent);
  if (presetNames.length !== STYLE_PRESETS.length) {
    fail(
      `WRITING_STYLE_PRESETS length mismatch: expected ${STYLE_PRESETS.length}, got ${presetNames.length}`
    );
  } else if (
    presetNames.some((preset, idx) => preset !== STYLE_PRESETS[idx])
  ) {
    fail("WRITING_STYLE_PRESETS order mismatch in src/tools/catalog.ts");
  } else {
    ok(
      `Style presets include expected ${STYLE_PRESETS.length} values (including research/human)`
    );
  }

  const srcIndex = await fs.readFile(
    path.resolve(mcpRoot, "src/index.ts"),
    "utf8"
  );
  if (!srcIndex.includes("tools: getDiscoveryTools()")) {
    fail("src/index.ts does not use getDiscoveryTools() for /mcp discovery");
  } else {
    ok("/mcp discovery uses shared tool catalog");
  }

  const srcOauth = await fs.readFile(
    path.resolve(mcpRoot, "src/oauth/index.ts"),
    "utf8"
  );
  if (!srcOauth.includes("tools: getDiscoveryTools()")) {
    fail(
      "src/oauth/index.ts does not use getDiscoveryTools() for /mcp-remote discovery"
    );
  } else {
    ok("/mcp-remote discovery uses shared tool catalog");
  }

  const docsFiles = [
    "docs/skills/codebase-skill/SKILL.md",
    "docs/skills/codebase-skill/MCPORTER_SKILL.md",
    "docs/skills/codebase-skill/HEARTBEAT.md",
  ];

  for (const doc of docsFiles) {
    const content = await read(doc);
    const missing = TOOL_NAMES.filter((name) => !content.includes(name));
    if (missing.length > 0) {
      fail(`${doc} is missing tool names: ${missing.join(", ")}`);
    } else {
      ok(`${doc} includes all 5 tool names`);
    }
  }

  for (const preset of STYLE_PRESETS) {
    const stylePath = path.resolve(mcpRoot, "writing-styles", `${preset}.md`);
    try {
      await fs.access(stylePath);
      ok(`writing-styles/${preset}.md exists`);
    } catch {
      fail(`missing style file: writing-styles/${preset}.md`);
    }
  }
}

function normalizeTools(payload) {
  return (payload?.tools || []).map((tool) => tool.name);
}

async function verifyHttpParity() {
  const shouldCheckHttp = process.env.MCP_VERIFY_HTTP === "1";
  if (!shouldCheckHttp) {
    console.log("• HTTP parity check skipped (set MCP_VERIFY_HTTP=1 to enable)");
    return;
  }

  const baseUrl = process.env.MCP_VERIFY_BASE_URL || "http://localhost:3002";
  const endpoints = ["/mcp", "/mcp-remote"];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint}`);
      if (!response.ok) {
        fail(`${endpoint} returned HTTP ${response.status}`);
        continue;
      }

      const payload = await response.json();
      const names = normalizeTools(payload);

      if (names.length !== TOOL_NAMES.length) {
        fail(
          `${endpoint} tool count mismatch: expected ${TOOL_NAMES.length}, got ${names.length}`
        );
        continue;
      }

      if (names.some((name, idx) => name !== TOOL_NAMES[idx])) {
        fail(`${endpoint} tool order/name mismatch: ${names.join(", ")}`);
        continue;
      }

      ok(`${endpoint} exposes expected 5-tool catalog`);
    } catch (error) {
      fail(`${endpoint} HTTP check failed: ${error.message}`);
    }
  }
}

async function main() {
  console.log("MCP ↔ Skills tool parity check");
  await verifyStaticParity();
  await verifyHttpParity();

  if (process.exitCode && process.exitCode !== 0) {
    process.exit(process.exitCode);
  }
}

await main();
