# Relatinator meta

Relatinator finds related posts and other related content. This repository holds three packages:

| Package                                                     | What it does                                                                                                                                                                     |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`relatinator`](packages/relatinator/README.md)             | A small library that ranks documents by similarity with BM25 (default) or TF-IDF. It runs in Node.js, in browsers, and in Cloudflare Workers.                                    |
| [`astro-relatinator`](packages/astro-relatinator/README.md) | Finds related entries in Astro content collections with `getRelated()`. It also finds related entries on EmDash sites with `getEmDashRelated()` from `astro-relatinator/emdash`. |
| [`playground`](packages/playground/README.md)               | A private Astro site that uses `astro-relatinator`. Maintainers use it to check changes by hand.                                                                                 |

Version 3.0 changes the API of both libraries. Each library README has a "Migrating from 2.x" section. For the design decisions, the verification, and the known gaps, read [docs/architecture.md](docs/architecture.md).

---

## Compatibility

| Target        | `relatinator`                    | `astro-relatinator`                                     |
| ------------- | -------------------------------- | ------------------------------------------------------- |
| Node.js       | 22.12 or later                   | 22.12 or later                                          |
| Browsers      | Yes                              | Not applicable. It runs at build time or on the server. |
| Cloudflare    | Workers                          | The Cloudflare adapter, with prerendering in workerd    |
| Astro         | Not used                         | 6 and 7                                                 |
| Astro output  | Not used                         | Static output and on-demand rendering                   |
| EmDash        | Not used                         | 1.x (1.0 or later), as an optional peer dependency      |
| Module format | ES modules only, with type files | ES modules only, with type files                        |

Some rows have automated checks in this repository. Other rows had a one-time manual check during the 3.0 work. [Verification](docs/architecture.md#verification) tells which check covers each row. No check covers the lowest versions of the ranges. [Known gaps and follow-ups](docs/architecture.md#known-gaps-and-follow-ups) lists them.

---

## Development

This repository is a pnpm workspace. You need Node.js 22.12 or later and pnpm. The commands below work with Node.js 24.13.1 and pnpm 11.24.0, the versions of the last check on 2026-10-15.

Run these commands from the repository root:

| Command                                 | What it runs                                                                                                            |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `pnpm install`                          | Installs the dependencies of all packages.                                                                              |
| `pnpm build`                            | Compiles `relatinator` and `astro-relatinator` with `tsc`. Then it builds the playground with `astro build`.            |
| `pnpm test`                             | Runs the Vitest tests of `relatinator` and `astro-relatinator`. The playground has no tests.                            |
| `pnpm check`                            | Type-checks the source and the tests of both libraries with `tsc`. Then it runs `astro check` in the playground.        |
| `pnpm -r --if-present run format:check` | Runs `prettier --check` in `relatinator` and `astro-relatinator`. The root `package.json` has no `format:check` script. |
| `pnpm -r --if-present run format`       | Runs `prettier --write` in the same two packages.                                                                       |

`pnpm test` and `pnpm check` work in a new clone without `pnpm build` first. The `astro-relatinator` tests and the playground import the built `dist` output of their workspace dependencies. Their `pretest` and `precheck` scripts build these dependencies before the tests and the type checks start. The `relatinator` tests import `src` directly.

All packages pin TypeScript 6.0.3. Do not upgrade to TypeScript 7. [TypeScript 6.0.3 in every package](docs/architecture.md#typescript-603-in-every-package) gives the reason.

To test a change in a real Astro site, use the playground. Its README has the [expected related lists](packages/playground/README.md#expected-related-lists).

---

## Repository layout

```text
.
├── docs/
│   └── architecture.md        Design decisions, verification, and known gaps
└── packages/
    ├── relatinator/           The scoring library (npm package relatinator)
    │   ├── src/               Tokenizer, model, and public types
    │   ├── test/              Vitest tests and Markdown fixtures
    │   └── scripts/           The portability check
    ├── astro-relatinator/     The Astro and EmDash helpers (npm package astro-relatinator)
    │   ├── src/               getRelated(), getEmDashRelated(), model cache, integration
    │   └── test/              Vitest tests and stubs for astro:content and emdash
    └── playground/            A private Astro 7 site with six posts
```

---

## Acknowledgment

If this project helps you, give its GitHub repository a star.

Thank you.
