# Relatinator architecture

This document is for maintainers. It gives the reasons for the 3.0 design, the checks behind the claims in the READMEs, and the known gaps. For the API, read the package READMEs:

- [`relatinator`](../packages/relatinator/README.md)
- [`astro-relatinator`](../packages/astro-relatinator/README.md)
- [`playground`](../packages/playground/README.md)

## Packages and modules

`relatinator` is the scoring library. It has no framework code.

| File                           | Contents                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/index.ts`                 | The public types. It exports `createModel()` and `tokenize()`.                           |
| `src/tokenize.ts`              | `tokenize()`. It removes elisions, splits words, removes stopwords, and stems each word. |
| `src/stopwords.ts`             | The English stopword list.                                                               |
| `src/model.ts`                 | `createModel()`. It indexes the documents, weighs the terms, and ranks the results.      |
| `scripts/check-portability.js` | The portability check. [Automated checks](#automated-checks) describes it.               |

`astro-relatinator` reads entries, makes the text of each entry, and gives the text to `relatinator`.

| File                   | Contents                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/get-related.ts`   | `getRelated()` for Astro content collections.                                                                                   |
| `src/emdash.ts`        | `getEmDashRelated()` for EmDash collections. This file is the `astro-relatinator/emdash` entry point.                           |
| `src/related-index.ts` | `relatedIndex()`, which both helpers call. It makes the cache key and the fingerprint, gets the model, and maps ids to entries. |
| `src/model-cache.ts`   | `getCachedModel()`. It keeps one model for each cache key.                                                                      |
| `src/entry-text.ts`    | The default text of an Astro entry, and the `ContentEntry` type.                                                                |
| `src/emdash-text.ts`   | The default text of an EmDash entry.                                                                                            |
| `src/portable-text.ts` | `portableTextToPlainText()`.                                                                                                    |
| `src/integration.ts`   | The optional Astro integration. It only warns about 2.x options.                                                                |

## Design decisions

### Each model is a value, not global state

In version 2.x, the integration trained one model in the Astro config process. It used the `astro:build:setup` and `astro:server:setup` hooks. The library kept the model on `globalThis`, and pages read it from there.

This design works only when pages render in the same JavaScript runtime as the Astro config. In Astro 6 and 7, pages can render in a different runtime. For example, the Cloudflare adapter prerenders pages in workerd. A page in workerd cannot read a value that the config process put on `globalThis`.

In version 3.0, `createModel()` returns a model value. `relatinator` keeps no mutable module state and no global state. `astro-relatinator` builds the model on the first call, in the runtime that renders the page. Its only mutable module state is the model cache in `src/model-cache.ts`.

### Own scoring code with one runtime dependency

Version 2.x used `natural` for TF-IDF, and `wink-nlp` with the `wink-eng-lite-web-model` language model for BM25. A bundle of these packages was 3.98 MB. On Astro 5.3, the 2.x playground build failed with `Maximum call stack size exceeded`.

Version 3.0 has its own tokenizer and its own TF-IDF and BM25 code. The only runtime dependency is `wink-porter2-stemmer`. `src/stopwords.ts` is a copy of the English stopword list of `wink-nlp-utils` 2.1.0. The copy leaves out the entries with an apostrophe. These entries can never match a token, because `tokenize()` splits words at apostrophes.

The minified bundle of `dist/index.js` is 7.1 KB and has no imports. It does not import Node.js modules, so it runs in browsers and in Workers. The portability check enforces this.

