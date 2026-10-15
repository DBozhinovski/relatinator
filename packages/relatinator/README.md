# Relatinator

Relatinator finds related documents. It ranks documents with BM25 or TF-IDF.

- It has one runtime dependency: a Porter2 stemmer.
- All functions are synchronous and pure. The library keeps no global state.

## Compatibility

- Node.js 22.12 or later.
- Browsers and Cloudflare Workers. The package imports no Node.js modules.
- ES modules only. Use `import`. `require("relatinator")` fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`.
- The package includes TypeScript type declarations.
- The tokenizer is for English text.

## Installation

```bash
npm install relatinator
# or
pnpm add relatinator
```

## Usage

```ts
import { createModel } from "relatinator";

const model = createModel([
  { id: "cats", content: "Cats are small, quiet pets that like to sleep." },
  { id: "dogs", content: "Dogs are loyal pets that like long walks." },
  { id: "both", content: "Some homes keep both cats and dogs as pets." },
]);

model.findRelated("cats"); // ["both", "dogs"]
model.findRelatedToText("A quiet cat", { limit: 2 }); // ["cats", "both"]
model.findRelatedToText("pets", { exclude: ["both"] }); // ["cats", "dogs"]
model.getTopTerms("dogs", 3); // [{ term: "long", score: 0.96 }, ...]
model.getTopDocumentsForTerm("walking"); // ["dogs"]
```

Each model is a separate value. To change the corpus, create a new model.

## API

### `createModel(documents, options?)`

Indexes the documents and returns a `RelatinatorModel`.

- `documents` is an array of `{ id: string; content: string }`. Each `id` must be unique. A duplicate `id` throws an error.
- `options.method` is `"bm25"` (default) or `"tfidf"`.
- `options.bm25` sets the BM25 parameters `k1` (default `1.2`) and `b` (default `0.75`).

An empty array is valid. Every query on an empty model returns `[]`.

### `RelatinatorModel`

| Member                                        | Description                                                                                                  |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `method`                                      | The similarity method of the model.                                                                          |
| `size`                                        | The number of documents.                                                                                     |
| `has(id)`                                     | Returns `true` if the model has a document with this `id`.                                                   |
| `findRelated(id, { limit })`                  | Uses the text of document `id` as the query. Never returns `id`. Throws if `id` is unknown.                  |
| `findRelatedToText(text, { limit, exclude })` | Uses `text` as the query. Leaves out the ids in `exclude`.                                                   |
| `getTopTerms(id, limit)`                      | Returns the terms with the highest weight in document `id`, as `{ term, score }`. Throws if `id` is unknown. |
| `getTopDocumentsForTerm(term, limit)`         | Returns the documents with the highest weight for `term`.                                                    |

The default `limit` is 5. The methods return results in rank order. [How scoring works](#how-scoring-works) gives the rules.

`getTopDocumentsForTerm` tokenizes `term` and uses the first token. If `term` has no token, for example because it is a stopword, the method returns `[]`.

### `tokenize(text)`

Returns the terms that the model uses for `text`. [How scoring works](#how-scoring-works) lists the steps.

```ts
tokenize("The cats aren't sleeping"); // ["cat", "sleep"]
```

Terms are stems, not words. Thus `getTopTerms` can return `"exampl"` for "examples".

## How scoring works

The model scores documents in four steps.

1. **Tokenize.** `tokenize()` changes the text to lowercase. It removes English elisions (`'s`, `n't`, `'re`, `'ll`, `'ve`, `'d`, `'m`), with a straight or a typographic apostrophe. It splits the text at all characters that are not Unicode letters or numbers. Then it removes English stopwords and stems each word with Porter2.
2. **Weigh the terms.** `createModel()` calculates a weight for each term `t` in each document `d`. In the formulas, `N` is the number of documents. The document frequency `df(t)` is the number of documents that contain `t`. The term frequency `tf` is the number of times that `t` occurs in `d`. The length `|d|` is the number of terms in `d`, and `avgdl` is the mean length.
   - TF-IDF: `idf(t) = 1 + ln(N / (1 + df(t)))`. The weight is `tf · idf(t)`.
   - BM25: `idf(t) = ln(1 + (N − df(t) + 0.5) / (df(t) + 0.5))`. The weight is `idf(t) · tf · (k1 + 1) / (tf + k1 · (1 − b + b · |d| / avgdl))`.
3. **Score the documents.** The score of a document is the sum of the weights of the query terms in that document. A term that occurs two times in the query counts two times. `findRelated(id)` uses the terms of document `id` as the query. `findRelatedToText(text)` uses `tokenize(text)`.
4. **Rank.** The model removes the query document and the ids in `exclude`. It also removes each document with a score of 0. A document that shares no term with the query has a score of 0. It sorts the other documents by score, highest first. Documents with equal scores keep their input order. The result is the first `limit` ids.

`getTopTerms` sorts the terms of a document by weight, highest first. Terms with equal weights are in JavaScript string order.

## Migrating from 2.x

Version 3.0 changes the API.

- Version 3.0 removes `BM25Utils` and `TfIdfUtils`. Call `createModel(documents, { method })` instead. The default method is now BM25.
- Version 3.0 removes `getInstance`, `resetInstance`, and `train`. A model is ready when `createModel` returns. To retrain, create a new model.
- `findRelated(text, id, topN)` is now two methods. Use `findRelated(id, { limit })` for a document in the model. Use `findRelatedToText(text, { limit, exclude })` for other text.
- `getTopTermsForId` is now `getTopTerms`. `getTopRelatedDocumentsForTerm` is now `getTopDocumentsForTerm`.
- All functions are synchronous. Remove `await`.
- Results do not include documents with a score of 0.
- Version 3.0 removes the `debug` parameter. The library does not write to the console.
- Duplicate document ids throw an error.
- Scores can change a little. The library now has its own tokenizer, TF-IDF, and BM25 code.

## Development

This package is part of a pnpm workspace. For the workspace commands, read [Development](https://github.com/DBozhinovski/relatinator#development) in the repository README. For the design decisions and the verification, read [docs/architecture.md](https://github.com/DBozhinovski/relatinator/blob/master/docs/architecture.md).

Run these commands from the repository root:

| Command                                      | What it does                                                                                                                                                      |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter relatinator build`            | Deletes `dist` and compiles `src` with `tsc`.                                                                                                                     |
| `pnpm --filter relatinator test`             | Runs the Vitest tests. The tests import `src`, so you do not have to build first.                                                                                 |
| `pnpm --filter relatinator check`            | Type-checks `src`, `test`, and `scripts` with `tsc`.                                                                                                              |
| `pnpm --filter relatinator test:portability` | Builds the package and bundles `dist/index.js` for a neutral platform. It fails if the bundle keeps an import, such as a Node.js module, or is larger than 60 KB. |
| `pnpm --filter relatinator format:check`     | Checks the format with Prettier. `format` writes the changes.                                                                                                     |

The `prepack` script runs `build`. Thus `pnpm pack` and `pnpm publish` always include a new build.

## License

MIT
