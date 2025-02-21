# Change Log

All notable changes to the "astro-relatinator" project will be documented in this file.

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
