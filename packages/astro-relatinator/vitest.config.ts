import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const stub = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "astro:content": stub("./test/astro-content.ts"),
      emdash: stub("./test/emdash.ts"),
    },
  },
});
