import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
    exclude: [
      "node_modules",
      "e2e",
      "e2e/**",
      "playwright.config.ts",
      ".claude/**",
      ".worktrees/**",
    ],
    css: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // server-only is a Next.js-bundled package not installed as a top-level dep.
      // Point Vitest at Next.js's compiled empty stub so the bare specifier resolves;
      // individual tests mock it to prevent the throw. Use require.resolve so this
      // works from both the main checkout and any git worktree (which shares the
      // parent's node_modules via Node's directory-walking resolution).
      "server-only": require.resolve("next/dist/compiled/server-only/empty.js"),
    },
  },
});
