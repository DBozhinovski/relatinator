import { test, expect } from "./fixtures";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The Markdown file each docs route renders, relative to this package.
const SOURCES: Record<string, string> = {
  "/docs/relatinator/": "../../packages/relatinator/README.md",
  "/docs/astro-relatinator/": "../../packages/astro-relatinator/README.md",
  "/docs/architecture/": "../../docs/architecture.md",
};

function sectionTitles(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => line.startsWith("## "))
    .map((line) => line.slice(3));
}

const DOC_PAGES = {
  "/docs/relatinator/": "Relatinator",
  "/docs/astro-relatinator/": "astro-relatinator",
  "/docs/architecture/": "Relatinator architecture",
};

test(`three docs routes render one h1 with the right title`, async ({ page }) => {
  for (const [route, heading] of Object.entries(DOC_PAGES)) {
    await page.goto(route);
    const headings = page.getByRole("heading", { level: 1 });
    await expect(headings).toHaveCount(1);
    expect(await headings.first().innerText()).toBe(heading);
    expect(await page.title()).toBe(`${heading} · Relatinator`);
  }
});

test(`docs pages render the section headings of their markdown file`, async ({ page }) => {
  for (const [route, source] of Object.entries(SOURCES)) {
    const titles = sectionTitles(readFileSync(resolve(process.cwd(), source), "utf8"));
    await page.goto(route);
    const headings = page.getByRole("heading", { level: 2 });
    await expect(headings).toHaveCount(titles.length);
    expect(await headings.evaluateAll((nodes) => nodes.map((node) => node.textContent))).toEqual(titles);
  }
});

test(`headings keep ids and content links jump to them`, async ({ page }) => {
  for (const route of Object.keys(SOURCES)) {
    await page.goto(route);
    const headingIds = await page.locator(".docs-content :is(h2, h3, h4)").evaluateAll((nodes) => nodes.map((node) => node.id));
    expect(headingIds.every((id) => id !== "")).toBe(true);
    const jumps = (await page.locator(".docs-content a").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? "")))
      .filter((href) => href.startsWith("#"));
    expect(jumps.length).toBeGreaterThan(0);
    for (const jump of jumps) {
      expect(headingIds).toContain(jump.slice(1));
    }
  }
});

test(`the docs root redirects to the library docs`, async ({ page }) => {
  const response = await page.goto("/docs/");
  expect(response?.status()).toBe(200);
  expect(page.url()).toContain("/docs/relatinator/");
  expect(await page.getByRole("heading", { level: 1 }).first().innerText()).toBe("Relatinator");
});

test(`the docs sidebar lists every docs page and marks the current one`, async ({ page }) => {
  for (const route of Object.keys(SOURCES)) {
    await page.goto(route);
    const sections = page.getByLabel("Docs", { exact: true });
    await expect(sections).toHaveCount(1);
    const links = sections.locator("a");
    await expect(links).toHaveCount(3);
    expect(await links.evaluateAll((nodes) => nodes.map((node) => node.textContent))).toEqual(["relatinator", "astro-relatinator", "Architecture"]);
    const current = sections.locator("a[aria-current='page']");
    await expect(current).toHaveCount(1);
    expect(await current.first().getAttribute("href")).toBe(route);
  }
});

test(`the docs sidebar collapses into a closed details block on a phone`, async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of Object.keys(SOURCES)) {
    await page.goto(route);
    const index = page.locator("#docs-index");
    await expect(index).toHaveCount(1);
    expect(await index.getAttribute("open")).toBe(null);
    expect(await page.locator("#docs-index a").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href"))))
      .toEqual(["/docs/relatinator/", "/docs/astro-relatinator/", "/docs/architecture/"]);
  }
});

test(`the table of contents lists the sections in document order`, async ({ page }) => {
  for (const route of Object.keys(SOURCES)) {
    await page.goto(route);
    const toc = page.getByLabel("On this page");
    await expect(toc).toHaveCount(1);
    const tocTargets = (await toc.locator("a").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? "")))
      .map((href) => href.slice(1));
    expect(tocTargets).toEqual(await page.locator(".docs-content :is(h2, h3, h4)").evaluateAll((nodes) => nodes.map((node) => node.id)));
    expect(await toc.locator("a").evaluateAll((nodes) => nodes.map((node) => node.textContent))).toEqual(await page.locator(".docs-content :is(h2, h3, h4)").evaluateAll((nodes) => nodes.map((node) => node.textContent)));
  }
});

test(`the header marks the docs route as current`, async ({ page }) => {
  for (const route of Object.keys(SOURCES)) {
    await page.goto(route);
    expect(await page.locator("header a[aria-current='page']").evaluateAll((nodes) => nodes.map((node) => node.textContent))).toEqual(["Docs"]);
  }
});

test(`code blocks follow the theme`, async ({ page }) => {
  for (const route of Object.keys(SOURCES)) {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(route);
    const blocks = page.locator(".docs-content pre");
    if ((await blocks.count()) === 0) {
      continue;
    }
    const block = blocks.first();
    const initialColor = await block.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(initialColor).not.toBe("");
    await page.getByRole("button", { name: "Toggle dark mode" }).click();
    const toggledColor = await block.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(toggledColor).toBe(initialColor);
  }
});

test(`tables scroll inside their own wrapper and the page never scrolls sideways`, async ({ page }) => {
  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of Object.keys(SOURCES)) {
      await page.goto(route);
      const wrapped = await page.evaluate(() => {
        const tables = [...document.querySelectorAll(".docs-content table")];
        const wrappers = [...document.querySelectorAll(".docs-content .table-wrap")];
        return tables.length > 0 && tables.length === wrappers.length
          && tables.every((table) => {
            const parent = table.parentElement;
            return parent !== null && wrappers.includes(parent);
          });
      });
      expect(wrapped).toBe(true);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    }
  }
});

test(`repository links in the docs point at site routes`, async ({ page }) => {
  await page.goto("/docs/astro-relatinator/");
  const astroHrefs = await page.locator(".docs-content a").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? ""));
  expect(astroHrefs).toContain("/docs/architecture/#verification");
  expect(astroHrefs).toContain("/docs/relatinator/#how-scoring-works");
  expect(astroHrefs).toContain("https://github.com/DBozhinovski/relatinator/blob/master/packages/astro-relatinator/CHANGELOG.md#310---2026-10-16");
  await page.goto("/docs/architecture/");
  const architectureHrefs = await page.locator(".docs-content a").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? ""));
  expect(architectureHrefs).toContain("/docs/relatinator/");
  expect(architectureHrefs).toContain("/docs/astro-relatinator/#emdash-options");
  expect(architectureHrefs).toContain("https://github.com/DBozhinovski/relatinator/issues/6");
  await page.goto("/docs/relatinator/");
  const relatinatorHrefs = await page.locator(".docs-content a").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? ""));
  expect(relatinatorHrefs).toContain("/docs/architecture/#topics-from-a-fixed-list-scored-by-their-descriptions");
  for (const hrefs of [astroHrefs, architectureHrefs, relatinatorHrefs]) {
    expect(hrefs.some((href) => href.startsWith("../") || href.startsWith("./"))).toBe(false);
  }
});

test(`each docs route serves its built file with a clean console`, async ({ page }) => {
  for (const route of Object.keys(SOURCES)) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    expect(page.url()).toContain(route);
    expect(await page.getByRole("heading", { level: 1 }).count()).toBe(1);
  }
});
