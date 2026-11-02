import { test, expect } from "./fixtures";

test("demo page shows its heading, lead, and marks the demo route", async ({ page }) => {
  await page.goto("/demo/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 1, name: "Try relatinator in your browser" })
  ).toBeVisible();
  await expect(page.getByText(/^Everything here runs in your browser/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Demo", exact: true })).toHaveAttribute(
    "aria-current",
    "page",
  );
  const docsCurrent = await page.getByRole("link", { name: "Docs", exact: true }).getAttribute(
    "aria-current",
  );
  expect(docsCurrent).toBeNull();
  expect(await page.title()).toBe("Demo · Relatinator");
});

const TITLES = [
  "12 New Science Books To End the Year With Wonder About Ourselves and Our World",
  "14 Fascinating Science Books to Curl Up With This Autumn",
  "13 Mind-Bending Books About Space and Cosmology",
  "10 Groundbreaking Science Books to Welcome the Spring Season",
  "15 Mind-Expanding Science Books for Your Summer Reading List",
  "11 Essential Technology Books That Will Shape Our Future",
];

test("the post select lists six titles and the method radio group offers both", async ({ page }) => {
  await page.goto("/demo/");
  const postSelect = page.getByRole("combobox", { name: "Post" });
  await expect(postSelect).toHaveCount(1);
  const options = postSelect.locator("option");
  await expect(options).toHaveCount(6);
  let index = 0;
  while (index < TITLES.length) {
    await expect(options.nth(index)).toHaveText(TITLES[index]);
    index += 1;
  }
  await expect(options.nth(0)).toHaveAttribute("selected", "");
  const methods = page.getByRole("group", { name: "Method" });
  await expect(methods).toHaveCount(1);
  await expect(methods.getByRole("radio", { name: "BM25" })).toBeChecked();
  const tfidf = methods.getByRole("radio", { name: "TF-IDF" });
  expect(await tfidf.getAttribute("checked")).toBeNull();
});

const SUMMER = "15 Mind-Expanding Science Books for Your Summer Reading List";

test("the default post ranks five scored related posts", async ({ page }) => {
  await page.goto("/demo/");
  const results = page.getByRole("list", { name: "Related posts" });
  await expect(results).toHaveCount(1);
  await expect(results).toHaveAttribute("aria-live", "polite");
  const items = results.locator("li.demo-related");
  await expect(items).toHaveCount(5);
  await expect(items.nth(0)).toHaveClass(/(?:^|\s)top(?:\s|$)/);
  await expect(items.nth(0)).toContainText(SUMMER);
  await expect(items.nth(0).locator(".demo-score")).toHaveText("79.43");
  const scores: number[] = [];
  let index = 0;
  while (index < 5) {
    scores.push(Number(await items.nth(index).locator(".demo-score").innerText()));
    index += 1;
  }
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
  const listText = await results.innerText();
  expect(listText.includes("12 New Science Books")).toBe(false);
});

const SPACE = "13 Mind-Bending Books About Space and Cosmology";

test("selecting the space post re-ranks the list", async ({ page }) => {
  await page.goto("/demo/");
  const postSelect = page.getByRole("combobox", { name: "Post" });
  await postSelect.selectOption("13 Mind-Bending Books About Space and Cosmology");
  const results = page.getByRole("list", { name: "Related posts" });
  const items = results.locator("li.demo-related");
  await expect(items).toHaveCount(5);
  await expect(items.nth(0)).toContainText(SUMMER);
  await expect(items.nth(0).locator(".demo-score")).toHaveText("84.09");
  const listText = await results.innerText();
  expect(listText.includes(SPACE)).toBe(false);
});

test("the why button reveals the shared terms list", async ({ page }) => {
  await page.goto("/demo/");
  const results = page.getByRole("list", { name: "Related posts" });
  const first = results.locator("li.demo-related").nth(0);
  const why = first.getByRole("button", { name: "Why" });
  await expect(why).toHaveAttribute("aria-expanded", "false");
  await why.click();
  const terms = first.getByRole("list", { name: "Shared terms" });
  await expect(terms).toHaveCount(1);
  const termItems = terms.getByRole("listitem");
  expect(await termItems.count()).toBeGreaterThanOrEqual(3);
  await expect(termItems.nth(0).locator("code")).toHaveText("us");
  await expect(termItems.nth(0).locator(".demo-score")).toHaveText("4.15");
  const termScores: number[] = [];
  let termIndex = 0;
  while (termIndex < await termItems.count()) {
    termScores.push(Number(await termItems.nth(termIndex).locator(".demo-score").innerText()));
    termIndex += 1;
  }
  expect(termScores).toEqual([...termScores].sort((a, b) => b - a));
  await why.click();
  await expect(why).toHaveAttribute("aria-expanded", "false");
  await expect(first.getByRole("list", { name: "Shared terms" })).toHaveCount(0);
});

test("choosing tfidf changes the scores", async ({ page }) => {
  await page.goto("/demo/");
  const results = page.getByRole("list", { name: "Related posts" });
  const first = results.locator("li.demo-related").nth(0);
  const tfidf = page.getByRole("radio", { name: "TF-IDF" });
  await tfidf.check();
  await expect(first).toContainText(SUMMER);
  await expect(first.locator(".demo-score")).toHaveText("717.90");
  await page.getByRole("radio", { name: "BM25" }).check();
  await expect(first.locator(".demo-score")).toHaveText("79.43");
});

test("the text query replaces the post search", async ({ page }) => {
  await page.goto("/demo/");
  const postSelect = page.getByRole("combobox", { name: "Post" });
  const results = page.getByRole("list", { name: "Related posts" });
  const items = results.locator("li.demo-related");
  await page.getByRole("textbox", { name: "Or paste your own text" }).fill("black holes and gravitational waves");
  await expect(items).toHaveCount(1);
  await expect(items.nth(0)).toContainText(SPACE);
  await expect(items.nth(0).locator(".demo-score")).toHaveText("10.51");
  await expect(postSelect).toBeDisabled();
  await page.getByRole("textbox", { name: "Or paste your own text" }).fill("");
  await expect(postSelect).toBeEnabled();
  await expect(items).toHaveCount(5);
  await expect(items.nth(0)).toContainText(SUMMER);
});

const TOPIC_LINES = [
  "space: black holes, gravitational waves, exoplanets, cosmology, astronomy, telescopes, planets, the universe",
  "biology: evolution, genetics, DNA, cells, ecosystems, animals, plants, microbes, the brain",
  "technology: programming, software, AI, machine learning, computers, the internet, startups",
  "climate: climate change, carbon, oceans, weather, energy, renewable power, the environment",
  "physics: quantum mechanics, particles, relativity, thermodynamics, light, matter, energy",
];
const TOPIC_TEXT = TOPIC_LINES.join("\n");
const CHANG = "Chang explains the latest theories about black holes and the information paradox";

test("the fixed topic list classifies the default text", async ({ page }) => {
  await page.goto("/demo/");
  expect(await page.getByRole("textbox", { name: "Topics" }).inputValue()).toBe(TOPIC_TEXT);
  expect(await page.getByRole("textbox", { name: "Text", exact: true }).inputValue()).toBe(CHANG);
  const results = page.getByRole("list", { name: "Topics for this text" });
  const items = results.getByRole("listitem");
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toHaveClass("top");
  await expect(items.nth(0)).toContainText("space");
  await expect(items.nth(0).locator(".demo-score")).toHaveText("1.00");
  await expect(items.nth(1)).toContainText("climate");
  await expect(items.nth(1).locator(".demo-score")).toHaveText("0.52");
});

test("the ratio control filters the topic list", async ({ page }) => {
  await page.goto("/demo/");
  const ratio = page.getByRole("slider", { name: "Ratio" });
  expect(await ratio.getAttribute("min")).toBe("0");
  expect(await ratio.getAttribute("max")).toBe("1");
  expect(await ratio.getAttribute("step")).toBe("0.1");
  const results = page.getByRole("list", { name: "Topics for this text" });
  const items = results.getByRole("listitem");
  await expect(page.locator("#demo-ratio-value")).toHaveText("0.5");
  await ratio.fill("1");
  await expect(page.locator("#demo-ratio-value")).toHaveText("1");
  await expect(items).toHaveCount(1);
  await expect(items.nth(0)).toContainText("space");
  await expect(items.nth(0).locator(".demo-score")).toHaveText("1.00");
  await ratio.fill("0.5");
  await expect(items).toHaveCount(2);
});

const QUANTUM = "A quantum computer simulates particles and light with new software";

test("editing the topic and text fields re-classifies", async ({ page }) => {
  await page.goto("/demo/");
  const topics = page.getByRole("textbox", { name: "Topics" });
  const text = page.getByRole("textbox", { name: "Text", exact: true });
  const items = page.getByRole("list", { name: "Topics for this text" }).getByRole("listitem");
  await topics.fill(TOPIC_LINES.slice(1).join("\n"));
  await expect(items).toHaveCount(1);
  await expect(items.nth(0)).toContainText("climate");
  await expect(items.nth(0).locator(".demo-score")).toHaveText("1.00");
  await topics.fill(TOPIC_TEXT);
  await text.fill(QUANTUM);
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toHaveClass("top");
  await expect(items.nth(0)).toContainText("physics");
  await expect(items.nth(0).locator(".demo-score")).toHaveText("1.00");
  await expect(items.nth(1)).toContainText("technology");
  await expect(items.nth(1).locator(".demo-score")).toHaveText("0.67");
});

test("a duplicate topic tag reports in the alert", async ({ page }) => {
  await page.goto("/demo/");
  const topics = page.getByRole("textbox", { name: "Topics" });
  const items = page.getByRole("list", { name: "Topics for this text" }).getByRole("listitem");
  await topics.fill(`space\n${TOPIC_TEXT}`);
  await expect(page.getByRole("alert")).toHaveCount(1);
  await expect(page.locator("#demo-alert")).toHaveText('Duplicate topic tag: "space"');
  await expect(items).toHaveCount(2);
  await expect(items.nth(0)).toHaveClass("top");
  await topics.fill(TOPIC_TEXT);
  await expect(page.locator("#demo-alert")).toHaveText("");
});

test("the demo page fits all required viewport widths", async ({ page }) => {
  await page.goto("/demo/");
  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => window.innerWidth),
    );
  }
});

test("an empty result says so instead of going blank", async ({ page }) => {
  await page.goto("/demo/");
  const related = page.getByRole("list", { name: "Related posts" });
  await page.getByRole("textbox", { name: "Or paste your own text" }).fill("zzzz qqqq");
  await expect(related.locator("li.demo-empty")).toHaveCount(1);
  await expect(related).toHaveText("No related posts");
  const topics = page.getByRole("list", { name: "Topics for this text" });
  await page.getByRole("textbox", { name: "Text", exact: true }).fill("zzzz qqqq");
  await expect(topics).toHaveText("No topics match");
  await expect(page.locator("#demo-alert")).toHaveText("");
});
