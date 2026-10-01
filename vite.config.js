import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import metadata from "./server/video-metadata.js";
import clips from "./server/clips.js";
import { nodeHandler } from "./server/adapter.js";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  for (const key of ["SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"])
    if (env[key]) process.env[key] = env[key];
  return {
    plugins: [react(), {
      name: "clipquote-local-api",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const path = new URL(req.url, "http://localhost").pathname;
          if (path === "/api/video-metadata") return nodeHandler(metadata)(req, res);
          if (path === "/api/clips" || path.startsWith("/api/clips/")) return nodeHandler(clips)(req, res);
          next();
        });
      },
    }],
  };
});