The tokenizer steps, the formulas, and the ranking rules have one home, [How scoring works](../packages/relatinator/README.md#how-scoring-works) in the `relatinator` README. `test/model.test.ts` compares the weights with hand-computed values. `test/fixtures.test.ts` checks that the TF-IDF top terms of a fixture post are the same as in 2.x.

### Entry ids, not titles

Version 2.x read the Markdown files itself and used the `title` frontmatter field as the document id. The 2.x README and the 2.x playground queried the model with `entry.id`. They also matched the results against `post.id`. An entry id is not a title, so these lookups found no entries.

Version 3.0 uses `entry.id` for the documents, the queries, and the results. `getRelated()` returns entries, not ids, so a page does no lookup.

### Read the collection at render time

`getRelated()` calls `getCollection()` each time that a page calls it. There is no build hook and no file watcher. In `astro dev`, an edit to a content file changes the `digest` of the entry. The next call then builds a new model.

`getRelated()` imports `astro:content` inside the function, not at the top of the module. The Astro config imports the package to get the integration, and `astro:content` does not exist at that time. A top-level import would make the config fail. `src/emdash.ts` imports `emdash` inside the function for the same reason.

### The integration is optional

Only Vite can resolve `astro:content`. Vite resolves it in the packages that it processes, but not in the packages that Node.js loads directly.

Astro 7.3.8 selects the packages for Vite with `crawlFrameworkPkgs()` from `vitefu`. The `isFrameworkPkgByJson` callback in `astro/dist/core/create-vite.js` selects a package if one of these conditions is true:

- The package has `astro` in `peerDependencies` or in `dependencies`.
- Its `keywords` contain `astro` or `astro-component`.
- Its name starts with `astro-`.

The callback skips a package that sets `"astro": { "external": true }` in its `package.json`.

`astro-relatinator` meets all three conditions. Thus Vite processes it in every Astro project, with or without the integration in the config. One condition is enough, but keep all three in `package.json`.

A negative control during the 3.0 work showed the failure. With the package marked external, the build failed with `ERR_UNSUPPORTED_ESM_URL_SCHEME ... 'astro:'`.

The integration now only logs a warning when it gets 2.x options. `npx astro add astro-relatinator` still adds the integration to the config. Users can keep it or remove it.

### One cached model for each key

Both helpers call `relatedIndex()` in `src/related-index.ts`. `relatedIndex()` gets the model from `getCachedModel()` in `src/model-cache.ts`. The cache keeps one model for each key. When the fingerprint for a key changes, the cache builds a new model and replaces the old one.

The cache key has three parts:

1. The corpus key. For Astro, this is the collection name. For EmDash, it is `emdash` and the collection name. Thus an Astro collection and an EmDash collection with the same name get different models.
2. The `method`.
3. The text source. This is the `fields` array as JSON, or the source code of the `text` function.

The fingerprint contains the id and the version of each entry, in collection order. The version depends on the helper and the options:

| Call                                      | Version of an entry                               |
| ----------------------------------------- | ------------------------------------------------- |
| `getRelated()`, the entry has a `digest`  | The `digest`                                      |
| `getRelated()`, the entry has no `digest` | The default text of the entry                     |
| `getRelated()` with `text`                | The text that `text` returns                      |
| `getEmDashRelated()`                      | The default text, or the text that `text` returns |

With `text`, the version is the text that `text` returns. The cache key holds only the source code of `text`. Two closures with the same source code can return different text. The returned text tells them apart.

`getEmDashRelated()` always uses the text as the version. EmDash does not change `updatedAt` when only the terms or the bylines of an entry change. The text changes when a term label changes, so the model stays current.

The cache never removes a key. Each set of options that a site uses keeps one model for the life of the process or isolate.

### EmDash support is a site helper, not a plugin

EmDash runs sandboxed plugins with default limits of 50 ms CPU time and 10 subrequests for each invocation. The `ResourceLimits` type in `emdash/src/plugins/sandbox/types.ts` (emdash 1.2.0) documents these defaults. A related-content model must read the whole collection, and that work does not fit these limits. Also, a theme cannot read the storage of a plugin directly.

`getEmDashRelated()` runs in the pages of the site. There it reads the collection with `getEmDashCollection()`, which works on every runtime that EmDash supports.

`getEmDashRelated()` reads published entries in pages of 100. It follows `nextCursor` until EmDash returns no cursor. It does not use `hasMore`, because emdash 1.0.0 does not return it. emdash 1.0.1 added the `hasMore` field.

The default text leaves out the keys that EmDash adds to `entry.data`. `SYSTEM_KEYS` in `src/emdash-text.ts` is the list. The comment above `SYSTEM_KEYS` names the emdash 1.2.0 source files that the list comes from. From `terms`, the default text reads only the `label` of each term. [EmDash options](../packages/astro-relatinator/README.md#emdash-options) in the README shows the list to users.

Without this rule, the text contains the bylines and the ids, and posts by the same author look related. In the manual EmDash check, before this rule, the related list of the black-holes post showed the sourdough post.

The model contains only published entries. `rank()` in `src/emdash.ts` selects the query by the entry id. EmDash uses the slug as the entry id, with a locale prefix when i18n routing adds one. `entryIdForRow()` in the emdash 1.2.0 `loader.ts` makes this id. A draft or preview revision takes its id from the revision slug, if the revision has one.

- If the id is in the model, `rank()` calls `findRelated(id)`. The query is the published text of that id. `rank()` does not read the text of the given object.
- Otherwise, if the page gave an entry object, `rank()` calls `findRelatedToText()` with the text of the object. It excludes the id of the object.
- Otherwise, if the page gave a string, `getEmDashRelated()` throws an error.

### Compiled JavaScript and type declarations

Version 2.x of `astro-relatinator` published its TypeScript source, `integration.ts`. In version 3.0, both packages publish `dist/*.js` and `dist/*.d.ts` files that `tsc` makes. The `prepack` script runs the build, so `pnpm pack` and `pnpm publish` always include new output.

JavaScript loads in every runtime and tool without a TypeScript step. Node.js does not strip types from files in `node_modules`. Node.js 24.13.1 stops with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`. Also, the compiler options of a consumer do not apply to the source of the package.

`relatinator` 2.x used Vite library mode and `dts-bundle-generator`. Version 3.0 uses only `tsc`, which makes one output file for each source file.

### TypeScript 6.0.3 in every package

The playground runs `astro check` (`@astrojs/check` 0.9.10). `astro check` uses the TypeScript JavaScript API, and TypeScript 7 does not have this API. All packages pin `typescript` to 6.0.3, so one compiler version checks the whole workspace.

## Verification

This section lists the checks behind the claims in the READMEs. There are two types of checks:

- Automated checks are scripts in this repository. No CI runs them. Run them by hand before a release.
- Manual checks ran one time during the 3.0 work, on 2026-10-15. The repository has no scripts for them. The procedures below repeat the consumer builds, the Cloudflare check, and the EmDash check. The negative control and the 2.x baseline have no written procedure.

### Automated checks

Run these commands from the repository root. The results are from 2026-10-15, with Node.js 24.13.1 and pnpm 11.24.0.

| Command                                      | What it checks                                                                                                                                                                | Result on 2026-10-15                                     |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `pnpm test`                                  | Runs the Vitest tests. `relatinator` tests the tokenizer, the weights, the ranking, and fixture posts. `astro-relatinator` tests both helpers, the text rules, and the cache. | 36 tests in `relatinator` and 43 in `astro-relatinator`. |
| `pnpm check`                                 | `tsc` checks the source and the tests of both libraries. `astro check` checks the playground.                                                                                 | No errors. `astro check` reports 0 errors.               |
| `pnpm --filter relatinator test:portability` | Builds `relatinator` and bundles `dist/index.js` for the `neutral` platform with esbuild. It fails if the bundle keeps an import or is larger than 60 KB.                     | 7303 bytes (7.1 KB), no imports.                         |
| `pnpm build`                                 | Builds both libraries and the playground.                                                                                                                                     | The playground has 7 pages.                              |
| `pnpm -r --if-present run format:check`      | Runs Prettier in both libraries.                                                                                                                                              | No changes. Each package prints one deprecation warning. |

All 79 tests pass. The `astro-relatinator` tests do not load Astro or EmDash. `vitest.config.ts` replaces `astro:content` with `test/astro-content.ts` and `emdash` with `test/emdash.ts`. These stubs return the entries that each test sets. The workspace sets `autoInstallPeers: false`, so pnpm does not install the optional `emdash` peer.

### Playground related lists

The playground is the manual check for changes that affect Astro. Run `pnpm build`. Then compare the related lists in the build output with the [expected related lists](../packages/playground/README.md#expected-related-lists). The playground README has a command that prints the lists. On 2026-10-15, all six lists matched.

### Manual checks during the 3.0 work

These checks ran one time, on 2026-10-15.

| Check                                     | Result                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Consumer build on Astro 7.3.8             | The build passed. The pages showed the related lists.                                                   |
| Consumer build on Astro 6.4.8             | The build passed. The pages showed the related lists.                                                   |
| Cloudflare adapter 14.3.4 on Astro 7.3.8  | The build prerendered the pages in workerd. The pages showed the related lists.                         |
| EmDash 1.2.0 blog site                    | The related lists showed in `astro dev` and in the Node.js production build.                            |
| Negative control, package marked external | The build failed with `ERR_UNSUPPORTED_ESM_URL_SCHEME ... 'astro:'`.                                    |
| 2.x code at commit `c0067eb`              | The `natural` and wink bundle was 3.98 MB. The playground build on Astro 5.3 failed with a stack error. |

To repeat the consumer builds:

1. In `packages/relatinator` and in `packages/astro-relatinator`, run `pnpm pack`. The `prepack` script builds each package. `pnpm pack` changes `workspace:^` to `^3.0.0`.
2. Make a new Astro project outside the workspace. Use `astro` 7.3.8 for the first build and 6.4.8 for the second build.
3. Install the two tarballs with one command, for example `npm install ./relatinator-3.0.0.tgz ./astro-relatinator-3.0.0.tgz`. With npm, the local `relatinator` tarball satisfies the `^3.0.0` dependency of `astro-relatinator`. pnpm does not, because `relatinator` 3.0.0 is not on npm yet. With pnpm, add an `overrides` entry for `relatinator` that points to the tarball.
4. Add a content collection and a page that calls `getRelated()`. To compare with known results, copy the playground posts, `src/content.config.ts`, and `src/pages/posts/[id].astro`.
5. Run `astro build`. Make sure that each post page has a related list.

To repeat the Cloudflare check:

1. In the Astro 7.3.8 consumer project, add `@astrojs/cloudflare` 14.3.4 as the adapter.
2. Run `astro build`. The adapter prerenders the pages in workerd.
3. Make sure that each prerendered post page has a related list.

To repeat the EmDash check:

1. Run `npm create emdash@1.2.0 site -- --template node:blog`.
2. Install the two tarballs in the new site.
3. In the post page of the template, call `getEmDashRelated()` and show the result. The `astro-relatinator` README has an example.
4. Start `astro dev`. Open `/_emdash/api/setup/dev-bypass?redirect=/`. This route works only in development. It completes the setup and adds the sample content of the template seed.
5. Open the post pages. Make sure that each page has a related list.
6. Build the site for Node.js and start the built server. Open the post pages again.

## Known gaps and follow-ups

These items were open on 2026-10-15.

- **Astro 6 in the repository.** All workspace packages use Astro 7.3.8. Only the manual consumer build used Astro 6.4.8.
- **Lowest supported versions.** No check covers the lowest versions of the supported ranges. All checks ran on Node.js 24.13.1, not on Node.js 22.12. The Astro checks used 6.4.8 and 7.3.8, not 6.0 and 7.0. The EmDash check used 1.2.0, not 1.0. For emdash 1.0.0, only the result type of `getEmDashCollection()` was read.
- **On-demand pages with `getRelated()`.** No check renders `getRelated()` in an on-demand page. The EmDash check covers on-demand rendering only through `getEmDashRelated()`.
- **Browsers.** No test runs `relatinator` in a browser. The portability check shows only that the bundle has no imports.
- **CI.** The repository has no CI workflow. The automated checks run only when a maintainer runs them.
- **Changesets.** The root `package.json` has `@changesets/cli` and `@changesets/changelog-github` in `devDependencies`. The repository has no `.changeset` directory, so Changesets is not set up. Maintainers edit the changelogs by hand.
- **Lint.** Version 3.0 removed the ESLint and Stylelint configurations. No linter replaces them. Prettier and `tsc` are the only static checks.
- **Prettier configuration.** `.prettierrc` in both libraries sets `jsxBracketSameLine`, which Prettier 3 deprecates. Each Prettier run prints a warning.
- **Prettier coverage.** Only the two libraries have `format:check` scripts. The root README, `docs/`, and the playground have no Prettier check.
- **Double build in `pnpm check`.** The `precheck` script of `astro-relatinator` builds `relatinator`. Then the `precheck` script of the playground builds `relatinator` and `astro-relatinator` again.
- **`relatedIndex()` trusts its callers.** When `text` is set, `versionOf` must return the text that `text` returns. Both callers do this, but `relatedIndex()` does not enforce it.
- **Two meanings of `entries`.** In `src/related-index.ts`, `Corpus.entries` is an array of entries. `RelatedIndex.entries(ids)` is a function that maps ids to entries.
- **`ContentEntry` for EmDash.** `ContentEntry` in `src/entry-text.ts` is the type constraint of `getEmDashRelated()`. It has the optional fields `body` and `digest`, which only Astro entries have.
- **`limit` in the shared options.** `RelatedOptions` contains `limit`, but `relatedIndex()` does not read it. `getRelated()` and `getEmDashRelated()` give `limit` to the model.
- **Preview of a published entry.** A preview of a published entry has the id of the published entry. `getEmDashRelated()` ranks it by the published text, not by the preview text. Thus the related list does not show the effect of unpublished edits.
- **Draft with a new slug.** If a draft revision changes the slug of a published entry, the draft id is not in the model. `getEmDashRelated()` then queries with the draft text and excludes only the new id. The published version of the same entry can then be in the results. This item comes from a code reading of `src/emdash.ts` and the emdash 1.2.0 `loader.ts`. No test or manual check covers it.
- **Native EmDash plugins.** How a page can read the data of a native EmDash plugin is an open question upstream. Until EmDash answers it, the site helper is the supported design.
