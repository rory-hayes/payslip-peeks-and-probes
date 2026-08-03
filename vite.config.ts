import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { prerenderGuides } from "./vite-plugins/prerender-guides";

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
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      prerenderGuides(),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
