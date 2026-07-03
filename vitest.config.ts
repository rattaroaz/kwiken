import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: [
        "src/components/**/*.tsx",
        "src/hooks/**/*.ts",
        "src/lib/**/*.ts",
        "src/pages/**/*.tsx",
        "src/services/**/*.ts",
        "src/stores/logStore.ts",
      ],
      exclude: [
        "src/components/reports/ReportCharts.tsx",
        "src/lib/constants.ts",
        "src/main.tsx",
        "src/test/**",
      ],
      thresholds: {
        lines: 40,
        functions: 35,
        branches: 30,
        statements: 40,
      },
    },
  },
});
