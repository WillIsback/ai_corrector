import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    port: 25001,
    host: true,
    allowedHosts: ["spark-787d-1.tail6cba9f.ts.net", "ai-corrector.spark-787d-1.tail6cba9f.ts.net"],
    proxy: {
      "/corrector/api": {
        target: "http://127.0.0.1:25000",
        changeOrigin: true,
        secure: false,
      },
      "/corrector/v1": {
        target: "http://127.0.0.1:25000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});
