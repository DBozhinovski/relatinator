// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import { fileURLToPath } from "node:url";
import { satteri } from "@astrojs/markdown-satteri";
import { createLinkPlugin, createTablePlugin } from "./src/lib/rewrite-links.ts";
import { graphiteTheme } from "./src/lib/shiki-theme.ts";

// The plugins resolve repository paths against the root, two levels above this
// package.
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

export default defineConfig({
  site: "https://relatinator.com",
  devToolbar: { enabled: false },
  redirects: { "/docs": "/docs/relatinator/" },
  markdown: {
    processor: satteri({
      hastPlugins: [createLinkPlugin(repoRoot), createTablePlugin()],
    }),
    shikiConfig: {
      themes: { dark: graphiteTheme },
      defaultColor: "dark",
    },
  },
  fonts: [
    { provider: fontProviders.fontsource(), name: "Space Grotesk", cssVariable: "--font-display", weights: [500, 600] },
    { provider: fontProviders.fontsource(), name: "Inter", cssVariable: "--font-body", weights: [400, 500, 600] },
    { provider: fontProviders.fontsource(), name: "JetBrains Mono", cssVariable: "--font-mono", weights: [400, 500] },
  ],
});
