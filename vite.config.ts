import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const host = process.env.TAURI_DEV_HOST;
const isE2E = process.env.VITE_E2E === "true";

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],
  define: isE2E ? { "import.meta.env.VITE_E2E": JSON.stringify("true") } : undefined,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      ...(isE2E
        ? {
            "@tauri-apps/api/core": path.resolve(__dirname, "./e2e/mocks/tauriCore.ts"),
            "@tauri-apps/plugin-updater": path.resolve(__dirname, "./e2e/mocks/tauriUpdater.ts"),
            "@tauri-apps/plugin-process": path.resolve(__dirname, "./e2e/mocks/tauriProcess.ts"),
            "@tauri-apps/plugin-dialog": path.resolve(__dirname, "./e2e/mocks/tauriDialog.ts"),
            "@tauri-apps/plugin-fs": path.resolve(__dirname, "./e2e/mocks/tauriFs.ts"),
            "@tauri-apps/plugin-opener": path.resolve(__dirname, "./e2e/mocks/tauriOpener.ts"),
          }
        : {}),
    },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
