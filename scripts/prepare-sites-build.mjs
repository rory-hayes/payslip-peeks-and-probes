import {
  cpSync,
  copyFileSync,
  existsSync,
  mkdtempSync,
  mkdirSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const client = path.join(dist, "client");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");
const workerConfig = path.join(dist, "wrangler.jsonc");
const stagedClient = mkdtempSync(path.join(root, ".sites-client-stage-"));
const pageAssets = path.join(stagedClient, "__pages");

for (const file of [
  path.join(dist, "index.html"),
  path.join(dist, "release.json"),
  path.join(dist, "_routes.json"),
  worker,
  hosting,
]) {
  if (!existsSync(file)) throw new Error(`Missing Sites build input: ${file}`);
}

function collectRouteIndexFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectRouteIndexFiles(entryPath));
    } else if (entry.isFile() && entry.name === "index.html") {
      files.push(entryPath);
    }
  }
  return files;
}

let stagedClientMoved = false;
try {
  // Preserve Vite's flat static output for Lovable. Build the Sites-specific
  // client archive from a copy so moving route documents below cannot change
  // the public artifact that Lovable validates and publishes.
  for (const entry of readdirSync(dist, { withFileTypes: true })) {
    cpSync(path.join(dist, entry.name), path.join(stagedClient, entry.name), {
      force: true,
      recursive: entry.isDirectory(),
    });
  }

  // Sites serves matching client assets before invoking the Worker. Keep
  // prerendered route documents under a non-public namespace so the Worker
  // can add response headers and return route-specific SEO metadata.
  for (const source of collectRouteIndexFiles(stagedClient)) {
    const relative = path.relative(stagedClient, source);
    const target = path.join(pageAssets, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    renameSync(source, target);
  }
  renameSync(path.join(stagedClient, "release.json"), path.join(pageAssets, "release.json"));

  rmSync(client, { force: true, recursive: true });
  renameSync(stagedClient, client);
  stagedClientMoved = true;

  mkdirSync(path.join(dist, "server"), { recursive: true });
  mkdirSync(path.join(dist, ".openai"), { recursive: true });
  copyFileSync(worker, path.join(dist, "server", "index.js"));
  copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));
  writeFileSync(
    workerConfig,
    `${JSON.stringify({
      "$schema": "https://unpkg.com/wrangler@latest/config-schema.json",
      "name": "payslip-insights",
      "main": "./server/index.js",
      "compatibility_date": "2026-08-23",
      "assets": {
        "directory": "./client",
        "binding": "ASSETS",
        "run_worker_first": true,
      },
    }, null, 2)}\n`,
  );
} finally {
  if (!stagedClientMoved) rmSync(stagedClient, { force: true, recursive: true });
}

for (const file of [
  path.join(dist, "index.html"),
  path.join(dist, "release.json"),
  path.join(dist, "pricing", "index.html"),
  path.join(dist, "guides", "index.html"),
  path.join(dist, "sign-in", "index.html"),
  path.join(dist, "assets"),
]) {
  if (!existsSync(file)) throw new Error(`Missing static-host build output: ${file}`);
}

console.log("Prepared dual-host build: static output in dist plus Sites output in dist/client and dist/server.");
