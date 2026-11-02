# Relatinator

Relatinator finds related posts for your site. It scores your documents against each other with BM25 or TF-IDF. You do not need a search service or an embedding model. This repository holds four packages:

| Package                                                     | What it does                                                                                                                                                        |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`relatinator`](packages/relatinator/README.md)             | The ranking library. It scores documents with BM25 (the default) or TF-IDF and runs in Node.js, browsers, and Cloudflare Workers. Its only dependency is a stemmer. |
| [`astro-relatinator`](packages/astro-relatinator/README.md) | `getRelated()` finds related entries in an Astro content collection. `getEmDashRelated()` from `astro-relatinator/emdash` does the same for EmDash sites.           |
| [`playground`](packages/playground/README.md)               | A private Astro site with six posts. Use it to check a change by hand.                                                                                              |
| [`site`](packages/site/README.md)                           | The source of relatinator.darko.io: the landing page, the demo, and the docs. The `Dockerfile` at the repository root builds it and serves it with nginx.           |

Version 3.0 changed the API of both libraries. If you upgrade from 2.x, read the "Migrating from 2.x" section in each library README. [docs/architecture.md](docs/architecture.md) has the design decisions, the checks behind them, and the known gaps.

---

## Compatibility

| Target        | `relatinator`                    | `astro-relatinator`                                  |
| ------------- | -------------------------------- | ---------------------------------------------------- |
| Node.js       | 22.12 or later                   | 22.12 or later                                       |
| Browsers      | Yes                              | No, it runs at build time or on the server           |
| Cloudflare    | Workers                          | The Cloudflare adapter, with prerendering in workerd |
| Astro         | Not needed                       | 6 and 7                                              |
| Astro output  | Not needed                       | Static output and on-demand rendering                |
| EmDash        | Not needed                       | 1.x (1.0 or later), as an optional peer dependency   |
| Module format | ES modules only, with type files | ES modules only, with type files                     |

Automated checks in this repository cover some rows. A one-time manual check during the 3.0 work covers the others. [Verification](docs/architecture.md#verification) lists the check for each row. Nothing tests the oldest version in each range yet. [Known gaps and follow-ups](docs/architecture.md#known-gaps-and-follow-ups) tracks that.

---

## Development

This repository is a pnpm workspace. You need Node.js 22.12 or later and pnpm. The last check of the commands below was on 2026-10-16, with Node.js 24.13.1 and pnpm 11.24.0.

Run these commands from the repository root:

| Command                                 | What it runs                                                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                          | Installs the dependencies of every package.                                                                                       |
| `pnpm build`                            | Runs `tsc` for `relatinator` and `astro-relatinator`, and `astro build` for the playground and the site.                          |
| `pnpm test`                             | Runs the Vitest tests of `relatinator` and `astro-relatinator` and the Playwright tests of the site. The playground has no tests. |
| `pnpm check`                            | Type-checks both libraries and their tests with `tsc`. Then it runs `astro check` in the playground and the site.                 |
| `pnpm -r --if-present run format:check` | Runs `prettier --check` in `relatinator` and `astro-relatinator`. The root `package.json` has no `format:check` script.           |
| `pnpm -r --if-present run format`       | Runs `prettier --write` in the same two packages.                                                                                 |

In a new clone, `pnpm test` and `pnpm check` work without `pnpm build` first. The `astro-relatinator` tests, the playground, and the site import the built `dist` output of their workspace dependencies. Their `pretest` and `precheck` scripts build it. The `relatinator` tests import `src` directly.

All packages pin TypeScript 6.0.3. Do not upgrade to TypeScript 7. [TypeScript 6.0.3 in every package](docs/architecture.md#typescript-603-in-every-package) explains why.

To try a change in a real Astro site, use the playground. Its README lists the [expected related lists](packages/playground/README.md#expected-related-lists).

---

## Repository layout

```text
.
├── Dockerfile                 Builds the site and serves it with nginx
├── docs/
│   └── architecture.md        Design decisions, verification, and known gaps
└── packages/
    ├── relatinator/           The scoring library (npm package relatinator)
    │   ├── src/               Tokenizer, model, and public types
    │   ├── test/              Vitest tests and Markdown fixtures
    │   └── scripts/           The portability check
    ├── astro-relatinator/     The Astro and EmDash helpers (npm package astro-relatinator)
    │   ├── src/               getRelated(), getEmDashRelated(), model cache, integration
    │   ├── test/              Vitest tests and stubs for astro:content and emdash
    │   └── scripts/           The bundle step and the check of the sandbox entry
    ├── playground/            A private Astro 7 site with six posts
    └── site/                  The relatinator.darko.io site, with Playwright tests in e2e/
```

---

## Acknowledgment

If relatinator saves you some work, star the GitHub repository. It helps other people find the project.
