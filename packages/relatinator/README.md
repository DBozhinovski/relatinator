# Relatinator

Relatinator finds related documents. It ranks documents with BM25 or TF-IDF. It can also choose topics for a text from a fixed list.

- It has one runtime dependency: a Porter2 stemmer.
- All functions are synchronous and pure. The library keeps no global state except a bounded stem cache. This cache does not change any result.

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
model.findRelated("cats", { limit: 1, filter: (id) => id !== "both" }); // ["dogs"]
model.getTopTerms("dogs", 3); // [{ term: "long", score: 0.96 }, ...]
model.findRelatedScored("cats"); // [{ id: "both", score: 0.63 }, { id: "dogs", score: 0.59 }]
model.explainRelated("cats", "both"); // [{ term: "cat", score: 0.49 }, { term: "pet", score: 0.14 }]
model.getTopDocumentsForTerm("walking"); // ["dogs"]
```

To choose topics from a fixed list, give each topic a tag and an optional description:

```ts
import { classify } from "relatinator";

const topics = [
  { tag: "community", description: "meetups, conferences, user groups" },
  { tag: "frontend", description: "HTML, CSS, components, accessibility" },
  { tag: "backend", description: "APIs, databases, servers, hosting" },
  { tag: "astro" },
];

classify(topics, "How we built the meetup website with Astro and CSS");
// [{ tag: "astro", score: 1 }, { tag: "community", score: 0.63 }, { tag: "frontend", score: 0.63 }]
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

| Member                                                      | Description                                                                                                                    |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `method`                                                    | The similarity method of the model.                                                                                            |
| `size`                                                      | The number of documents.                                                                                                       |
| `has(id)`                                                   | Returns `true` if the model has a document with this `id`.                                                                     |
| `findRelated(id, { limit, exclude, filter })`               | Uses the text of document `id` as the query. Never returns `id`. Throws if `id` is unknown.                                    |
| `findRelatedToText(text, { limit, exclude, filter })`       | Uses `text` as the query.                                                                                                      |
| `getTopTerms(id, limit)`                                    | Returns the terms with the highest weight in document `id`, as `{ term, score }`. Throws if `id` is unknown.                   |
| `getTopDocumentsForTerm(term, limit)`                       | Returns the documents with the highest weight for `term`.                                                                      |
| `findRelatedScored(id, { limit, exclude, filter })`         | Returns the result of `findRelated` with the score of each id, as `{ id, score }`.                                             |
| `findRelatedToTextScored(text, { limit, exclude, filter })` | Returns the result of `findRelatedToText` with the score of each id, as `{ id, score }`.                                       |
| `explainRelated(id, otherId, limit)`                        | Returns the terms that give document `otherId` its score for the query `id`, as `{ term, score }`. Throws if an id is unknown. |

