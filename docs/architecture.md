# Relatinator architecture

This document is for maintainers. It gives the reasons for the 3.x design, the checks behind the claims in the READMEs, and the known gaps. For the API, read the package READMEs:

- [`relatinator`](../packages/relatinator/README.md)
- [`astro-relatinator`](../packages/astro-relatinator/README.md)
- [`playground`](../packages/playground/README.md)

## Packages and modules

`relatinator` is the scoring library. It has no framework code.

| File                           | Contents                                                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                 | The public types. It exports `createModel()` and `tokenize()`.                                                              |
| `src/tokenize.ts`              | `tokenize()`. It removes elisions, splits words, removes stopwords, and stems each word. It keeps a cache of stems.         |
| `src/stopwords.ts`             | The English stopword list.                                                                                                  |
| `src/model.ts`                 | `createModel()`. It indexes the documents, weighs the terms, and ranks the results.                                         |
| `scripts/check-portability.js` | The portability check. [Automated checks](#automated-checks) describes it.                                                  |
| `bench/bench.mjs`              | The benchmark. [Automated checks](#automated-checks) describes it.                                                          |
| `bench/corpus.js`              | The synthetic posts of the benchmarks and of `test/equivalence.test.ts`. The same size and seed always give the same posts. |

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
| `bench/bench.mjs`      | The benchmark of both helpers. [Automated checks](#automated-checks) describes it.                                              |
| `bench/hooks.mjs`      | A module hook for the benchmark. It loads `bench/store.mjs` in place of `emdash` and `astro:content`.                           |
| `bench/store.mjs`      | The in-memory collections of the benchmark.                                                                                     |

## Design decisions

### Each model is a value, not global state

In version 2.x, the integration trained one model in the Astro config process. It used the `astro:build:setup` and `astro:server:setup` hooks. The library kept the model on `globalThis`, and pages read it from there.

This design works only when pages render in the same JavaScript runtime as the Astro config. In Astro 6 and 7, pages can render in a different runtime. For example, the Cloudflare adapter prerenders pages in workerd. A page in workerd cannot read a value that the config process put on `globalThis`.

In version 3.0, `createModel()` returns a model value. `relatinator` keeps no global state. Since version 3.1, its only mutable module state is the stem cache in `src/tokenize.ts`. This cache does not change an output. [Performance without output changes](#performance-without-output-changes) describes it. `astro-relatinator` builds the model on the first call, in the runtime that renders the page. Its only mutable module state is the model cache in `src/model-cache.ts`.

### Own scoring code with one runtime dependency

Version 2.x used `natural` for TF-IDF, and `wink-nlp` with the `wink-eng-lite-web-model` language model for BM25. A bundle of these packages was 3.98 MB. On Astro 5.3, the 2.x playground build failed with `Maximum call stack size exceeded`.

Version 3.0 has its own tokenizer and its own TF-IDF and BM25 code. The only runtime dependency is `wink-porter2-stemmer`. `src/stopwords.ts` is a copy of the English stopword list of `wink-nlp-utils` 2.1.0. The copy leaves out the entries with an apostrophe. These entries can never match a token, because `tokenize()` splits words at apostrophes.

The minified bundle of `dist/index.js` is 8.6 KB and has no imports. It does not import Node.js modules, so it runs in browsers and in Workers. The portability check enforces this.

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

Both helpers call `relatedIndex()` in `src/related-index.ts`. `relatedIndex()` gets the model from `getCachedModel()` in `src/model-cache.ts`. The cache keeps one model for each key, with the fingerprint of the entries of that model. When the fingerprint for a key changes, the cache builds a new model and replaces the old one.

The cache key has three parts:

1. The corpus key. For Astro, this is the collection name. For EmDash, it is `emdash` and the collection name. Thus an Astro collection and an EmDash collection with the same name get different models.
2. The `method`.
3. The text source. This is the `fields` array as JSON, or the source code of the `text` function.

The fingerprint is a list of strings. It contains the id and then the version of each entry, in collection order. `getCachedModel()` compares the new list with the stored list, one item at a time. If the lengths are different or one item is different, the fingerprint changed. The version depends on the helper and the options:

| Call                                      | Version of an entry                               |
| ----------------------------------------- | ------------------------------------------------- |
| `getRelated()`, the entry has a `digest`  | The `digest`                                      |
| `getRelated()`, the entry has no `digest` | The default text of the entry                     |
| `getRelated()` with `text`                | The text that `text` returns                      |
| `getEmDashRelated()`                      | The default text, or the text that `text` returns |

With `text`, the version is the text that `text` returns. The cache key holds only the source code of `text`. Two closures with the same source code can return different text. The returned text tells them apart.

`getEmDashRelated()` always uses the text as the version. EmDash does not change `updatedAt` when only the terms or the bylines of an entry change. The text changes when a term label changes, so the model stays current.

Versions 3.0.0 and 3.0.1 joined the fingerprint into one string. They put U+0000 between an id and its version, and U+0001 between two entries. When an id or a text contained one of these characters, two different collections could give the same string. The cache then kept a model that was out of date. The item-by-item compare uses no separator. Two fingerprints are equal only when each id and each version are equal.

The cache never removes a key. Each set of options that a site uses keeps one model for the life of the process or isolate.

### EmDash support is a site helper, not a plugin

EmDash runs sandboxed plugins with default limits of 50 ms CPU time and 10 subrequests for each invocation. The `ResourceLimits` type in `emdash/src/plugins/sandbox/types.ts` (emdash 1.2.0) documents these defaults. A related-content model must read the whole collection, and that work does not fit these limits. Also, a theme cannot read the storage of a plugin directly.

`getEmDashRelated()` runs in the pages of the site. There it reads the collection with `getEmDashCollection()`, which works on every runtime that EmDash supports.

`getEmDashRelated()` reads published entries in pages of 100. It follows `nextCursor` until EmDash returns no cursor. It does not use `hasMore`, because emdash 1.0.0 does not return it. emdash 1.0.1 added the `hasMore` field.

The default text leaves out the keys that EmDash adds to `entry.data`. `SYSTEM_KEYS` in `src/emdash-text.ts` is the list. The comment above `SYSTEM_KEYS` names the emdash 1.2.0 source files that the list comes from. From `terms`, the default text reads only the `label` of each term. [EmDash options](../packages/astro-relatinator/README.md#emdash-options) in the README shows the list to users.

Without this rule, the text contains the bylines and the ids, and posts by the same author look related. In the manual EmDash check, before this rule, the related list of the black-holes post showed the sourdough post.

`getEmDashRelated()` returns entries from the corpus, not the entry that the page gives. Its type parameter `D` is the type of `data` in the published entries, and the result type is `EmDashEntry<D>[]`. The entry parameter is `string | EmDashEntry<D> | EmDashEntry<Partial<D>>`. With `EmDashEntry<Partial<D>>`, a page can give only some of the keys of `D`. The `EmDashEntry<D>` member accepts no other values, but it changes inference. When TypeScript gets `D` only through `Partial<D>`, it removes the `?` modifier from each key. The `text` option gets `EmDashEntry<Partial<D>>`, because it also reads the entry object of the page. Version 3.0.0 used the type of the entry object as the result type.

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

### Performance without output changes

Version 3.1 makes both libraries faster without a change to their outputs. The rule is strict. For each input and each option, `relatinator` 3.1 must give the same output as 3.0.0. The ids, their order, the scores, and the errors must be the same. Two differences are known. Both are for invalid `method` values, which TypeScript rejects. For the 9 names of `Object.prototype` methods, such as `"constructor"`, `createModel()` now throws the same `TypeError` as for each other invalid value. Version 3.0.0 returned a model, and a query that weighed a term threw `TypeError: weight is not a function`. For `"__defineGetter__"` and `"__defineSetter__"`, `createModel()` throws a `TypeError` with a different message. The [3.1.0 changelog](../packages/relatinator/CHANGELOG.md#310---2026-10-16) describes both differences.

`src/model.ts` keeps the weights in an inverted index:

- `indexCorpus()` gives each term a number, in the order of its first occurrence. Each document keeps its terms as these numbers, with the count of each term.
- `buildPostings()` puts the documents of all terms in one `Int32Array` and their weights in one `Float64Array`. The `offsets` array gives the slots of each term. The function calculates each TF-IDF or BM25 weight one time, with the 3.0.0 formula.
- A query reads only the slots of its terms. It multiplies each weight by the count of the term in the query. Version 3.0.0 calculated the weight of each query term for each document. Each document adds its terms in query order, as in 3.0.0. Thus the floating-point totals are the same.
- For an integer `limit` from 0 to 64, `topIndices()` keeps a sorted list of the best `limit` documents. A new document goes after the documents with an equal score. Thus equal scores keep the input order, as the stable sort of 3.0.0 does. Each insert costs time in proportion to `limit`, so larger limits use the 3.0.0 sort. Two `Infinity` scores are equal in both paths. The sort comparator gives `NaN` for them, and the sort uses `+0` for a `NaN` result.

`src/tokenize.ts` stems each word one time:

- `tokenOf()` keeps the stem of each word in a module-level `Map`. A word that occurs again does not go through the stemmer again. The map holds at most 100,000 words, and `tokenOf()` clears it when it is full. The limit counts the words, not the bytes. In a measurement during the 3.1 work, each word used about 110 to 120 bytes, so a full map used about 14 MB. This value is typical, not a maximum. Very long words use more memory.
- The keys of the map are copies of the words. A slice of a long text can keep the whole text in memory, but a copy does not.
- `tokenize()` reads the text one code point at a time. ASCII letters and digits do not need a regular expression. Other code points use a regular expression with the `\p{L}` and `\p{N}` classes, as in 3.0.0.

`astro-relatinator` makes less temporary data on each call:

- `getCachedModel()` compares the fingerprint item by item. [One cached model for each key](#one-cached-model-for-each-key) describes the compare. Versions 3.0.0 and 3.0.1 joined the fingerprint into one string on each call. In the benchmark with 1,005 EmDash posts, this string had 9.7 million characters, or about 19 MB.
- `portableTextToPlainText()` adds the text of each span and each block to one string. The default EmDash text copies the content keys and the term labels directly. Version 3.0.1 made temporary arrays in these steps.

Three checks enforce the rule:

1. `test/equivalence.test.ts` compares the outputs of `src` with `relatinator-reference`. This development dependency is `relatinator` 3.0.0 from npm (`npm:relatinator@3.0.0`). The test compares with `isDeepStrictEqual()`, so each score must be the same number. [Automated checks](#automated-checks) describes the inputs.
2. The `relatinator` benchmark makes a checksum of the outputs of each run. Its last line tells if the checksums of 3.1 and 3.0.0 agree.
3. Checks that ran one time during the 3.1 work compared more inputs. [Manual checks during the 3.1 work](#manual-checks-during-the-31-work) lists them.

After these changes, `tokenize()` takes most of the build time. In the benchmark on 2026-10-16, `tokenize()` for 1,005 posts took 0.29 s, and `createModel()` took 0.34 s. Thus a faster build needs a faster `tokenize()`.

## Verification

This section lists the checks behind the claims in the READMEs. There are two types of checks:

- Automated checks are scripts in this repository. No CI runs them. Run them by hand before a release.
- Manual checks ran one time, during the 3.0 work on 2026-10-15 and during the 3.1 work on 2026-10-16. The repository has no scripts for them. The procedures below repeat the consumer builds, the Cloudflare check, and the EmDash check. The negative control, the 2.x baseline, and the 3.1 checks have no written procedure.

### Automated checks

Run these commands from the repository root. The results are from 2026-10-16, with Node.js 24.13.1 and pnpm 11.24.0.

| Command                                                    | What it checks                                                                                                                                                                                                                                                                                                                                                   | Result on 2026-10-16                                                                                                                                                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                                                | Runs the Vitest tests. `relatinator` tests the tokenizer, the weights, the ranking, fixture posts, and the equivalence with 3.0.0. `astro-relatinator` tests both helpers, the text rules, the cache, and the types of `getEmDashRelated()`.                                                                                                                     | 125 tests in `relatinator` and 50 in `astro-relatinator`.                                                                                                                                                           |
| `pnpm --filter relatinator test equivalence`               | Runs only `test/equivalence.test.ts`. It compares the results, the scores, the tie order, and the errors of `src` with `relatinator` 3.0.0. The inputs are synthetic corpora, the fixture posts, the playground posts, seven option sets, `limit` values next to 64, odd `limit` values, more than 100,000 different words, and strings with Unicode edge cases. | 63 tests.                                                                                                                                                                                                           |
| `pnpm check`                                               | `tsc` checks the source and the tests of both libraries. `astro check` checks the playground.                                                                                                                                                                                                                                                                    | No errors. `astro check` reports 0 errors.                                                                                                                                                                          |
| `pnpm --filter relatinator test:portability`               | Builds `relatinator` and bundles `dist/index.js` for the `neutral` platform with esbuild. It fails if the bundle keeps an import or is larger than 60 KB.                                                                                                                                                                                                        | 8787 bytes (8.6 KB), no imports.                                                                                                                                                                                    |
| `pnpm build`                                               | Builds both libraries and the playground.                                                                                                                                                                                                                                                                                                                        | The playground has 7 pages.                                                                                                                                                                                         |
| `pnpm -r --if-present run format:check`                    | Runs Prettier in both libraries.                                                                                                                                                                                                                                                                                                                                 | No changes. Each package prints one deprecation warning.                                                                                                                                                            |
| `pnpm --filter relatinator bench --impl both --sizes 1005` | Builds `relatinator`. Then it times the model build, the queries, and `tokenize()` of 3.1 and 3.0.0 on 1,005 synthetic posts, in 5 runs. Each run starts a new Node.js process. The last line tells if the output checksums of all runs agree.                                                                                                                   | The checksums agree, and no call failed. The [3.1.0 changelog](../packages/relatinator/CHANGELOG.md#310---2026-10-16) gives the times.                                                                              |
| `pnpm --filter astro-relatinator bench`                    | Builds both libraries. Then it calls `getEmDashRelated()` and `getRelated()` on 1,005 synthetic posts in memory, in 5 runs. It times the first call, the later calls, and the text of all entries. `--dist` sets the directory of the helpers. The changelog tells how to time 3.0.1.                                                                            | No call failed. Each helper gave one checksum in all runs. The published 3.0.1 package gave the same checksums. The [3.1.0 changelog](../packages/astro-relatinator/CHANGELOG.md#310---2026-10-16) gives the times. |

The benchmark times depend on the machine and its load. For the results above, `taskset -c 3` kept each benchmark on one CPU core.

All 175 tests pass. The type assertions in `test/emdash-types.test.ts` have an effect only in `pnpm check`, because Vitest does not check types. The `astro-relatinator` tests do not load Astro or EmDash. `vitest.config.ts` replaces `astro:content` with `test/astro-content.ts` and `emdash` with `test/emdash.ts`. These stubs return the entries that each test sets. The workspace sets `autoInstallPeers: false`, so pnpm does not install the optional `emdash` peer.

### Playground related lists

The playground is the manual check for changes that affect Astro. Run `pnpm build`. Then compare the related lists in the build output with the [expected related lists](../packages/playground/README.md#expected-related-lists). The playground README has a command that prints the lists. On 2026-10-16, all six lists matched.

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

1. In `packages/relatinator` and in `packages/astro-relatinator`, run `pnpm pack`. The `prepack` script builds each package. `pnpm pack` changes `workspace:^` to the version range of `relatinator`, for example `^3.1.0`.
2. Make a new Astro project outside the workspace. Use `astro` 7.3.8 for the first build and 6.4.8 for the second build.
3. Install the two tarballs with one command, for example `npm install ./relatinator-3.1.0.tgz ./astro-relatinator-3.1.0.tgz`. With npm, the local `relatinator` tarball satisfies the `^3.1.0` dependency of `astro-relatinator`. pnpm does not use the local tarball for this dependency. With pnpm, add an `overrides` entry for `relatinator` that points to the tarball.
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

### Manual checks during the 3.1 work

These checks compared version 3.1 with `relatinator` 3.0.0 and `astro-relatinator` 3.0.1. They ran on 2026-10-16.

| Check                                                                                                                                                                                                                                                                                                             | Result                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Real and generated posts. The check compares `findRelated()` with `limit` 5 and 50, `getTopTerms()`, and `tokenize()`. The corpora are the 37 published posts of a real EmDash blog and two generated corpora of 205 and 1,005 posts. The check also compares the default EmDash text of the 37 posts with 3.0.1. | 0 differences in 5,025 comparisons.                  |
| Extreme options. The BM25 options include `k1` and `b` values such as `0`, negative values, `1e308`, `Infinity`, and `NaN`. The `limit` values are each integer from 0 to 70 and odd values such as `-0`, `0.5`, `NaN`, and `"3"`.                                                                                | 0 differences in 40,180 comparisons.                 |
| Score bits. The check compares the internal total of each document in `findRelated()` and `findRelatedToText()` queries, bit for bit.                                                                                                                                                                             | 0 differences in 232,250 totals.                     |
| Tokenizer. The check compares `tokenize()` on 1,000,000 random strings with Unicode edge cases. A second run tests each Unicode code point in three positions next to word characters.                                                                                                                            | 0 differences in 1,000,000 and in 3,342,336 strings. |
| Text. The inputs are random EmDash and Astro entries, also entries with odd shapes. The check compares the outputs and the errors of the text functions with 3.0.1.                                                                                                                                               | 0 differences in 1,000,000 comparisons.              |
| Cache. The check makes 40,000 random changes to a collection. One half of the run also uses ids and texts with U+0000 and U+0001. The check compares each decision to build a new model with 3.0.1.                                                                                                               | 0 differences.                                       |

## Known gaps and follow-ups

These items were open on 2026-10-16.

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
- **`limit` in the shared options.** `RelatedOptions` contains `limit`, but `relatedIndex()` does not read it. `getRelated()` and `getEmDashRelated()` give `limit` to the model.
- **Preview of a published entry.** A preview of a published entry has the id of the published entry. `getEmDashRelated()` ranks it by the published text, not by the preview text. Thus the related list does not show the effect of unpublished edits.
- **Draft with a new slug.** If a draft revision changes the slug of a published entry, the draft id is not in the model. `getEmDashRelated()` then queries with the draft text and excludes only the new id. The published version of the same entry can then be in the results. This item comes from a code reading of `src/emdash.ts` and the emdash 1.2.0 `loader.ts`. No test or manual check covers it.
- **Warm EmDash calls.** Each `getEmDashRelated()` call makes the text of every entry, because the cache uses the text as the version. The freshness rule needs this text, so a call with a cached model cannot skip it. This text takes most of the time of such a call. The [3.1.0 changelog](../packages/astro-relatinator/CHANGELOG.md#310---2026-10-16) gives the times.
- **Benchmark data.** Both benchmarks use the synthetic posts of `bench/corpus.js`. The helper benchmark reads in-memory collections, not a database, and it does not run Astro. Thus its times do not include a database read or a page render.
- **3.0 manual checks on the 3.1 code.** The consumer builds, the Cloudflare check, and the EmDash check ran on the 3.0 code. They did not run on the 3.1 code.
- **Native EmDash plugins.** How a page can read the data of a native EmDash plugin is an open question upstream. Until EmDash answers it, the site helper is the supported design.
