# Change Log

All notable changes to the "relatinator" project will be documented in this file.

## Unreleased

- **New:** `findRelated()` and `findRelatedToText()` accept `filter: (id) => boolean`. A document stays in the results only when `filter` returns `true`.
- **New:** `findRelated()` accepts `exclude`, as `findRelatedToText()` does. Version 3.2.0 did not read `exclude` in `findRelated()`, and TypeScript rejected it.
- `exclude` and `filter` apply before `limit`, so a filtered list still has `limit` ids when enough documents match. They do not change the weights.
- Without `exclude` and `filter`, the results, the tie order, and the scores are the same as in 3.2.0. The equivalence test with 3.0.0 passes without changes.
- The minified bundle of `dist/index.js` is 9594 bytes. In version 3.2.0, it was 9499 bytes.

## [3.2.0] - 2026-10-18

This release adds `classify()`. The other functions do not change.

- **New:** `classify(topics, text, { ratio, limit })` chooses topics for a text from a fixed list. Each topic is a tag with an optional description. The function scores the text against each tag and description with BM25. It returns `{ tag, score }[]`, where the best topic has the score 1. The defaults are `ratio: 0.5` and `limit: 3`. See [issue #6](https://github.com/DBozhinovski/relatinator/issues/6).
- **Docs:** The README has a new section, "Best practices for topic lists". It tells you how to write the descriptions, choose the topics, check the result, and start a list for a site with no tags.
- `createModel()` and the queries give the same results, the same tie order, and the same scores as in 3.1.0. The equivalence test with 3.0.0 passes without changes.
- The minified bundle of `dist/index.js` is 9499 bytes. In version 3.1.0, it was 8787 bytes.

## [3.1.0] - 2026-10-16

This release makes the library faster. The API, the options, and the defaults do not change. The results, the tie order, and the scores are the same as in 3.0.0.

- **Perf:** `createModel()` makes an inverted index. For each term, the index lists the documents with the term and the weight of the term in each document. `createModel()` calculates each weight one time. A query adds the weights only for the documents that contain a query term. Version 3.0.0 calculated the weight of each query term for each document on each query.
- **Perf:** For an integer `limit` from 0 to 64, a query keeps only the best `limit` documents while it ranks. For other `limit` values, it sorts all documents, as version 3.0.0 did.
- **Perf:** `tokenize()` stems each different word one time. It keeps up to 100,000 stems in memory. When the cache is full, `tokenize()` clears it.
- The minified bundle of `dist/index.js` is 8787 bytes. In version 3.0.0, it was 7303 bytes.
- Nine `method` values are names of `Object.prototype` methods: `"constructor"`, `"toString"`, `"valueOf"`, `"hasOwnProperty"`, `"isPrototypeOf"`, `"propertyIsEnumerable"`, `"toLocaleString"`, `"__lookupGetter__"`, and `"__lookupSetter__"`. These values are not valid methods, and TypeScript rejects them. For these 9 values, `createModel()` now throws `TypeError: weightings[method] is not a function`. Each other invalid value, such as `"foo"`, throws the same error, as in version 3.0.0. For the 9 values, version 3.0.0 returned a model. Then a query that weighed a term threw `TypeError: weight is not a function`. The other queries returned `[]`.
- For the `method` values `"__defineGetter__"` and `"__defineSetter__"`, `createModel()` throws a `TypeError` in both versions, but the message changes. It is now `weightings[method] is not a function`. Version 3.0.0 gave `Object.prototype.__defineGetter__: Expecting function` (or `__defineSetter__`). TypeScript rejects these values too.

This table gives the times for 1,005 synthetic posts with a mean of 1,204 words. All queries use `limit: 5`. Each value is the median of 5 runs, with the range in parentheses.

| Operation                                           | 3.0.0                     | 3.1.0                     |
| --------------------------------------------------- | ------------------------- | ------------------------- |
| `createModel()`                                     | 2.12 s (2.08 to 2.13 s)   | 0.34 s (0.33 to 0.37 s)   |
| `createModel()`, then `findRelated()` for each post | 25.8 s (25.6 to 25.9 s)   | 0.45 s (0.43 to 0.49 s)   |
| `tokenize()` for each post                          | 1.98 s (1.95 to 1.99 s)   | 0.29 s (0.27 to 0.30 s)   |
| One `findRelated()` call                            | 23.2 ms (22.2 to 23.3 ms) | 0.12 ms (0.11 to 0.17 ms) |
| One `findRelatedToText()` call                      | 25.0 ms (24.3 to 25.4 ms) | 0.38 ms (0.35 to 0.45 ms) |

The command was `pnpm --filter relatinator bench --impl both --sizes 1005`, on 2026-10-16. It ran with Node.js 24.13.1 on one core of an AMD Ryzen AI 9 HX 370 (`taskset -c 3`). Each run starts a new Node.js process. The outputs of both versions had the same checksums, and no call failed. In version 3.1.0, `tokenize()` takes most of the time of `createModel()`.

## [3.0.0] - 2026-10-15

This release changes the API. See "Migrating from 2.x" in the README.

- **Breaking:** Remove `BM25Utils` and `TfIdfUtils`. `createModel(documents, options)` returns a model. Each model is a separate value. The library keeps no global state.
- **Breaking:** All functions are synchronous.
- **Breaking:** BM25 is the default method.
- **Breaking:** `findRelated(id)` finds documents related to a document in the model. `findRelatedToText(text)` finds documents related to other text.
- **Breaking:** Rename `getTopTermsForId` to `getTopTerms`. Rename `getTopRelatedDocumentsForTerm` to `getTopDocumentsForTerm`.
- **Breaking:** Results do not include documents with a score of 0.
- **Breaking:** Duplicate document ids throw an error.
- **Breaking:** Remove the `debug` parameter. The library does not write to the console.
- **Breaking:** Remove the `BM25VectorizerType` type.
- **Breaking:** The package requires Node.js 22.12 or later.
- **Breaking:** The package defines only `exports`. Remove the top-level `main`, `module`, and `types` fields. TypeScript projects need `moduleResolution` set to `node16`, `nodenext`, or `bundler`.
- Remove the `typescript` peer dependency (`>=4.7`).
- The library has its own tokenizer, TF-IDF, and BM25 code. Scores can change a little.
- Remove the `natural`, `wink-nlp`, `wink-eng-lite-web-model`, `wink-nlp-utils`, and `glob` dependencies. The only runtime dependency is `wink-porter2-stemmer`.
- The library runs in Node.js, browsers, and Cloudflare Workers. It does not import Node.js modules.
- New: `tokenize`, `has`, `size`, and BM25 `k1` and `b` options.
- New types: `RelatinatorModel`, `ModelOptions`, `QueryOptions`, and `ScoredTerm`.
- The package ships the output of `tsc`, with one ES module and one type declaration file for each source file. Version 2.x shipped a Vite bundle. The `package.json` sets `sideEffects: false`.

## [2.1.0] - 2025-04-11

- **Fix:** Corrected API documentation and usage examples in README to accurately reflect the use of `BM25Utils` and `TfIdfUtils`.
- **Docs:** Added documentation for the `resetInstance` function available on `BM25Utils` and `TfIdfUtils`.

## [2.0.1] - 2025-02-21

- Adds stopword removal, stemming and elision removal to the input text.
- Removes unused dependencies.

## [2.0.0] - 2025-02-20

- Adds support for BM25. You can now choose between BM25 and the default TF-IDF vectorizer.
- Support for Astro 5.

## [1.3.0] - 2024-02-19

- Fixes a stale dep version that cause issues with Astro 4.

## [1.2.0] - 2023-12-07

- Migrates to a monorepo
- Adds astro integration as separate package

## [1.1.0] - 2023-11-28

- Adds support for extracting top N keywords from a document (possible utility with automated tagging and linking).
- Adds support for getting top N related documents for a given term.

## [1.0.3] - 2023-11-27

- Adds some tests, no changes otherwise.

## [1.0.2] - 2023-11-27

- Publish version 1.0.2.
