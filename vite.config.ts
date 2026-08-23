import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { prerenderGuides } from "./vite-plugins/prerender-guides";
import { releaseManifest } from "./vite-plugins/release-manifest";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  // A missing public client configuration used to produce a successful build
  // that crashed before React rendered. Fail the production build instead so
  // a deployment cannot silently replace a working site with a blank page.
  if (mode === "production") {
    const missing = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"]
      .filter((name) => !env[name]?.trim());

    if (missing.length > 0) {
      throw new Error(`Missing required production environment variable(s): ${missing.join(", ")}`);
    }
  }

  return {
    build: {
      // Sites serves the built browser bundle through the ASSETS binding and
      // the worker entrypoint created by scripts/prepare-sites-build.mjs.
      outDir: "dist/client",
    },
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      prerenderGuides(),
      // Vite loads .env.production into this object rather than process.env.
      // Pass the configured revision explicitly so archive builds emit the
      // same provenance that the release preflight later verifies.
      releaseManifest(mode, env.VITE_RELEASE_SHA),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
