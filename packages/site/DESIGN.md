# Design: relatinator site

This file is the locked design system for `packages/site`. Every page reads it before code changes. Amend this file when the system needs to grow. Do not override it in one page.

Hallmark run: multi-page redesign, 2026-11-01. Stamp every stylesheet with:

```css
/* Hallmark · genre: modern-minimal · theme: cobalt · design-system: DESIGN.md · designed-as-app */
```

## Genre and theme

- Genre: modern-minimal.
- Theme: Cobalt. The ground is a cool near-white paper. Hairlines carry the structure. One electric cobalt accent is the only signal. Code is the hero.
- Tone: technical and calm. The page must read like an instrument panel, not a marketing template.
- Audience: JavaScript and Astro developers who want related posts without a hosted service or an embedding model.

## Macrostructure family

| Page type | Route | Macrostructure | Notes |
|---|---|---|---|
| Marketing | `/` | SaaS / API product with a split hero | Title left, live code card right. |
| App | `/demo/` | Workbench | Controls left, ranked output right. |
| Content | `/docs/*` | Docs home with three rails | Sidebar, prose column, table of contents. |

## Brand

The logo is direction A, "Shared tile". Two document corners hold one shared square. The square is the shared term that makes two documents related.

- Symbol source: `designs/logo/a-symbol.svg`, a 64 by 64 grid.
- Symbol paths:
  - Ink: `M8 8H40V20H20V40H8Z` and `M44 24H56V56H24V44H44Z`
  - Accent: `M24 24H40V40H24Z`
- In the site header, draw the symbol inline. The ink paths use `currentColor`. The accent path uses `var(--color-accent)`. The header symbol is 24px square.
- The wordmark is live text: lowercase `relatinator`, `--font-display`, weight 600, letter spacing `-0.01em`. Do not use the outlined wordmark in the header, because live text is accessible and matches the font.
- Brand files in `public/`: `favicon.svg`, `favicon.ico`, `apple-touch-icon.png`, `logo.svg` (horizontal lockup), `logo-stacked.svg`, and `og.png`.
- Brand colors are fixed: ink `#192029`, cobalt `#0a6ddd`, paper `#f8fafd`. Dark-background versions use paper `#eff2f6` for the ink parts.

## Color tokens

