# Change Log

All notable changes to the "astro-relatinator" project will be documented in this file.

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
