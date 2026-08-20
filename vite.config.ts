import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";

import manifest from "./manifest.json" with { type: "json" };

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [crx({ manifest })],
  resolve: {
    alias: {
      "@": path.resolve(dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        chunkFileNames: "chunks/[name]-[hash].js",
      },
    },
  },
});
