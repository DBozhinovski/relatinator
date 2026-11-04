import { test, expect } from "./fixtures";

test("landing shell and live related-post card render", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".brand-symbol")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "relatinator home" }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }).getByRole("link"),
  ).toHaveCount(3);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Find related posts when your site builds.",
    }),
  ).toBeVisible();
  const displayFont = await page
    .locator("h1")
    .evaluate((element) => getComputedStyle(element).fontFamily);
  expect(displayFont).toMatch(/Space Grotesk/i);
  await expect(page.locator("#hero-post")).toHaveValue("science-books-space");
  const selectedPost = page.locator("#hero-post option:checked");
  await expect(selectedPost).toHaveText(/13 Mind-Bending/);
  await expect(selectedPost).toHaveAttribute("title", /Space and Cosmology/);
  await expect(page.locator("#hero-results .live-result")).toHaveCount(3);
  await expect(page.locator("#hero-status")).toHaveText(
    /^IN YOUR BROWSER · [\d.]+ MS$/,
  );
  await page.locator("#hero-post").selectOption("science-books-autumn");
  await expect(page.locator("#hero-post-id")).toContainText(
    "science-books-autumn",
  );
  await expect(page.locator("#hero-results .live-result")).toHaveCount(3);
});

test("palette opens with click and Ctrl+K, filters and navigates by keyboard", async ({
  page,
}) => {
  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Search" });
  const dialog = page.getByRole("dialog", {
    name: "Search pages and sections",
  });
  await trigger.click();
  await expect(dialog).toBeVisible();
  await expect(
    page.getByRole("searchbox", { name: "Search pages and sections" }),
  ).toBeFocused();
  await page
    .getByRole("searchbox", { name: "Search pages and sections" })
    .fill("architecture");
  expect(
    await page.locator("#palette-list [role=option]:visible").count(),
  ).toBeGreaterThan(0);
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/docs\/architecture\/$/);
  await page.keyboard.press("Control+k");
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByRole("button", { name: "Search" })).toBeFocused();
});

test("palette says when no entry matches", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Search" }).click();
  const search = page.getByRole("searchbox", {
    name: "Search pages and sections",
  });
  const empty = page.getByText("No pages or sections match.");
  await expect(empty).toBeHidden();
  await search.fill("zzzz");
  await expect(empty).toBeVisible();
  await search.fill("scoring");
  await expect(empty).toBeHidden();
});

test("theme toggle sets light and dark paper overrides", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: "Toggle dark mode" });
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkPaper = await page
    .locator("body")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(darkPaper).not.toBe("rgb(255, 255, 255)");
  await toggle.click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  const lightPaper = await page
    .locator("body")
    .evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(lightPaper).not.toBe(darkPaper);
});

test("features, scoring steps, install and compatibility match the contract", async ({
  page,
}) => {
  await page.goto("/");
  const commands = (await page.locator(".install-lines").innerText()).replace(
    /\s+/g,
    " ",
  );
  expect(commands).toContain("pnpm add relatinator");
  expect(commands).toContain("pnpm add astro-relatinator");
  await expect(page.getByRole("button", { name: "Copy" })).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Read the docs" }),
  ).toHaveAttribute("href", "/docs/relatinator/");
  for (const [title, body] of [
    [
      "See why a post ranked where it did",
      "findRelatedScored gives you the scores. explainRelated shows which words earned them, so you can check a strange match instead of guessing.",
    ],
    [
      "Works with Astro content collections",
      'getRelated("posts", entry, { limit: 3 }) reads the collection when the page renders. It works with static output and with on-demand rendering.',
    ],
    [
      "Topics from a fixed list",
      "classify(topics, text) matches text against topic descriptions you write. You don't train anything or ship a model file, and the text never leaves your process. To have a language model pick the topics, use the experimental relatinator/llm entry point, with a chat model or a 176 MB embedding model.",
    ],
  ]) {
    const heading = page.getByRole("heading", { level: 2, name: title });
    await expect(heading).toBeVisible();
    await expect(heading.locator("xpath=..").locator("p")).toHaveText(body);
  }
  const steps = page.locator(".steps li");
  await expect(steps).toHaveCount(4);
  await expect(steps.nth(0)).toContainText("Tokenize");
  await expect(steps.nth(1)).toContainText("Weigh");
  await expect(steps.nth(2)).toContainText("Score");
  await expect(steps.nth(3)).toContainText("Rank");
  await expect(page.locator("table tbody tr")).toHaveCount(7);
});

test("landing has no horizontal overflow at required widths", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [320, 375, 414, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("mobile header keeps search and theme controls inside the viewport", async ({
  page,
}) => {
  await page.goto("/");
  for (const width of [320, 375]) {
    await page.setViewportSize({ width, height: 900 });
    const brandBox = await page.locator(".brand").boundingBox();
    const navBox = await page.locator(".site-nav").boundingBox();
    expect(navBox!.y).toBeGreaterThanOrEqual(brandBox!.y + brandBox!.height);
    for (const selector of ["#search-trigger", "#theme-toggle"]) {
      const box = await page.locator(selector).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(width);
    }
  }
});

test("graphite syntax colors match in landing, demo, and docs code", async ({
  page,
}) => {
  const colorsFor = async (selector: string) =>
    page.locator(selector).evaluate((root) => {
      const colorOf = (token: string) => {
        const matches = Array.from(root.querySelectorAll("span")).filter(
          (item) => item.textContent?.trim() === token,
        );
        const span = matches[matches.length - 1];
        return span ? getComputedStyle(span).color : null;
      };
      const colorToken = (token: string) => {
        const sample = document.createElement("span");
        const canvas = document.createElement("canvas");
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext("2d")!;
        sample.style.color = `var(--color-graphite-${token})`;
        document.body.append(sample);
        context.fillStyle = getComputedStyle(sample).color;
        context.fillRect(0, 0, 1, 1);
        const [red, green, blue] = context.getImageData(0, 0, 1, 1).data;
        sample.remove();
        return `rgb(${red}, ${green}, ${blue})`;
      };
      return {
        function: colorOf("createModel"),
        method: colorOf("findRelatedScored"),
        import: colorOf("import"),
        constant: colorOf("const"),
        accent: colorToken("accent"),
        muted: colorToken("muted"),
      };
    });

  const expectColors = (colors: {
    function: string | null;
    method: string | null;
    import: string | null;
    constant: string | null;
    accent: string;
    muted: string;
  }) => {
    expect(colors.function).toBe(colors.accent);
    expect(colors.method).toBe(colors.accent);
    expect(colors.import).toBe(colors.muted);
    expect(colors.constant).toBe(colors.muted);
  };

  await page.goto("/");
  expectColors(await colorsFor("#hero-code"));
  await page.goto("/demo/");
  expectColors(
    await colorsFor(".demo-section[aria-labelledby='related-posts'] .code-card"),
  );
  await page.goto("/docs/relatinator/");
  expectColors(await colorsFor(".docs-content"));
});
