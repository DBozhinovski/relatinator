import { test, expect } from "./fixtures";

test("header shows brand and nav links", async ({ page }) => {
  await page.goto("/");
  const brand = page.locator("header a.brand");
  await expect(brand).toHaveCount(1);
  await expect(brand).toHaveAttribute("href", "/");
  await expect(brand).toHaveAttribute("aria-current", "page");
  await expect(brand).toHaveText("relatinator");
  await expect(brand.locator(".brand-symbol")).toBeVisible();
  await expect(page.getByRole("link", { name: "Docs", exact: true })).toHaveAttribute("href", "/docs/relatinator/");
  await expect(page.getByRole("link", { name: "Demo", exact: true })).toHaveAttribute("href", "/demo/");
  await expect(page.getByRole("navigation").getByRole("link", { name: "GitHub", exact: true })).toHaveAttribute("href", "https://github.com/DBozhinovski/relatinator");
  const docsCurrent = await page.getByRole("link", { name: "Docs", exact: true }).getAttribute("aria-current");
  expect(docsCurrent).toBeNull();
});

test("skip link is first and moves focus to main", async ({ page }) => {
  await page.goto("/");
  const skip = page.getByRole("link", { name: "Skip to content" });
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  const focusedHref = await page.evaluate("(() => document.activeElement.getAttribute('href'))()");
  expect(focusedHref).toBe("#main");
  await page.keyboard.press("Enter");
  const hash = await page.evaluate("(() => window.location.hash)()");
  expect(hash).toBe("#main");
});

test("theme toggle stores the choice and survives reload", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  const dark = await page.evaluate("(() => getComputedStyle(document.body).backgroundColor)()");
  expect(dark).not.toBe("rgb(255, 255, 255)");
  await expect(page.locator("html:not([data-theme])")).toHaveCount(1);
  const toggle = page.getByRole("button", { name: "Toggle dark mode" });
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await toggle.click();
  const light = await page.evaluate("(() => getComputedStyle(document.body).backgroundColor)()");
  expect(light).not.toBe(dark);
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await page.reload();
  await expect(page.locator("html[data-theme='light']")).toHaveCount(1);
  await page.evaluate("(() => localStorage.clear())()");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  const fresh = page.getByRole("button", { name: "Toggle dark mode" });
  await expect(fresh).toHaveAttribute("aria-pressed", "false");
  await fresh.click();
  await expect(page.locator("html[data-theme='dark']")).toHaveCount(1);
  await expect(fresh).toHaveAttribute("aria-pressed", "true");
});

test("footer names MIT and links GitHub and npm", async ({ page }) => {
  await page.goto("/");
  const footer = page.locator("footer").first();
  await expect(footer).toHaveText(/MIT/);
  await expect(footer.getByRole("link", { name: "GitHub" })).toHaveAttribute("href", "https://github.com/DBozhinovski/relatinator");
  await expect(footer.getByRole("link", { name: "relatinator on npm", exact: true })).toHaveAttribute("href", "https://www.npmjs.com/package/relatinator");
  await expect(footer.getByRole("link", { name: "astro-relatinator on npm", exact: true })).toHaveAttribute("href", "https://www.npmjs.com/package/astro-relatinator");
});

test("landing shell keeps the console clean", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Toggle dark mode" })).toBeVisible();
});