The default `limit` is 5. The methods return results in rank order. [How scoring works](#how-scoring-works) gives the rules.

The four `find` methods have the same options:

| Option    | Type                      | Description                                                            |
| --------- | ------------------------- | ---------------------------------------------------------------------- |
| `limit`   | `number`                  | The maximum number of results. Default: 5.                             |
| `exclude` | `readonly string[]`       | The ids to leave out of the results.                                   |
| `filter`  | `(id: string) => boolean` | Keeps a document in the results only when the function returns `true`. |

`exclude` and `filter` apply before `limit`. Thus the result has `limit` ids when enough other documents match. They do not change the weights, because the model keeps all documents. Without `exclude` and `filter`, the results are the same as in earlier 3.x versions.

`getTopDocumentsForTerm` tokenizes `term` and uses the first token. If `term` has no token, for example because it is a stopword, the method returns `[]`.

### Scores and shared terms

Use the scored methods and `explainRelated` to find why a document is in a related list, or to improve the text of your documents.

- `findRelatedScored` and `findRelatedToTextScored` return the same ids, in the same order, as `findRelated` and `findRelatedToText` with the same options. Each `score` is the score that the model uses to rank the id. [How scoring works](#how-scoring-works) gives the formula. The scores are not normalized, so do not compare the scores of different queries.
- `explainRelated(id, otherId)` returns the terms of document `id` that also occur in document `otherId`. The `score` of a term is the part of the score of `otherId` that the term gives. It is the number of times that the term occurs in document `id`, multiplied by the weight of the term in document `otherId`.
- `explainRelated` sorts the terms by score, highest first. Terms with equal scores are in JavaScript string order. The default `limit` is 5.
- With `limit` set to `Infinity`, the sum of the term scores is the score of `otherId` for the query `id`. When the result of `findRelatedScored(id)` contains `otherId`, it gives the same score. The sum can be different in the last digits, because the order of the addition is different.
- If the two documents share no term, `explainRelated` returns `[]`.
- The terms are stems, as in `getTopTerms`.

### `tokenize(text)`

Returns the terms that the model uses for `text`. [How scoring works](#how-scoring-works) lists the steps.

```ts
tokenize("The cats aren't sleeping"); // ["cat", "sleep"]
```

Terms are stems, not words. Thus `getTopTerms` and `explainRelated` can return `"exampl"` for "examples".

### `classify(topics, text, options?)`

Chooses topics for `text` from a fixed list. Returns an array of `{ tag, score }` in rank order.

- `topics` is an array of `{ tag: string; description?: string }`. Each `tag` must be unique. A duplicate `tag` throws `Duplicate topic tag: "<tag>"`.
- `options.ratio` is a number from 0 to 1 (default `0.5`). Other values throw a `RangeError`.
- `options.limit` is the maximum number of topics (default `3`). It follows the same rules as the `limit` of `findRelatedToText`.

The best topic has the score 1. If no topic shares a term with `text`, the result is `[]`. [How scoring works](#how-scoring-works) gives the rules.

A topic without a description matches only through the words of its tag. The topic list controls most of the result. [Best practices for topic lists](#best-practices-for-topic-lists) tells you how to write it.

The score is relative to the other topics for the same text, so do not compare scores of different texts. A BM25 score grows with the length of the text. Thus a fixed minimum score keeps too many topics for a long text and too few for a short one.

`classify` does not read your tagged posts. It uses only the topic list. Thus it has the same cost for a new site and for a site with many posts.

## Best practices for topic lists

`classify` matches words, not meanings. Thus the words in your topic list control most of the result. In a test with 38 blog posts, specific descriptions gave much better results than short, general ones. The code and the posts were the same. [docs/architecture.md](https://github.com/DBozhinovski/relatinator/blob/master/docs/architecture.md#topics-from-a-fixed-list-scored-by-their-descriptions) gives the numbers.

### Write the descriptions

- **Name the specific things that your posts mention.** Use the names of projects, tools, products, events, and places. For example, write "self-hosting with Coolify and Hetzner, serverless functions, edge computing". Do not write only "hosting".
- **Use the words of your posts.** `classify` matches "PWA" to "PWA", but not to "progressive web app". If your posts use both forms, put both in the description.
- **Write 10 to 25 words for each topic.** Keep the descriptions at a similar length. A topic with a much longer text matches more posts.
- **Leave out the words that most of your posts contain.** For example, "JavaScript" in one description on a JavaScript blog makes that topic match almost every post.

### Choose the topics

- **Make each topic group several posts.** Three separate topic lists for one blog with 38 posts had 11 to 14 topics.
- **Do not make a topic that fits almost every post.** For example, "web development" on a web development blog groups nothing. Its words also match every text.
- **Make the topics different from each other.** If two topics share most of their words, `classify` gives them together. Merge them, or keep only the words that make them different.

### Check the result

1. Run `classify` on 10 to 20 of your posts.
2. Read the topics that it gives each post.
3. If a topic is on a post that is not about it, compare `tokenize(description)` with `tokenize(post)`. Remove the shared word that causes the match.
4. If a topic is missing from a post, add a word from that post to the description.
5. Do steps 1 to 4 again until most posts get the correct topics.

To get fewer topics with more correct ones, increase `ratio`. In the test, `ratio` 0.7 kept about 75% correct topics and found about 60% of the correct topics. `ratio` 0.5 gave about 70% for both.

### Start with no tags

`relatinator` cannot make the topic list for you. In the test, topics made from the words of the posts were mostly noise. Use one of these methods:

- Write the list yourself from the subjects of your posts.
- Give your posts to a language model one time, and ask it for a list. Then edit the list. After that, `classify` runs without the model.

This prompt gives a list in the correct format:

```text
Read these blog posts. Propose 8 to 15 topics that a reader can use to browse
the blog. Each topic must group several posts. Do not make a topic that fits
almost every post. For each topic, give a lowercase kebab-case tag and a
description of 10 to 25 words. In the description, name the projects, tools,
products, and events that the posts mention. Use the words of the posts.
Return JSON: [{ "tag": "...", "description": "..." }]
```

## How scoring works

The model scores documents in four steps.

1. **Tokenize.** `tokenize()` changes the text to lowercase. It removes English elisions (`'s`, `n't`, `'re`, `'ll`, `'ve`, `'d`, `'m`), with a straight or a typographic apostrophe. It splits the text at all characters that are not Unicode letters or numbers. Then it removes English stopwords and stems each word with Porter2.
2. **Weigh the terms.** `createModel()` calculates a weight for each term `t` in each document `d`. In the formulas, `N` is the number of documents. The document frequency `df(t)` is the number of documents that contain `t`. The term frequency `tf` is the number of times that `t` occurs in `d`. The length `|d|` is the number of terms in `d`, and `avgdl` is the mean length.
   - TF-IDF: `idf(t) = 1 + ln(N / (1 + df(t)))`. The weight is `tf · idf(t)`.
   - BM25: `idf(t) = ln(1 + (N − df(t) + 0.5) / (df(t) + 0.5))`. The weight is `idf(t) · tf · (k1 + 1) / (tf + k1 · (1 − b + b · |d| / avgdl))`.
3. **Score the documents.** The score of a document is the sum of the weights of the query terms in that document. A term that occurs two times in the query counts two times. `findRelated(id)` uses the terms of document `id` as the query. `findRelatedToText(text)` uses `tokenize(text)`.
4. **Rank.** The model removes the query document, the ids in `exclude`, and the ids that `filter` does not keep. It also removes each document with a score of 0. A document that shares no term with the query has a score of 0. It sorts the other documents by score, highest first. Documents with equal scores keep their input order. The result is the first `limit` ids.

`getTopTerms` sorts the terms of a document by weight, highest first. Terms with equal weights are in JavaScript string order.

`classify(topics, text)` uses the same steps, with BM25 and the default `k1` and `b`. It has these differences:

1. The documents are the topics. The text of a topic is its tag, followed by its description if there is one. The id is the tag.
2. The query is `tokenize(text)`.
3. It divides the score of each topic by the best score. Thus the best topic has the score 1.
4. It removes each topic with a score of 0 or a score below `ratio`. It sorts the other topics as in step 4. The result is the first `limit` topics, as `{ tag, score }`.

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

| Command                                      | What it does                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm --filter relatinator build`            | Deletes `dist` and compiles `src` with `tsc`.                                                                                                                                                                                                                                                                                                                            |
| `pnpm --filter relatinator test`             | Runs the Vitest tests. The tests import `src`, so you do not have to build first.                                                                                                                                                                                                                                                                                        |
| `pnpm --filter relatinator check`            | Type-checks `src`, `test`, and `scripts` with `tsc`.                                                                                                                                                                                                                                                                                                                     |
| `pnpm --filter relatinator test:portability` | Builds the package and bundles `dist/index.js` for a neutral platform. It fails if the bundle keeps an import, such as a Node.js module, or is larger than 60 KB.                                                                                                                                                                                                        |
| `pnpm --filter relatinator format:check`     | Checks the format with Prettier. `format` writes the changes.                                                                                                                                                                                                                                                                                                            |
| `pnpm --filter relatinator bench`            | Builds the package. Then it times `createModel()`, the queries, and `tokenize()` on synthetic posts. Each run starts a new Node.js process. `--impl both` also times `relatinator` 3.0.0 and compares the checksums of the outputs. `--sizes` sets the numbers of posts, as a comma-separated list (default `200,1005`). `--runs` sets the number of runs (default `5`). |

The `prepack` script runs `build`. Thus `pnpm pack` and `pnpm publish` always include a new build.

## License

MIT
