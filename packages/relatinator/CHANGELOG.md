# Change Log

All notable changes to the "relatinator" project will be documented in this file.

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
