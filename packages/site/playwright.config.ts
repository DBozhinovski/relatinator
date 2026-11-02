import { defineConfig } from "@playwright/test";

const baseURL = process.env.SITE_URL ?? "http://127.0.0.1:4329";

export default defineConfig({
  use: {
    baseURL,
    browserName: "chromium",
  },
  workers: 1,
  timeout: 15_000,
  webServer: {
    command: "ASTRO_DEV_BACKGROUND=1 ./node_modules/.bin/astro dev --port 4329 --host 127.0.0.1",
    url: baseURL,
    reuseExistingServer: true,
  },
});
