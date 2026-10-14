import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

/**
 * The SPA is built into app/web/dist and served by the Express API on the same origin,
 * so the frontend never needs a CORS configuration.
 *
 * During `npm run dev` Vite proxies /api to the API server on port 4100.
 */
export default defineConfig({
  root: path.resolve(import.meta.dirname),
  plugins: [react()],
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    proxy: {
      "/api": { target: "http://127.0.0.1:4100", changeOrigin: true },
    },
  },
});
