# Change Log

All notable changes to the "relatinator" project will be documented in this file.

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
