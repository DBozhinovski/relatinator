import { test as base, expect } from "@playwright/test";

/**
 * Every test fails when the page logs a console warning or error, or throws.
 * Astro dev and Vite warnings arrive as console warnings.
 * A test that expects a console error sets `consoleErrorsAllowed` with `test.use`.
 */
export const test = base.extend<{ consoleErrorsAllowed: boolean; consoleGuard: void }>({
  consoleErrorsAllowed: [false, { option: true }],
  consoleGuard: [
    async ({ page, consoleErrorsAllowed }, use) => {
      const problems: string[] = [];
      page.on("console", (message) => {
        const type = message.type();
        if (type === "warning" || (type === "error" && !consoleErrorsAllowed)) {
          problems.push(`${type}: ${message.text()}`);
        }
      });
      page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
      await use();
      expect(problems, "console warnings, console errors, or page errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
