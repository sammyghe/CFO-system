import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

// "single" mode inlines everything into one HTML file (used for preview links).
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: mode === "single" ? [viteSingleFile()] : [],
  build: {
    outDir: mode === "single" ? "dist-single" : "dist",
    target: "es2020",
    copyPublicDir: mode !== "single",
  },
  test: { environment: "node" },
}));
