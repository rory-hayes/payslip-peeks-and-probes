import {
  cpSync,
  copyFileSync,
  existsSync,
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
const pageAssets = path.join(client, "__pages");

for (const file of [
  path.join(client, "index.html"),
  path.join(client, "release.json"),
  path.join(client, "_routes.json"),
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

// Sites currently serves matching client assets before invoking the Worker.
// Keep prerendered route documents under a non-public namespace so the Worker
// can add response headers and still return route-specific SEO metadata.
rmSync(pageAssets, { force: true, recursive: true });
for (const source of collectRouteIndexFiles(client)) {
  const relative = path.relative(client, source);
  const target = path.join(pageAssets, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  renameSync(source, target);
}
renameSync(path.join(client, "release.json"), path.join(pageAssets, "release.json"));

// Keep the archive deterministic and prevent a prior flat Vite build from
// being packaged alongside the current client bundle.
for (const entry of readdirSync(dist)) {
  if (entry !== "client") rmSync(path.join(dist, entry), { force: true, recursive: true });
}

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

// Lovable publishes the repository's `dist` directory as a conventional
// static Vite site, while Sites reads from `dist/client` through its Worker.
// Mirror the reviewed browser output at the root so the same exact build can
// be published by either host without changing route metadata or provenance.
for (const entry of readdirSync(client, { withFileTypes: true })) {
  if (entry.name === "__pages") continue;
  cpSync(path.join(client, entry.name), path.join(dist, entry.name), {
    force: true,
    recursive: entry.isDirectory(),
  });
}

for (const entry of readdirSync(pageAssets, { withFileTypes: true })) {
  cpSync(path.join(pageAssets, entry.name), path.join(dist, entry.name), {
    force: true,
    recursive: entry.isDirectory(),
  });
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