Every color is a token in `src/styles/tokens.css`. Components use tokens only. Do not write a literal color outside `tokens.css` and the Shiki theme file.

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-paper` | `oklch(98.5% 0.004 250)` | `oklch(18% 0.014 260)` | Page ground |
| `--color-paper-2` | `oklch(96.5% 0.006 252)` | `oklch(22% 0.016 260)` | Inputs, table head, sidebar hover |
| `--color-ink` | `oklch(24% 0.02 258)` | `oklch(96% 0.006 250)` | Headings, brand |
| `--color-ink-2` | `oklch(34% 0.018 257)` | `oklch(86% 0.01 252)` | Body text |
| `--color-muted` | `oklch(48% 0.016 257)` | `oklch(70% 0.014 255)` | Meta, labels, scores |
| `--color-rule` | `oklch(90% 0.008 255)` | `oklch(30% 0.016 260)` | Hairlines |
| `--color-rule-2` | `oklch(84% 0.01 255)` | `oklch(36% 0.018 260)` | Control borders, code card border |
| `--color-accent` | `oklch(55% 0.19 257)` | `oklch(70% 0.15 254)` | The one signal |
| `--color-accent-ink` | `oklch(98.5% 0.004 250)` | `oklch(18% 0.02 260)` | Text on an accent fill |
| `--color-focus` | `oklch(55% 0.19 257)` | `oklch(70% 0.15 254)` | Focus rings |
| `--color-graphite` | `oklch(22% 0.016 260)` | `oklch(14% 0.012 260)` | Code cards and the dark band |
| `--color-graphite-text` | `oklch(90% 0.008 250)` | `oklch(90% 0.008 250)` | Text on graphite |
| `--color-graphite-muted` | `oklch(70% 0.014 255)` | `oklch(70% 0.014 255)` | Meta on graphite |
| `--color-graphite-accent` | `oklch(72% 0.14 252)` | `oklch(72% 0.14 252)` | Accent on graphite |
| `--color-graphite-rule` | `oklch(32% 0.016 260)` | `oklch(30% 0.016 260)` | Hairlines on graphite |

Measured contrast (WCAG 2): ink-2 on paper 11.3:1. Muted on paper 6.3:1. Accent on paper 4.8:1. Paper on accent 4.8:1. Graphite text on graphite 12.9:1. Graphite accent on graphite 7.0:1. Dark mode: ink-2 12.3:1, muted 7.0:1, accent 7.0:1.

Rules:

- Light is the default. Dark applies under `@media (prefers-color-scheme: dark)` when `html` has no `data-theme`, and always under `html[data-theme="dark"]`. `html[data-theme="light"]` forces light.
- The accent covers less than 5% of any viewport. Use it for the primary button, focus rings, the active nav and sidebar item, link hover underlines, the top-result tick, the status chip, and the logo square.
- No shadows, except one `0 1px 2px` lift on the hero code card. Borders make depth.
- No gradients, no glass, no background texture.

## Typography

Load the fonts with the Astro Fonts API and the Fontsource provider. The build downloads them and the site serves them itself. Do not link Google Fonts.

| Role | Face | Weights | Token |
|---|---|---|---|
| Display | Space Grotesk | 500, 600 | `--font-display` |
| Body | Inter | 400, 500, 600 | `--font-body` |
| Mono | JetBrains Mono | 400, 500 | `--font-mono` |

- Body: 1rem (16px) at line height 1.65. Prose measure 70ch.
- Scale tokens: `--text-xs` 0.75rem, `--text-sm` 0.875rem, `--text-md` 1.0625rem, `--text-lg` 1.25rem, `--text-xl` 1.625rem, `--text-2xl` 2.125rem, `--text-display` `clamp(2.25rem, 1.4rem + 3.2vw, 3.75rem)`.
- Headings use `--font-display`, roman only, never italic. `h1` weight 600, letter spacing `-0.025em`, line height 1.05. `h2` weight 600, `-0.015em`. `h3` weight 500.
- Display headings get `overflow-wrap: anywhere` and `min-width: 0`.
- Mono labels: `--font-mono`, `--text-xs`, uppercase, letter spacing `0.06em`. Use them for meta, status chips, kbd hints, table heads, and step names.
- Scores and numbers use `font-variant-numeric: tabular-nums`.
- No section eyebrows. The only small label above the hero heading is the release chip.

## Spacing, radius, and layout

- 4-point scale with names: `--space-3xs` 0.25rem, `--space-2xs` 0.5rem, `--space-xs` 0.75rem, `--space-sm` 1rem, `--space-md` 1.5rem, `--space-lg` 2rem, `--space-xl` 3rem, `--space-2xl` 4.5rem, `--space-3xl` 7rem.
- Radius: `--radius-control` 6px for buttons and inputs. `--radius-card` 10px for code cards and panels. No pills.
- Page container: max width 76rem, gutter `--space-sm` below 40rem and `--space-lg` above.
- Breakpoints: 60rem for layout, 40rem for type.
- `html` and `body` get `overflow-x: clip`. No horizontal page scroll at 320, 375, 414, 768, and 1280px.
- Grid tracks that hold media or code use `minmax(0, 1fr)`.
- Clickable text never wraps to two lines.

## Motion

- Easings: `--ease-out` `cubic-bezier(0.16, 1, 0.3, 1)`, `--ease-in` `cubic-bezier(0.7, 0, 0.84, 0)`, `--ease-in-out` `cubic-bezier(0.65, 0, 0.35, 1)`. Durations: `--dur-short` 150ms, `--dur-med` 240ms, `--dur-reveal` 600ms.
- Three primitives only:
  1. Section reveal on the landing page: opacity and a 10px rise, once, with an `IntersectionObserver`.
  2. Copy confirmation on the install block: the button label changes to `Copied` for 1.5 seconds. No toast.
  3. Command palette open: opacity and `scale(0.98)` to `scale(1)`.
- Hover: a 1px border color shift to accent on focusable surfaces, and an underline on links.
- Animate `transform` and `opacity` only. Color transitions are 150ms.
- Under `prefers-reduced-motion: reduce`, all content shows at once and nothing moves.
- Focus rings show at once. Do not animate them.

## Components

### Header (nav archetype N1b, bordered)

- Previous nav: a flat wordmark row with a text toggle. This build: N1b, three sections, because the site has three destinations plus search.
- Full-width bar, one hairline bottom border, sticky, paper background with `backdrop-filter: blur(8px)` and a 92% paper fill.
- Left: the brand link to `/` (symbol and wordmark), then the links `Docs` (`/docs/relatinator/`), `Demo` (`/demo/`), and `GitHub` (the repository URL).
- Right: the search button and the theme toggle.
- The search button is bordered, `--radius-control`, with the text `Search` and a kbd hint `⌘K`. Below 40rem it shows the icon only, and keeps the accessible name `Search`.
- The theme toggle is an icon button (a drawn sun or moon SVG) with `aria-label="Toggle dark mode"` and `aria-pressed`. It keeps the current behavior: it sets `data-theme` on `html` and stores `theme` in `localStorage`. The inline head script prevents a flash.
- The active route link has `aria-current="page"` and an accent underline 2px below the text.

### Command palette

- A native `<dialog>` opened with `showModal()`. The search button opens it. `⌘K` and `Ctrl+K` also open it from any page.
- Contents: one search input labeled `Search pages and sections`, and one list of results with `role="listbox"`.
- Entries: the home page, the three docs pages, the demo, GitHub, and the two npm pages. Then every `h2` of the three docs pages, built at build time from the docs collection headings.
- Type to filter, with a case-insensitive substring match on the label and the group. Arrow Up and Arrow Down move the selection. Enter opens the selected entry. Escape and a backdrop click close the dialog.
- Each row shows the label and a mono group label (`Page`, `relatinator`, `astro-relatinator`, `Architecture`, `Link`).
- When the dialog closes, focus goes back to the control that opened it.

### Buttons and links

- Primary: accent fill, accent-ink text, `--radius-control`, padding `0.625rem 1rem`, `--font-body` weight 500. Use one per page.
- Secondary: a text link with an arrow, `Try the demo →`. The underline grows on hover.
- Small control button (for example, `Why` and `Copy`): a hairline border, paper-2 fill, mono `--text-xs` text.
- Prose links: ink-2 color with an accent underline, `text-underline-offset: 0.2em`, `text-decoration-thickness: 1px`. On hover the text changes to the accent.
- Every interactive element gets a 2px `--color-focus` outline with a 2px offset on `:focus-visible`.

### Code

- Every code block is a graphite card: `--color-graphite` fill, 1px `--color-rule-2` border, `--radius-card`, padding `--space-sm` `--space-md`, mono `--text-sm`, horizontal scroll inside the block.
- Do not draw window chrome. No traffic-light dots and no fake title bar. A card may have a plain header row with a mono file name and a status chip, separated by a graphite hairline.
- Syntax colors come from one custom Shiki theme in `src/lib/shiki-theme.ts`, used by Markdown and by `<Code>`. Methods, functions, and properties use the graphite accent. Strings use the graphite text color. Keywords and punctuation use the graphite muted color. Comments use a color with at least 4.5:1 contrast on graphite. The theme file is the only place outside `tokens.css` with hex colors. Each hex value must match a graphite token.
- Inline `code` in prose: mono 0.9em, paper-2 fill, 1px rule border, 4px radius.

### Tables

- Full width, hairline row borders only, no vertical borders. The head row uses mono labels in the muted color.
- Each table sits in a `.table-wrap` that scrolls on its own at narrow widths.

### Footer (archetype Ft2, one inline line)

- One hairline top border and one row: the symbol, `MIT license`, `GitHub`, `relatinator on npm`, and `astro-relatinator on npm`. The row wraps between items, never inside an item.

## Pages

### Landing `/`

Sections in DOM order:

1. **Hero, split.** The grid is `minmax(0, 5fr) minmax(0, 6fr)` above 60rem and one column below. The title column comes first.
   - Release chip, mono: `relatinator 3.4 · MIT`.
   - H1: `Find related posts when your site builds.`
   - Lead: `relatinator scores your documents against each other with BM25 or TF-IDF. It runs in Node.js, the browser, and Cloudflare Workers, and its only dependency is a stemmer. astro-relatinator hooks it into Astro content collections, so a related posts list is one getRelated call.`
   - Install block: a small graphite card with two lines, `pnpm add relatinator` and `pnpm add astro-relatinator`, and a `Copy` button.
   - Actions: the primary button `Read the docs` to `/docs/relatinator/`, and the link `Try the demo →` to `/demo/`.
   - The live card, in the right column. The header row has the mono file name `related.ts`, a `<select>` labeled `Post` with the six playground posts, and a status chip. The body shows this code, highlighted, with the selected post id in the string:

     ```ts
     import { createModel } from "relatinator";

     const model = createModel(posts);
     model.findRelatedScored("science-books-space", { limit: 3 });
     ```

     Under a graphite hairline, the result shows the top three related posts as ranked rows: rank number, title, and score with two decimals. Each row also shows the top three shared terms from `explainRelated` as mono chips. The top row has an accent tick.
   - The server renders the first result at build time with `relatinator`, so the card works without JavaScript. The status chip then says `BUILD TIME`. In the browser, a script ranks again for the selected post, measures the time with `performance.now()`, and sets the chip to `IN YOUR BROWSER · 0.4 MS` with the real value. Do not invent a number.
   - The default post is `science-books-space`.
2. **What you get.** An asymmetric feature block, not three equal tiles. Left, wide: `See why a post ranked where it did` with its body text and a code card that shows an `explainRelated` call and its real output for two playground posts. Right, two stacked items with a hairline between them: `Works with Astro content collections` and `Topics from a fixed list`, each with its body text and a code sample of two or three lines. The titles and bodies are in `src/pages/index.astro` and went through the humanizer pass. Each title is an `h2`.
3. **How scoring works.** The one graphite band, full bleed. H2 `How scoring works`. An ordered list of four steps in a row above 60rem and stacked below: Tokenize, Weigh, Score, Rank. Each step has its number and name in mono and its sentence from the current page. The link `Read the full rules` goes to `/docs/relatinator/#how-scoring-works`.
4. **Compatibility.** H2 `Compatibility` and the existing seven-row table.
5. Footer.

