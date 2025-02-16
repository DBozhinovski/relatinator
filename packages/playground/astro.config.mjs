// @ts-check
import { defineConfig } from "astro/config";
import relatinatorIntegration from "astro-relatinator";

// https://astro.build/config
export default defineConfig({
  integrations: [
    relatinatorIntegration({
      paths: ["src/content/posts"],
      schema: ["title", "categories", "tags"],
      debug: true,
    }),
  ],
});
