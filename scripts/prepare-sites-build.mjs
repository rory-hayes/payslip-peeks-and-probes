import { existsSync, mkdirSync, readdirSync, rmSync, copyFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const client = path.join(dist, "client");
const worker = path.join(root, "worker", "index.js");
const hosting = path.join(root, ".openai", "hosting.json");

for (const file of [
  path.join(client, "index.html"),
  path.join(client, "release.json"),
  worker,
  hosting,
]) {
  if (!existsSync(file)) throw new Error(`Missing Sites build input: ${file}`);
}

// Keep the archive deterministic and prevent a prior flat Vite build from
// being packaged alongside the current client bundle.
for (const entry of readdirSync(dist)) {
  if (entry !== "client") rmSync(path.join(dist, entry), { force: true, recursive: true });
}

mkdirSync(path.join(dist, "server"), { recursive: true });
mkdirSync(path.join(dist, ".openai"), { recursive: true });
copyFileSync(worker, path.join(dist, "server", "index.js"));
copyFileSync(hosting, path.join(dist, ".openai", "hosting.json"));

console.log("Prepared Sites build: dist/client, dist/server/index.js, and dist/.openai/hosting.json");
