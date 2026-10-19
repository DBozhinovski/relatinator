# Change Log

All notable changes to the "astro-relatinator" project will be documented in this file.

## [3.2.0] - 2026-10-19

This release adds the EmDash topic plugin, filters, related entries for live collections, the exported entry text, and a freshness window for EmDash. Without the new options, the related entries of `getRelated()` do not change.

- **New:** The new `astro-relatinator/emdash-plugin` entry point is an EmDash plugin. It adds a "Suggested topics" panel to the entry editor. The panel suggests terms from the taxonomies of the collection with `classify()`. The user selects the terms, and the panel adds them to the entry. [EmDash topic suggestions](README.md#emdash-topic-suggestions) tells how to install it.
- Each suggestion shows the term label and up to 3 words of the entry that matched the term, for example "supertokens: supertokens, authenticated, providers". The panel shows no score. The words show if a suggestion is good, and which term description to change. [What users see](README.md#what-users-see) gives an example.
- The plugin reads only EmDash taxonomies. A site that keeps its tags in a `multiSelect` field must move them to a taxonomy, and its templates must read the terms of the entry.
- The plugin uses the standard EmDash plugin format. It runs in `plugins: []` and in `sandboxed: []`. The build bundles the sandbox entry, `dist/emdash-plugin-entry.js`, into one file with no imports, because EmDash loads the code of a sandboxed plugin as one module. The other files of `dist` are the `tsc` output, as before. [Install the plugin](README.md#install-the-plugin) tells how to set a sandbox runner.
- The `astro-relatinator/emdash-plugin/sandbox` export has a `default` condition in place of `import`. EmDash finds a sandbox entry with `require.resolve()`, which does not match the `import` condition.
- The published dependency is `relatinator` `^3.3.0`. The plugin needs `classify()`, and `filter` needs the `filter` query option of `relatinator` 3.3.
- The new `astro-relatinator/emdash-plugin/sandbox` entry point is the plugin code that EmDash loads. Do not import it in your pages.
- **New:** `astro-relatinator` exports `entryText(entry, fields?)`, and `astro-relatinator/emdash` exports `emdashEntryText(entry, fields?)`. Each function returns the default text of an entry, which `getRelated()` or `getEmDashRelated()` reads when you do not set `text`. Give this text to `classify()` from `relatinator` to get topics for an entry. [Topics for your entries](README.md#topics-for-your-entries) gives an example.
- **New:** `astro-relatinator` exports `type ContentEntry`, the entry type of `entryText()`. Its `digest` is a string or a number, as in Astro 7.
- **New:** `getRelated()` and `getEmDashRelated()` accept `filter: (entry) => boolean`. An entry stays in the results only when `filter` returns `true`. The filter applies before `limit`, so a filtered list still has `limit` entries when enough entries match. The model contains all entries of the collection, so the scores do not change. `filter` is not a part of the cache key.
- **New:** `getLiveRelated()` finds related entries in a live content collection of `src/live.config.ts`. It reads the collection with `getLiveCollection()` on each call. It has the same options as `getRelated()`. The result has the entry type of the live collection. When `getLiveCollection()` returns an error, `getLiveRelated()` throws an error that names the collection. Live entries have no `digest`, so the cache compares the text of each entry. A live collection and a content collection with the same name get different models. The default text reads the string and number values of `entry.data` and the words of `entry.rendered.html`, without the HTML tags. [Live collections](README.md#live-collections) tells how to use it.
- The package exports the `LiveCollectionKey`, `LiveCollectionEntry`, and `GetLiveRelatedOptions` types.
- `getLiveRelated()` gives no filter to the loader. A loader that needs a filter, such as the EmDash live loader, fails. For EmDash collections, use `getEmDashRelated()`.
- **New:** `getEmDashRelated()` accepts `locale`. It gives `locale` to `getEmDashCollection()`. Without `locale`, the call to `getEmDashCollection()` does not change.
- **Perf:** The cache key of `getEmDashRelated()` contains the locale. With `locale`, it is that locale. Without `locale`, it is the locale of the EmDash request context, which EmDash uses for a preview or in edit mode. Before this change, all locales of a collection used one model. A call for a different locale than the last call built a new model.
- The type declarations for `emdash` contain the `locale` query option of `getEmDashCollection()` and `getRequestContext()`.
- **New:** `getEmDashRelated()` accepts `maxAge`, in seconds. Default: `0`, which reads the collection on each call, as before. When the last full read for the same collection, locale, `method`, and text source is less than `maxAge` seconds old, the call does not call `getEmDashCollection()` and does not make the text of the entries. It uses the entries and the model of that read. Inside the window, the lists do not show new changes. Each process or isolate has its own window. A call in a preview request or in edit mode does not use a window and does not keep its read. emdash 1.3.1 gives these reads the drafts. A value that is not a number from 0 causes a `RangeError`. [Freshness window](README.md#freshness-window) tells more.
- **Fix:** `getEmDashRelated()` ranks an entry object by the text of the object. Thus a preview of a published entry gets the related list of its changes. Before this change, it used the published text of the id. In emdash 1.3.1, the collection read of a preview contains the draft of the previewed entry. Thus the old query was already the preview text. The change is visible in two cases. With emdash 1.0.0, the collection read of a preview contains no drafts. In a request that is not a preview or edit mode, the entry object can have a different text than the collection read. For an entry object with the published text, the result does not change. The result also does not contain a published entry with the same `data.id` as the entry object. Thus a draft that changes the slug does not get its own published version in its list. [Which entries are compared](README.md#which-entries-are-compared) tells more.
- The `text` function now also gets an entry object whose id is published. Make sure that it accepts an entry with only some of the keys of `D`.
- **Docs:** The [workerd measurement](../../docs/architecture.md#workerd-measurement-of-getemdashrelated) in the architecture document gives the time of `getEmDashRelated()` in local workerd with local D1, for 7, 200, and 1,005 posts. At 1,005 posts, a call with a cached model took 215 ms with `maxAge` 0 and 2 ms inside a 60-second window. `bench/workerd` has the scripts of the measurement. The README tells that a model build at 200 posts and more uses more than the 10 ms of CPU time for each request of the Workers Free plan.

## [3.1.0] - 2026-10-16

This release makes the helpers faster. The API does not change. The related entries, their order, and the default text are the same as in 3.0.1.

- **Fix:** The model cache compares the id and the version of each entry one by one. Versions 3.0.0 and 3.0.1 joined them into one string, with U+0000 and U+0001 between them. When an id or a text contained one of these characters, two different collections could give the same string. The helpers then used a model that was out of date. Version 3.1.0 builds a new model in this case.
- **Perf:** Use relatinator 3.1. The published dependency is `relatinator` `^3.1.0`. The [relatinator changelog](../relatinator/CHANGELOG.md#310---2026-10-16) tells how 3.1 builds and queries the model faster.
- **Perf:** The cache compare does not make one large string on each call. `portableTextToPlainText()` and the default EmDash text make fewer temporary arrays.

This table gives the times for 1,005 synthetic posts in an in-memory collection, without Astro and without a database. A first call builds the model. A later call uses the cached model. Each value is the median of 5 runs, with the range in parentheses. The 3.0.1 times use relatinator 3.0.0.

| Call                               | 3.0.1                     | 3.1.0                     |
| ---------------------------------- | ------------------------- | ------------------------- |
| `getEmDashRelated()`, first call   | 2.32 s (2.28 to 2.50 s)   | 0.43 s (0.42 to 0.44 s)   |
| `getEmDashRelated()`, a later call | 70.4 ms (69.2 to 77.7 ms) | 30.2 ms (29.9 to 30.8 ms) |
| `getRelated()`, first call         | 2.24 s (2.22 to 2.27 s)   | 0.39 s (0.38 to 0.41 s)   |
| `getRelated()`, a later call       | 30.1 ms (29.4 to 30.4 ms) | 0.65 ms (0.60 to 0.68 ms) |

The script was `bench/bench.mjs`, on 2026-10-16. It ran the published 3.0.1 package and version 3.1.0 in alternate runs. It ran with Node.js 24.13.1 on one core of an AMD Ryzen AI 9 HX 370 (`taskset -c 3`). Both versions gave the same related entries, and no call failed.

To time the published 3.0.1 package, install it with `relatinator` 3.0.0 in an empty directory. Then give its `dist` directory to the `--dist` option. To get alternate runs, run this command and the default command one after the other, several times:

```sh
npm install --prefix /tmp/astro-301 --omit=peer astro-relatinator@3.0.1 relatinator@3.0.0
pnpm --filter astro-relatinator bench --dist /tmp/astro-301/node_modules/astro-relatinator/dist
```

In version 3.1.0, most of the time of a later `getEmDashRelated()` call goes to the text of the entries. The helper makes the text of each entry on each call, because it compares the text to find changes. For the 1,005 posts, the text took 28.3 ms (24.6 to 31.6 ms). A database read adds to the time of each call.

## [3.0.1] - 2026-10-15

- **Fix:** The return type of `getEmDashRelated()` is now the type of the published entries. Version 3.0.0 gave the results the type of the input entry, but the results are the published entries from EmDash. Callers that gave a part of the entry data had to use a cast to read the other keys.
- The type parameter of `getEmDashRelated()` is now `D`, the type of `data` in the published entries. The result type is `EmDashEntry<D>[]`. The entry object can have only some of the keys of `D`. When you do not give `D`, TypeScript gets it from the `data` of the entry object.
- The `text` option gets `EmDashEntry<Partial<D>>`. It gets the published entries and, for an entry object that is not published, that object.
- The type parameters of the exported `EmDashEntry` and `GetEmDashRelatedOptions` types changed meaning. `EmDashEntry<D>` takes the data type. `GetEmDashRelatedOptions<D>` takes the data type, not the entry type. Code that gives 3.0.0 type arguments to these types or to `getEmDashRelated()` must change. The runtime behavior does not change.

## [3.0.0] - 2026-10-15

This release breaks the API. See "Migrating from 2.x" in the README.

- **Breaking:** Remove `BM25Utils` and `TfIdfUtils`.
- **Breaking:** The integration takes no options. It ignores the 2.x options (`paths`, `schema`, `similarityMethod`, `debug`) and logs a warning. The integration is now optional.
- **Breaking:** Entries use `entry.id`. The `title` frontmatter field is no longer the id.
- **Breaking:** The default method is BM25. Set `method: "tfidf"` to use TF-IDF.
- **Breaking:** Support Astro 6 and Astro 7. Drop Astro 5. Node.js 22.12 or later is necessary.
- Add `getRelated(collection, entry, options)`. It reads the collection with `getCollection()`. It returns the related entries in rank order. The options are `limit`, `method`, `fields`, and `text`. The `GetRelatedOptions` type describes them.
- The integration no longer reads Markdown files when Astro starts, and it no longer watches files. `getRelated()` reads the current collection on each call.
- `getRelated()` also works when the Cloudflare adapter prerenders pages in workerd. Version 2.x kept the model in the Astro config process.
- The package no longer keeps global state. It caches one model for each collection and option set. It builds the model again when an entry changes.
- The package ships compiled JavaScript and type declarations. Version 2.x shipped the TypeScript source file `integration.ts`.
- Remove the `glob` and `gray-matter` dependencies.
- Use relatinator 3.0.
- Add `getEmDashRelated()` and `portableTextToPlainText()` in `astro-relatinator/emdash`. They find related entries on EmDash sites. The default text reads the content fields and the term labels, not the system values of EmDash. `emdash` is an optional peer dependency. The subpath also exports the `GetEmDashRelatedOptions` and `EmDashEntry` types.

## [2.1.0] - 2025-04-11

- **Fix:** Resolved error `wink-nlp: learn can not be used after a call to out() API` by resetting the model instance (`BM25Utils.resetInstance()` or `TfIdfUtils.resetInstance()`) before re-training on file changes during development (`astro dev`).
- **Fix:** Corrected TypeScript configuration error related to `rootDir` by explicitly setting `"rootDir": "."` in `tsconfig.json`.
- **Perf:** Added debouncing (500ms) to the file watcher in the development server to prevent excessive re-training on rapid saves, improving performance for larger sites.
- **Docs:** Updated README usage examples to correctly use `BM25Utils`/`TfIdfUtils` and added notes about debouncing.

## [2.0.1] - 2025-02-21

- Adds stopword removal, stemming and elision removal to the input text.

## [2.0.0] - 2025-02-20

- Adds support for BM25. You can now choose between BM25 and the default TF-IDF vectorizer.
- Support for Astro 5.

## [1.2.0] - 2024-02-19

- Fixes a stale dep version that cause issues with Astro 4.

## [1.1.0] - 2023-12-07

- Initial public release.
- Pre-training support, based on user configuration.
- Uses `"astro:server:setup"` while in development mode (and in theory, SSR mode). Uses `"astro:build:setup"` for producing SSG output.