### Demo `/demo/` (Workbench)

- Head: H1 `Try relatinator in your browser` and the existing lead. No eyebrow.
- Two tool sections, `Related posts` and `Topics from a fixed list`, each an `h2`.
- Each tool is a panel with a hairline border and `--radius-card`. Above 60rem, the panel has two columns: controls left (`minmax(0, 2fr)`) and the ranked output right (`minmax(0, 3fr)`). Below 60rem, the output follows the controls.
- The code sample for each tool sits under its panel as a graphite card.
- Ranked output rows: rank number in mono, title, and score right-aligned with tabular numbers. The top row has a 2px accent tick on the left. The `Why` button is a small control button. Shared terms show as mono chips with their scores.
- Keep every element id, label, `aria-*` attribute, and class that `src/scripts/demo.ts` and `e2e/demo.spec.ts` use. The class names `top`, `demo-score`, `demo-empty`, and `btn-secondary` stay.

### Docs `/docs/*`

- Above 75rem: a 15rem sidebar, a prose column of up to 46rem, and a 13rem table of contents. Between 60rem and 75rem: the sidebar and the prose only. Below 60rem: the sidebar becomes a `<details>` block above the prose.
- The sidebar has a hairline right border. Links are `--text-sm`. The current page has `aria-current="page"`, ink text, and a 2px accent bar on the left.
- The table of contents has the mono label `On this page`, muted links, and an indent for `h3`.
- Prose: `h2` gets a hairline top border and `--space-xl` space above. Headings have `scroll-margin-top` that clears the sticky header.
- No reveal motion on docs pages.

## CTA voice

- One primary button per page, and it names its destination: `Read the docs`.
- Secondary actions are text links with an arrow.
- Never use "click here", "get started", or "learn more".

## Copy rules

- Keep existing copy where it already exists on the site. Do not invent metrics, users, or quotes.
- Numbers on the page come from real runs of `relatinator` on the playground posts.
- Never use: seamless, robust, cutting-edge, leverage, unlock, supercharge, blazing.

## What pages must share

- The header, footer, command palette, and theme toggle.
- The tokens, the three fonts, and the code card style.
- The CTA voice and the focus ring.

## What pages may differ on

- The macrostructure within the family above.
- Reveal motion: the landing page only.
- The graphite band: the landing page only, once.
