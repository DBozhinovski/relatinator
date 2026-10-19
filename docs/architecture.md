# Relatinator architecture

This document is for maintainers. It gives the reasons for the 3.x design, the checks behind the claims in the READMEs, and the known gaps. For the API, read the package READMEs:

- [`relatinator`](../packages/relatinator/README.md)
- [`astro-relatinator`](../packages/astro-relatinator/README.md)
- [`playground`](../packages/playground/README.md)

## Packages and modules

`relatinator` is the scoring library. It has no framework code.

| File                           | Contents                                                                                                                                                                            |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                 | The public types. It exports `createModel()`, `classify()`, and `tokenize()`.                                                                                                       |
| `src/tokenize.ts`              | `tokenize()`. It removes elisions, splits words, removes stopwords, and stems each word. It keeps a cache of stems.                                                                 |
| `src/stopwords.ts`             | The English stopword list.                                                                                                                                                          |
| `src/model.ts`                 | `createModel()`. It indexes the documents, weighs the terms, and ranks the results. `createScorer()` makes the index and scores queries. `createModel()` and `classify()` share it. |
| `src/classify.ts`              | `classify()`. It scores a text against a fixed topic list with `createScorer()`.                                                                                                    |
| `scripts/check-portability.js` | The portability check. [Automated checks](#automated-checks) describes it.                                                                                                          |
| `bench/bench.mjs`              | The benchmark. [Automated checks](#automated-checks) describes it.                                                                                                                  |
| `bench/corpus.js`              | The synthetic posts of the benchmarks and of `test/equivalence.test.ts`. The same size and seed always give the same posts.                                                         |

`astro-relatinator` reads entries, makes the text of each entry, and gives the text to `relatinator`.

| File                         | Contents                                                                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/get-related.ts`         | `getRelated()` for Astro content collections.                                                                                   |
| `src/emdash.ts`              | `getEmDashRelated()` for EmDash collections. This file is the `astro-relatinator/emdash` entry point.                           |
| `src/related-index.ts`       | `relatedIndex()`, which both helpers call. It makes the cache key and the fingerprint, gets the model, and maps ids to entries. |
| `src/model-cache.ts`         | `getCachedModel()`. It keeps one model for each cache key.                                                                      |
| `src/entry-text.ts`          | `entryText()`, the default text of an Astro entry, and the `ContentEntry` type. `src/index.ts` exports `entryText()`.           |
| `src/emdash-text.ts`         | `emdashEntryText()`, the default text of an EmDash entry. `src/emdash.ts` exports it.                                           |
| `src/portable-text.ts`       | `portableTextToPlainText()`.                                                                                                    |
| `src/emdash-topics.ts`       | `suggestTerms()` and `topicText()`. They score the terms of EmDash taxonomies with `classify()`. They do not import `emdash`.   |
| `src/emdash-plugin.ts`       | The plugin descriptor. This file is the `astro-relatinator/emdash-plugin` entry point.                                          |
| `src/emdash-plugin-entry.ts` | The route of the "Suggested topics" editor panel. This file is the `astro-relatinator/emdash-plugin/sandbox` entry point.       |
| `src/integration.ts`         | The optional Astro integration. It only warns about 2.x options.                                                                |
| `bench/bench.mjs`            | The benchmark of both helpers. [Automated checks](#automated-checks) describes it.                                              |
| `bench/hooks.mjs`            | A module hook for the benchmark. It loads `bench/store.mjs` in place of `emdash` and `astro:content`.                           |
| `bench/store.mjs`            | The in-memory collections of the benchmark.                                                                                     |

## Design decisions

### Each model is a value, not global state

In version 2.x, the integration trained one model in the Astro config process. It used the `astro:build:setup` and `astro:server:setup` hooks. The library kept the model on `globalThis`, and pages read it from there.

This design works only when pages render in the same JavaScript runtime as the Astro config. In Astro 6 and 7, pages can render in a different runtime. For example, the Cloudflare adapter prerenders pages in workerd. A page in workerd cannot read a value that the config process put on `globalThis`.

In version 3.0, `createModel()` returns a model value. `relatinator` keeps no global state. Since version 3.1, its only mutable module state is the stem cache in `src/tokenize.ts`. This cache does not change an output. [Performance without output changes](#performance-without-output-changes) describes it. `astro-relatinator` builds the model on the first call, in the runtime that renders the page. Its only mutable module state is the model cache in `src/model-cache.ts`.

### Own scoring code with one runtime dependency

Version 2.x used `natural` for TF-IDF, and `wink-nlp` with the `wink-eng-lite-web-model` language model for BM25. A bundle of these packages was 3.98 MB. On Astro 5.3, the 2.x playground build failed with `Maximum call stack size exceeded`.

Version 3.0 has its own tokenizer and its own TF-IDF and BM25 code. The only runtime dependency is `wink-porter2-stemmer`. `src/stopwords.ts` is a copy of the English stopword list of `wink-nlp-utils` 2.1.0. The copy leaves out the entries with an apostrophe. These entries can never match a token, because `tokenize()` splits words at apostrophes.

The minified bundle of `dist/index.js` is 9.3 KB and has no imports. It does not import Node.js modules, so it runs in browsers and in Workers. The portability check enforces this.

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

1. The corpus key. For Astro, this is the collection name. For EmDash, it is `emdash`, the collection name, and the locale. Thus an Astro collection and an EmDash collection with the same name get different models, and each EmDash locale gets its own model.
2. The `method`.
3. The text source. This is the `fields` array as JSON, or the source code of the `text` function.

The locale of the EmDash key is the `locale` option. Without the option, it is the locale of the EmDash request context, from `getRequestContext()`. `getEmDashCollection()` uses the same locale. The `resolveLocale()` function in emdash 1.3.1 `src/i18n/resolve.ts` selects an explicit locale first, then the locale of the request context, then the default locale when the site has more than one locale. The middleware in `src/astro/middleware/request-context.ts` puts the locale in the context only for a request with a preview token or the edit-mode cookie. Without a locale in the key, a preview in a different locale and a normal request built a new model each time they followed each other. The default locale does not change in a process, so the key does not need it.

`limit` and `filter` are not a part of the key. They change only the results, not the model. `filter` gets the entry of each id through the id-to-entry map of `relatedIndex()`. The model applies it before `limit`, so the result still has `limit` entries when enough entries match.

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

### Filters apply before the limit

Version 3.3 adds `filter` to both queries, and `exclude` to `findRelated()`. `rank()` in `src/model.ts` gets one function that keeps an id or not. It removes the query document, the ids in `exclude`, and the ids that `filter` does not keep. `topIndices()` calls it only for a document that has a score above 0 and that enters the top list. Thus a filtered list still has `limit` ids when enough documents match. Without `exclude` and `filter`, the function removes only the query document, as the `Set` of 3.0.0 did. The equivalence test with 3.0.0 still passes.

### Topics from a fixed list, scored by their descriptions

`classify()` chooses topics from a list that a person writes. It does not make new tags. [Issue #6](https://github.com/DBozhinovski/relatinator/issues/6) gives the reasons. In short, tags made from the words of a post were rare words or noise, and they repeated what related posts already do.

Each topic is one BM25 document with the tag and the description. `classify()` uses `createScorer()` from `src/model.ts`, so it has no second BM25 formula. The design differs from the first sketch in issue #6 in two ways. An eval on 2026-10-17 showed the need for both changes:

- **No posts in the topic documents.** The sketch added all posts with the topic to the topic document. Then the topic with the longest text won. In the eval, one topic had 13,881 tokens and was first for 15 of 37 posts, but only 6 posts had it. With posts in the documents, the descriptions changed 1 of 63 labels.
- **A relative cut, not a minimum score.** A BM25 score is a sum over the terms of the query, so it grows with the length of the text. In the eval, the best score went from 16 for a post with 130 characters to 1,883 for a post with 42,767 characters. With a fixed `minScore` from 5 to 80, the precision stayed at 0.16 to 0.17. `classify()` divides each score by the best score and keeps the topics at `ratio` or more.

The eval used the 37 posts of darko.io and 11 topics with 63 labels that a person approved. Two language models wrote the descriptions from the topic names only, without the posts. With `ratio` 0.5 and `limit` 3, the precision was 0.70 and 0.73, and the recall was 0.70 and 0.71. Without descriptions, the precision was 0.73 and the recall was 0.52. The first sketch, with the best 2 topics of each post, gave a precision of 0.58 and a recall of 0.68.

The eval also added a vote of the 3 nearest tagged posts to the description score. With the best 2 topics of each post, the vote found 3 to 5 more correct labels of 63. With `ratio` 0.5, it found 8 to 10 more, but the precision fell. Without the vote, the precision was 0.67 to 0.73. With the vote, it was 0.58 to 0.61. The vote also needs all tagged posts for each call, so `classify()` does not have it.

A second test on 2026-10-18 measured the effect of the topic list. Two language models, Claude and GPT, each read 38 posts without the 63 labels. The 38 posts were the 37 posts of darko.io and 1 post of blog.wts.sh. Each model made its own topic list with 13 or 14 topics and tagged the posts. Pair F1 compares two tag sets with different topic lists. It counts the pairs of posts that share a topic in both sets.

| Tag sets                                           | Pair F1 |
| -------------------------------------------------- | ------- |
| The 63 labels and Claude                           | 0.65    |
| The 63 labels and GPT                              | 0.67    |
| Claude and GPT                                     | 0.79    |
| `classify()` with the first topic list and GPT     | 0.47    |
| `classify()` with the Claude topic list and GPT    | 0.71    |
| `classify()` with the Claude topic list and Claude | 0.70    |

With the Claude topic list, `classify()` agreed with GPT as well as two taggers agree with each other. Against the Claude labels, the precision and the recall were both 0.79. The Claude descriptions named the projects, tools, and events of the posts, such as "BeerJS Skopje" and "Coolify and Hetzner". The first descriptions had general words. The README section "Best practices for topic lists" comes from this result.

Two other methods did not help, and `relatinator` does not have them:

- **Pseudo-relevance feedback.** This method added the top terms of the posts that matched a topic best to its description. The mean F1 was 0.67 without it and 0.54 to 0.68 with it. The feedback posts were often wrong, and the top terms of a post were words of that post only.
- **A part-of-speech filter.** A filter with the compromise library kept only nouns. It made topics from the words of the posts better, from a mean best F1 of 0.68 to 0.73. But it adds 120 KB (gzipped) and works only with English.

### EmDash terms as topics, in an editor panel

The `astro-relatinator/emdash-plugin` plugin suggests taxonomy terms for a saved entry. It closes the item "EmDash terms are not topics yet" of [issue #6](https://github.com/DBozhinovski/relatinator/issues/6). It does not change the site helper. [EmDash support is a site helper, not a plugin](#emdash-support-is-a-site-helper-not-a-plugin) still applies to related content.

The plugin is different from related content in three ways. It reads one entry and the terms of its taxonomies, not the whole collection. It writes only when a user selects terms. Its result is for the user, not for a page of the site.

**The standard format.** The descriptor sets `format: "standard"`. The entry file default-exports `{ routes }`, and EmDash calls each route with `(routeCtx, ctx)`. emdash 1.3.1 accepts a standard plugin in `plugins: []` and in `sandboxed: []`. A native plugin can run only in `plugins: []`. A standard plugin cannot get options from the descriptor. The `options` field of `PluginDescriptor` is for native plugins only. Thus the only option is `collections`, which goes into the descriptor itself.

The plugin runs only in `plugins: []` now. For `sandboxed: []`, EmDash reads the entry file with `readFileSync()` and loads the code as one module (emdash 1.3.1 `virtual-modules.ts`). The `tsc` output of the entry file imports `relatinator` and other files of the package. A sandboxed entry needs a bundle with no imports. The official plugins build this bundle with `@emdash-cms/plugin-cli`.

**The route permission.** A route without a permission requires `plugins:manage`. The panel route sets `content:edit_own`, so the users with this permission can use it. Contributors have only `content:edit_own_drafts` and cannot use it. EmDash then checks that the user can edit the entry (`requireOwnerPerm()` in `http-route-dispatch.ts`). The permission is in two places. The entry route has it for `plugins: []`, and the descriptor `routes` list has it for `sandboxed: []`.

The route reads the entry from `routeCtx.ui.entry`. EmDash sets this value only for a request through the editor panel endpoint, after the checks. A direct call to the plugin route has no `ui.entry`, and the route returns status 400. The route also does not trust the submitted term ids. It adds only the ids that are terms of that taxonomy and that the entry does not have yet.

**Tag = slug.** Each term becomes one topic. The tag is the term slug. EmDash keeps the slug unique for each taxonomy and locale, but two terms can have the same label. `classify()` throws an error for two equal tags, so the label cannot be the tag. The description is the label and `data.description`, because the label is the best short description of a term. `classify()` runs one time for each taxonomy. Thus the same slug in two taxonomies does not give equal tags, and the relative cut compares only the terms of one taxonomy.

**No labels of the assigned terms in the text.** The default EmDash text contains the labels of the terms of the entry. [EmDash support is a site helper, not a plugin](#emdash-support-is-a-site-helper-not-a-plugin) gives the reason. For suggestions, these labels are wrong. Each assigned term matches its own label and can get the best score. The relative cut then removes the other terms, and the panel removes the assigned term. The result is no suggestion. `topicText()` removes `terms` from the data before it makes the default text. In emdash 1.3.1, `ctx.content.get()` does not put `terms` into the data. The rule keeps the text correct if a later EmDash version adds it.

The assigned terms stay in the `classify()` call. The panel removes them from the result. Thus the cut is the same as for an entry without terms, and an assigned term can use one of the 3 places of `limit`.

## Verification

This section lists the checks behind the claims in the READMEs. There are two types of checks:

- Automated checks are scripts in this repository. No CI runs them. Run them by hand before a release.
- Manual checks ran one time, during the 3.0 work on 2026-10-15, during the 3.1 work on 2026-10-16, and during the topic plugin work on 2026-10-19. The repository has no scripts for them. The procedures below repeat the consumer builds, the Cloudflare check, and the EmDash check. The negative control, the 2.x baseline, the 3.1 checks, and the topic plugin checks have no written procedure.

### Automated checks

Run these commands from the repository root. The results are from 2026-10-16, with Node.js 24.13.1 and pnpm 11.24.0. A result that gives another date is from that date.

| Command                                                    | What it checks                                                                                                                                                                                                                                                                                                                                                   | Result on 2026-10-16                                                                                                                                                                                                |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm test`                                                | Runs the Vitest tests. `relatinator` tests the tokenizer, the weights, the ranking, `classify()`, fixture posts, and the equivalence with 3.0.0. `astro-relatinator` tests both helpers, the text rules and the exported text functions, the cache, the types of `getEmDashRelated()`, and the topic plugin.                                                     | 152 tests in `relatinator` and 80 in `astro-relatinator` on 2026-10-19. `test/classify.test.ts` has 19 of them.                                                                                                     |
| `pnpm --filter relatinator test equivalence`               | Runs only `test/equivalence.test.ts`. It compares the results, the scores, the tie order, and the errors of `src` with `relatinator` 3.0.0. The inputs are synthetic corpora, the fixture posts, the playground posts, seven option sets, `limit` values next to 64, odd `limit` values, more than 100,000 different words, and strings with Unicode edge cases. | 63 tests.                                                                                                                                                                                                           |
| `pnpm check`                                               | `tsc` checks the source and the tests of both libraries. `astro check` checks the playground.                                                                                                                                                                                                                                                                    | No errors. `astro check` reports 0 errors.                                                                                                                                                                          |
| `pnpm --filter relatinator test:portability`               | Builds `relatinator` and bundles `dist/index.js` for the `neutral` platform with esbuild. It fails if the bundle keeps an import or is larger than 60 KB.                                                                                                                                                                                                        | 9594 bytes (9.4 KB), no imports, on 2026-10-19.                                                                                                                                                                     |
| `pnpm build`                                               | Builds both libraries and the playground.                                                                                                                                                                                                                                                                                                                        | The playground has 7 pages.                                                                                                                                                                                         |
| `pnpm -r --if-present run format:check`                    | Runs Prettier in both libraries.                                                                                                                                                                                                                                                                                                                                 | No changes. Each package prints one deprecation warning.                                                                                                                                                            |
| `pnpm --filter relatinator bench --impl both --sizes 1005` | Builds `relatinator`. Then it times the model build, the queries, and `tokenize()` of 3.1 and 3.0.0 on 1,005 synthetic posts, in 5 runs. Each run starts a new Node.js process. The last line tells if the output checksums of all runs agree.                                                                                                                   | The checksums agree, and no call failed. The [3.1.0 changelog](../packages/relatinator/CHANGELOG.md#310---2026-10-16) gives the times.                                                                              |
| `pnpm --filter astro-relatinator bench`                    | Builds both libraries. Then it calls `getEmDashRelated()` and `getRelated()` on 1,005 synthetic posts in memory, in 5 runs. It times the first call, the later calls, and the text of all entries. `--dist` sets the directory of the helpers. The changelog tells how to time 3.0.1.                                                                            | No call failed. Each helper gave one checksum in all runs. The published 3.0.1 package gave the same checksums. The [3.1.0 changelog](../packages/astro-relatinator/CHANGELOG.md#310---2026-10-16) gives the times. |

The benchmark times depend on the machine and its load. For the results above, `taskset -c 3` kept each benchmark on one CPU core.

All 232 tests pass on 2026-10-19. The type assertions in `test/emdash-types.test.ts` and `test/public-entry-text.test.ts` have an effect only in `pnpm check`, because Vitest does not check types. The `astro-relatinator` tests do not load Astro or EmDash. `vitest.config.ts` replaces `astro:content` with `test/astro-content.ts` and `emdash` with `test/emdash.ts`. These stubs return the entries that each test sets. The workspace sets `autoInstallPeers: false`, so pnpm does not install the optional `emdash` peer.

### Playground related lists

The playground is the manual check for changes that affect Astro. Run `pnpm build`. Then compare the related lists in the build output with the [expected related lists](../packages/playground/README.md#expected-related-lists). The playground README has a command that prints the lists. On 2026-10-16, all six lists matched. Also compare the topics with the [expected topics](../packages/playground/README.md#expected-topics). On 2026-10-19, all six lists and all six topic lists matched.

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

### Manual check of the topic plugin

This check ran on 2026-10-19. It used `npm create emdash@1.3.1` with the `node:blog` template, `emdash` 1.3.1, Astro 7.4.0, and the packed tarballs of `relatinator` 3.2.0 and `astro-relatinator`. The config had `plugins: [relatinatorTopics()]`. After the dev-bypass setup, the check called the panel endpoint `POST /_emdash/api/content/posts/{id}/plugin-extensions/relatinator-topics/panel/suggested-topics` with the session cookie and the `X-EmDash-Request: 1` header.

- The manifest listed the "Suggested topics" panel.
- `panel_load` gave the expected blocks for each of the 8 seeded posts. Three posts got suggestions, and five posts got "No suggestions". The seed terms have no descriptions, so each response had the description hint.
- `form_submit` with one suggested tag added that tag to the entry. The response had the toast "Added 1 term." and the new blocks. The terms API of the entry then listed the new tag.
- A request without the header got status 403. A request without the cookie got status 401. A direct call to `/_emdash/api/plugins/relatinator-topics/panel` got status 400.

A second check on the same day drove the admin UI in Chromium with Playwright:

- The "Suggested topics" panel showed in the sidebar of the post editor. It listed "Design (100%)" under Categories and "Tools (100%)" under Tags. A click on "Add selected terms" added the selected term and showed the toast.
- With `refresh: true`, the Categories field of the editor did not show the new term. emdash 1.3.1 `handlePluginEntryRefresh` in the admin reloads the `content`, `revisions`, and `translations` queries, but not the `entry-terms` queries of that field. The field saves its whole list. A removal of the old term in the field then removed the new term too. The terms API showed no categories after that removal.
- The panel now returns `navigate` to the same entry instead of `refresh`. The admin then loads the page again with `window.location.assign()`. After the add, the Categories field showed both terms. A removal of the old term kept the new term.
- An edit of the post title saved automatically within 3 seconds. The Save button then showed "Saved".
- The browser console showed a React warning that a `form` is inside a `form`. The admin puts the Block Kit form of the panel inside the editor form. The submit of the panel did not submit the editor form.

## Known gaps and follow-ups

These items were open on 2026-10-16. The three `classify()` items were open on 2026-10-17. The topic plugin items were open on 2026-10-19.

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
- **`limit` and `filter` in the shared options.** `RelatedOptions` contains `limit` and `filter`, but `relatedIndex()` does not read them. `getRelated()` and `getEmDashRelated()` give them to the model.
- **Preview of a published entry.** A preview of a published entry has the id of the published entry. `getEmDashRelated()` ranks it by the published text, not by the preview text. Thus the related list does not show the effect of unpublished edits.
- **Draft with a new slug.** If a draft revision changes the slug of a published entry, the draft id is not in the model. `getEmDashRelated()` then queries with the draft text and excludes only the new id. The published version of the same entry can then be in the results. This item comes from a code reading of `src/emdash.ts` and the emdash 1.2.0 `loader.ts`. No test or manual check covers it.
- **Warm EmDash calls.** Each `getEmDashRelated()` call makes the text of every entry, because the cache uses the text as the version. The freshness rule needs this text, so a call with a cached model cannot skip it. This text takes most of the time of such a call. The [3.1.0 changelog](../packages/astro-relatinator/CHANGELOG.md#310---2026-10-16) gives the times.
- **Benchmark data.** Both benchmarks use the synthetic posts of `bench/corpus.js`. The helper benchmark reads in-memory collections, not a database, and it does not run Astro. Thus its times do not include a database read or a page render.
- **3.0 manual checks on the 3.1 code.** The consumer builds, the Cloudflare check, and the EmDash check ran on the 3.0 code. They did not run on the 3.1 code.
- **`classify()` defaults.** The defaults `ratio` 0.5 and `limit` 3 come from the eval of 37 posts. The same posts chose them and measured them. No second corpus checks them. The test on 2026-10-18 added one post and two more taggers, but no new corpus. Its taggers were language models, not people. The eval scripts are not in the repository.
- **Posts that match no topic.** Issue #6 asks for a list of the posts that match no topic. A relative cut gives each text with a matching term at least one topic. Thus `classify()` cannot give this list. It needs a different signal.
- **Topics in `astro-relatinator`.** Issue #6 asks for topics for Astro content collections. `astro-relatinator` exports `entryText()`, and the README has a recipe that gives this text to `classify()`. The package has no topic option and no topic cache, because one `classify()` call reads only the topic list. Only the manual playground check runs the recipe in an Astro page. The playground post page calls `classify()` with `entryText()`, and `astro check` type-checks it. Since the topic plugin, EmDash terms are topics in the entry editor. [EmDash terms as topics, in an editor panel](#emdash-terms-as-topics-in-an-editor-panel) describes it.
- **The topic plugin in the sandbox.** The plugin does not load in `sandboxed: []`, because its entry file is not one bundle with no imports. The build uses only `tsc`. A fix needs a bundle step for `dist/emdash-plugin-entry.js`. No test runs the plugin in workerd. `@emdash-cms/plugin-test` 0.2.10 needs Vitest 4, `@cloudflare/vitest-plugin`, and a build with `@emdash-cms/plugin-cli`. The package uses Vitest 5.
- **The text of the topic panel.** The panel reads the data that `ctx.content.get()` returns. In emdash 1.3.1, this data comes from the stored columns of the entry (`ContentRepository.findById()`), not from a revision. A code reading did not find if an unpublished draft revision of a published entry changes these columns. No check covers an entry with a draft revision.
- **Unsaved changes in the topic panel.** The panel reads the saved content of the entry, not the changes that are not saved in the editor.
- **The reload after an add.** After the panel adds terms, the admin loads the entry page again. This reload loses the changes that are not saved. The emdash 1.3.1 admin has no `beforeunload` guard, so the browser does not warn the user.
- **Entries with a null locale.** For an entry with a `null` locale, the panel reads the taxonomies and the terms of all locales. Thus the panel can show a taxonomy group more than one time. This case is rare. The `locale` columns of the taxonomy tables are NOT NULL since migration 036 of emdash 1.3.1, and the `locale` columns of the content tables are NOT NULL since migration 019.
- **The plugin version.** The descriptor sets `version` by hand. A test in `test/emdash-plugin.test.ts` fails when it is not the version in `package.json`.
- **Native EmDash plugins.** How a page can read the data of a native EmDash plugin is an open question upstream. Until EmDash answers it, the site helper is the supported design.
