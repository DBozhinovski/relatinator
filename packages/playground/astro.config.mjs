// @ts-check
import { defineConfig } from "astro/config";
import relatinator from "astro-relatinator";

export default defineConfig({
  integrations: [relatinator()],
});
