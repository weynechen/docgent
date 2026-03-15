import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  root: __dirname,
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./@"),
    },
  },
  test: {
    environment: "jsdom",
    globals: false,
    setupFiles: "./src/test/setup.ts",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
