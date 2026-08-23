import { spawn } from "node:child_process";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, renameSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const builtClient = path.join(root, "dist", "client");
const pageAssets = path.join(builtClient, "__pages");

if (!existsSync(pageAssets)) {
  throw new Error("Missing the prepared Sites pages. Run npm run build first.");
}

const previewRoot = path.join(os.tmpdir(), "payslip-insights-preview-");
const previewDir = mkdtempSync(previewRoot);
const previewPageAssets = path.join(previewDir, "__pages");

cpSync(builtClient, previewDir, { recursive: true });

function restoreRouteIndexes(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      restoreRouteIndexes(entryPath);
    } else if (entry.isFile() && entry.name === "index.html") {
      const relative = path.relative(previewPageAssets, entryPath);
      const target = path.join(previewDir, relative);
      mkdirSync(path.dirname(target), { recursive: true });
      renameSync(entryPath, target);
    }
  }
}

restoreRouteIndexes(path.join(previewDir, "__pages"));
renameSync(path.join(previewDir, "__pages", "release.json"), path.join(previewDir, "release.json"));
rmSync(path.join(previewDir, "__pages"), { force: true, recursive: true });

const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
const child = spawn(process.execPath, [viteBin, "preview", "--outDir", previewDir, ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
});

const cleanup = () => rmSync(previewDir, { force: true, recursive: true });
child.on("exit", (code, signal) => {
  cleanup();
  process.exitCode = code ?? (signal ? 1 : 0);
});
process.on("exit", cleanup);
