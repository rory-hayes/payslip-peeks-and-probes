import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { prerenderGuides } from "./vite-plugins/prerender-guides";
import { releaseManifest } from "./vite-plugins/release-manifest";
import { resolvePublicSupabaseConfig } from "./src/integrations/supabase/public-config";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const publicSupabaseConfig = resolvePublicSupabaseConfig(env);

  // Lovable Cloud does not expose project build variables to every production
  // builder. Use the reviewed public browser fallback, while still preferring
  // an explicit host override. Secret/service-role keys remain server-only.
  if (mode === "production") {
    if (!publicSupabaseConfig.url.startsWith("https://") || !publicSupabaseConfig.publishableKey) {
      throw new Error("Missing valid public Supabase browser configuration.");
    }
  }

  return {
    build: {
      // Keep Vite's conventional output for Lovable and other static hosts.
      // scripts/prepare-sites-build.mjs derives the Sites client bundle from
      // this exact artifact after the browser build has completed.
      outDir: "dist",
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
