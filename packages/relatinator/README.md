# Relatinator

Relatinator finds related documents. It scores your documents against each other with BM25 or TF-IDF, so you do not need a search service or an embedding model. It can also choose topics for a text from a fixed list.

- Its only runtime dependency is a Porter2 stemmer.
- The functions of the main entry point are synchronous and pure. The only global state is a bounded stem cache, and that cache never changes a result.

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

To choose topics from a fixed list, give each topic a tag. A description is optional:

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

A model does not change after you create it. To add or remove documents, create a new model.

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

The default `limit` is 5. The methods return results in rank order. [How scoring works](#how-scoring-works) explains the ranking.

The four `find` methods have the same options:

| Option    | Type                      | Description                                                            |
| --------- | ------------------------- | ---------------------------------------------------------------------- |
| `limit`   | `number`                  | The maximum number of results. Default: 5.                             |
| `exclude` | `readonly string[]`       | The ids to leave out of the results.                                   |
| `filter`  | `(id: string) => boolean` | Keeps a document in the results only when the function returns `true`. |

`exclude` and `filter` apply before `limit`, so you still get `limit` ids when enough other documents match. They do not change the weights, because the model keeps all documents. Without `exclude` and `filter`, the results are the same as in earlier 3.x versions.

`getTopDocumentsForTerm` tokenizes `term` and uses the first token. If `term` has no token, for example because it is a stopword, the method returns `[]`.

### Scores and shared terms

The scored methods and `explainRelated` show why a document is in a related list. They also show which words to change when a related list looks wrong.

- `findRelatedScored` and `findRelatedToTextScored` return the same ids, in the same order, as `findRelated` and `findRelatedToText` with the same options. Each `score` is the value that the model ranks the id by. [How scoring works](#how-scoring-works) gives the formula. The scores are not normalized, so do not compare the scores of different queries.
- `explainRelated(id, otherId)` returns the terms of document `id` that also occur in document `otherId`. The `score` of a term is its part of the score of `otherId`. It is the count of the term in document `id`, multiplied by the weight of the term in document `otherId`.
- `explainRelated` sorts the terms by score, highest first. Terms with equal scores are in JavaScript string order. The default `limit` is 5.
- With `limit` set to `Infinity`, the term scores add up to the score of `otherId` for the query `id`. That is the same score that `findRelatedScored(id)` gives `otherId`. The last digits can be different, because the additions happen in a different order.
- If the two documents share no term, `explainRelated` returns `[]`.
- The terms are stems, as in `getTopTerms`.

### `tokenize(text)`

Returns the terms that the model uses for `text`. [How scoring works](#how-scoring-works) lists the steps.

```ts
tokenize("The cats aren't sleeping"); // ["cat", "sleep"]
```

Terms are stems, not words. For example, `getTopTerms` and `explainRelated` can return `"exampl"` for "examples".

### `classify(topics, text, options?)`

Chooses topics for `text` from a fixed list. Returns an array of `{ tag, score }` in rank order.

- `topics` is an array of `{ tag: string; description?: string }`. Each `tag` must be unique. A duplicate `tag` throws `Duplicate topic tag: "<tag>"`.
- `options.ratio` is a number from 0 to 1 (default `0.5`). Other values throw a `RangeError`.
- `options.limit` is the maximum number of topics (default `3`). It follows the same rules as the `limit` of `findRelatedToText`.

The best topic has the score 1. If no topic shares a term with `text`, the result is `[]`. [How scoring works](#how-scoring-works) gives the rules.

A topic without a description can match only the words of its tag. The topic list decides most of the result, so write it with care. [Best practices for topic lists](#best-practices-for-topic-lists) shows how.

Each score is relative to the other topics for the same text. Do not compare the scores of different texts. A BM25 score grows with the length of the text. For this reason, a fixed minimum score keeps too many topics for a long text and too few for a short one.

`classify` does not read your tagged posts. It reads only the topic list, so it costs the same on a new site as on a site with many posts.

## Topics with a language model

> **Experimental.** The `relatinator/llm` API is not final. Its names, defaults, and scores can change in a minor release. If you use it, pin an exact version, for example `"relatinator": "3.4.0"`.

`relatinator/llm` is an optional entry point. It chooses topics from the same kind of topic list as `classify`, but it uses a language model instead of matching words. It has no dependencies. It needs an OpenAI-compatible endpoint, such as a local llama.cpp server or a hosted API with a key. Run it at build time or in a script.

It has two kinds of judge:

- **A chat judge**, `logprobJudge` or `jsonJudge`, asks a chat model about each topic. It gives the best results, but it needs a model of about 2B parameters or more. That model takes about 1 to 6 seconds for each post.
- **The embedding judge**, `embedJudge`, compares a vector of the post with a vector of each topic. EmbeddingGemma 2 needs 176 MB and one request for each post. It took less than 0.1 seconds for each post on a laptop GPU. It needs good topic descriptions.

In a test with 37 blog posts and descriptions from `describeTopics`, `classify` got an F1 of 0.68. EmbeddingGemma 2 with `embedJudge` got 0.83. Qwen3 4B with `logprobJudge` got 0.85. [docs/architecture.md](https://github.com/DBozhinovski/relatinator/blob/master/docs/architecture.md#topics-from-a-language-model-as-an-option) has the full results.

```ts
import {
  classifyWithLLM,
  describeTopics,
  embedJudge,
  logprobJudge,
} from "relatinator/llm";

// A local llama.cpp server. For a hosted API, also set `apiKey`.
const chat = { baseURL: "http://127.0.0.1:8080/v1", model: "qwen3-4b" };

// One time: write a description for each tag from your posts.
const topics = await describeTopics(
  ["community", "astro", "career"],
  posts.map((p) => ({ title: p.title, summary: p.description })),
  chat
);

// For each post, with a chat model:
await classifyWithLLM(topics, post.body, { judge: logprobJudge(chat) });
// [{ tag: "community", score: 18.2 }]

// Or with an embedding model. Make one judge for all the posts.
const judge = embedJudge({
  baseURL: "http://127.0.0.1:8081/v1",
  model: "embeddinggemma-2",
});
await classifyWithLLM(topics, post.body, { judge });
// [{ tag: "community", score: 0.05 }]
```

### `classifyWithLLM(topics, text, options)`

Returns a promise of `{ tag, score }[]`, best first. `topics` follows the same rules as in `classify`.

- `options.judge` is a `TopicJudge`, for example `logprobJudge(endpoint)`, `jsonJudge(endpoint)`, or `embedJudge(endpoint)`. A judge is a function `(text, topics) => Promise<number[]>`.
- `options.minScore` is the lowest score to keep (default `0`).
- `options.limit` is the maximum number of topics (default `2`).

For each judge, 0 is the cut, and a positive score means that the topic applies. The result is `[]` when no topic reaches `minScore`.

With a chat judge, the score is the log-odds of "yes" over "no". At 0, the model gives "yes" and "no" equal odds. The scores of different texts are comparable, which is not true for `classify`. With `embedJudge`, the score is a difference of cosines. Do not compare it with the score of a chat judge.

### `logprobJudge(endpoint, options?)` and `jsonJudge(endpoint, options?)`

- `logprobJudge` asks a yes/no question for each topic and reads the logprobs of the answer. It needs an endpoint that returns `top_logprobs`. llama.cpp and vLLM return them, but many hosted models do not. It asks each question two times, with the answers in both orders. That is 2 requests for each topic, one at a time.
- `jsonJudge` asks for a probability for each topic in one request. Use it when the endpoint gives no logprobs, for example with a reasoning model.
- `options.maxChars` is the number of characters of the text that the model reads (default `40000`). Use a smaller value for a model with a small context.

If a request fails, the function throws an error with the HTTP status. Some reasoning models sometimes send an empty reply. For this reason, `jsonJudge` asks again when a reply has no JSON object, up to `options.attempts` requests (default `3`).

### `embedJudge(endpoint, options?)`

`embedJudge` sends the text and the topics to the `/embeddings` path of the endpoint. It gets one vector for each input. The score of a topic is its cosine with the text, minus the mean cosine of all the topics, minus `options.cut`. Thus a topic gets a positive score when it is nearer to the text than the other topics, by more than `cut`.

- Use one judge for all your posts. The judge keeps the vector of each topic, so each post after the first needs one request with one input.
- Give it the full topic list. Each score compares a topic with the other topics. With only one topic, the score is always `-cut`. The test used 11 topics.
- `options.maxChars` is the number of characters of the text that the model reads (default `2000`). In the test, the first 2,000 characters gave the same F1 as the full post or a higher one.
- `options.cut` is the amount by which a cosine must be above the mean (default `0.04`). For EmbeddingGemma 2, the best value was 0.04 or 0.05 on each topic list of the test. Other models need a different value. For Qwen3-Embedding-0.6B, the best value was from 0.07 to 0.14.
- `options.topicInput(topic)` and `options.textInput(text)` make the model inputs. The defaults are the EmbeddingGemma 2 formats, `task: search result | query: <tag>: <description>` and `title: none | text: <text>`. For another model, use the formats of that model. In the test, the `task: classification` format gave 0.07 to 0.15 less F1 at the best cut.

If a request fails, `embedJudge` throws an error with the HTTP status. It also throws an error when the response does not have one usable vector for each input.

### The endpoint

`endpoint` is an `Endpoint`. All the judges and `describeTopics` use it. `ChatEndpoint` is the 3.4.0 name of the same type.

- `baseURL`: the URL with the version path, for example `http://127.0.0.1:8080/v1`.
- `model`: the model name.
- `apiKey`: optional. Relatinator sends it as `Authorization: Bearer <apiKey>`. Use it for a hosted API.
- `headers`: optional extra request headers.
- `body`: optional extra fields for the request body, for example `{ dimensions: 256 }` for an embedding API.
- `fetch`: optional replacement for the global `fetch`.

### `describeTopics(tags, posts, endpoint)`

Writes one description for each tag from the titles and summaries of your posts. `posts` is an array of `{ title: string; summary?: string }`. Returns a promise of `Topic[]` in the order of `tags`. If the model gives no description for a tag, it throws an error that names the missing tags. Read and edit the descriptions before you use them. `describeTopics` needs a chat model, also when you use `embedJudge`.

### Choose a model

- For a chat judge, use a model with about 2B parameters or more. In the test, models under 1B did no better than `classify`. Qwen3 4B Instruct (Q4_K_M, 2.5 GB) was the best local model. Gemma 4 E2B was the smallest model that came close to it.
- With llama.cpp, add `body: { cache_prompt: true }` to a chat endpoint. The server then reads the post one time for all the questions about it. For Qwen3.5 models, also add `chat_template_kwargs: { enable_thinking: false }`, so that the first token is the answer.
- For `embedJudge`, use EmbeddingGemma 2. The Q4 file (176 MB) gave the same F1 as the Q8 and BF16 files.
- Start with `minScore` at 0. If you get too many topics, increase it. `pnpm --filter relatinator eval` shows the best threshold for labels that you approved.
- The descriptions still matter most. Descriptions from `describeTopics` gave 0.10 to 0.14 more F1 than descriptions made from the tag names only. For `embedJudge`, the difference was about 0.20.

### Run EmbeddingGemma 2

On your computer, use llama.cpp:

1. Get a llama.cpp build that includes [pull request 30054](https://github.com/ggml-org/llama.cpp/pull/30054). An older build stops with `unknown model architecture: 'gemma-embedding2'`. The test used the `ghcr.io/ggml-org/llama.cpp:server-cuda` image, build 12098.
2. Download `embeddinggemma-2-UD-Q4_K_XL.gguf` from [unsloth/embeddinggemma-2-GGUF](https://huggingface.co/unsloth/embeddinggemma-2-GGUF).
3. Start the server:

   ```sh
   llama-server -m embeddinggemma-2-UD-Q4_K_XL.gguf --alias embeddinggemma-2 \
     --embeddings --pooling mean -c 8192 -b 8192 -ub 8192 --port 8081
   ```

4. Use `{ baseURL: "http://127.0.0.1:8081/v1", model: "embeddinggemma-2" }` as the endpoint.

The model is small enough for a CPU. On a CPU, the test embedded 300 texts in 25 seconds. Do not use the F16 file, because EmbeddingGemma 2 can give bad vectors in F16.

With your own API key, use a hosted API. For example, DeepInfra serves the model as `google/embeddinggemma-2`:

```ts
const judge = embedJudge({
  baseURL: "https://api.deepinfra.com/v1/openai",
  model: "google/embeddinggemma-2",
  apiKey: process.env.DEEPINFRA_API_KEY,
});
```

No test used a hosted embedding API. `embedJudge` adds the EmbeddingGemma 2 prompts to the inputs itself. Do not set a prompt in the API as well, for example the `task` field of DeepInfra. For a different hosted model, set `topicInput`, `textInput`, and `cut` for that model.

## Best practices for topic lists

`classify` matches words. It does not know what they mean, so the words in your topic list decide most of the result. In a test with 38 blog posts, specific descriptions did much better than short, general ones, with the same code and the same posts. [docs/architecture.md](https://github.com/DBozhinovski/relatinator/blob/master/docs/architecture.md#topics-from-a-fixed-list-scored-by-their-descriptions) has the numbers.

### Write the descriptions

- **Name the specific things that your posts mention.** Use the names of projects, tools, products, events, and places. For example, write "self-hosting with Coolify and Hetzner, serverless functions, edge computing" instead of only "hosting".
- **Use the words of your posts.** `classify` matches "PWA" to "PWA", but not to "progressive web app". If your posts use both forms, put both in the description.
- **Write 10 to 25 words for each topic.** Keep the descriptions at a similar length, because a topic with a much longer text matches more posts.
- **Leave out the words that most of your posts contain.** On a JavaScript blog, for example, "JavaScript" in one description makes that topic match almost every post.

### Choose the topics

- **Make each topic group several posts.** In the test, three different topic lists for one blog with 38 posts had 11 to 14 topics each.
- **Do not make a topic that fits almost every post.** On a web development blog, a "web development" topic groups nothing, and its words match every text.
- **Make the topics different from each other.** If two topics share most of their words, `classify` returns them together. Merge them, or keep only the words that make them different.

### Check the result

1. Run `classify` on 10 to 20 of your posts.
2. Read the topics that it gives each post.
3. If a topic is on a post that is not about it, compare `tokenize(description)` with `tokenize(post)`. Remove the shared word that causes the match.
4. If a topic is missing from a post, add a word from that post to the description.
5. Do steps 1 to 4 again until most posts get the correct topics.

To get fewer topics, with a larger share of correct ones, increase `ratio`. In the test, with `ratio` 0.7, about 75% of the topics were correct, and the results had about 60% of the correct topics. With `ratio` 0.5, both numbers were about 70%.

### Start with no tags

`relatinator` cannot make the topic list for you. In the test, topics made from the words of the posts were mostly noise. Use one of these methods:

- Write the list yourself from the subjects of your posts.
- Give your posts to a language model one time, and ask it for a list. Then edit the list. After that, `classify` runs without the model.
- Write the tags yourself, and let `describeTopics` write the descriptions. The tags stay yours. See [Topics with a language model](#topics-with-a-language-model).

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
4. **Rank.** The model removes the query document, the ids in `exclude`, and the ids that `filter` does not keep. It also removes each document with a score of 0. A document has a score of 0 when it shares no term with the query. It sorts the other documents by score, highest first. Documents with equal scores keep their input order. The result is the first `limit` ids.

`getTopTerms` sorts the terms of a document by weight, highest first. Terms with equal weights are in JavaScript string order.

`classify(topics, text)` uses the same steps, with BM25 and the default `k1` and `b`. It has these differences:

1. The documents are the topics. The text of a topic is its tag, followed by its description if there is one. The id is the tag.
2. The query is `tokenize(text)`.
3. It divides the score of each topic by the best score, so the best topic has the score 1.
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
- Scores can change a little, because the library now has its own tokenizer, TF-IDF, and BM25 code.

## Development

This package is part of a pnpm workspace. For the workspace commands, read [Development](https://github.com/DBozhinovski/relatinator#development) in the repository README. For the design decisions and the checks behind them, read [docs/architecture.md](https://github.com/DBozhinovski/relatinator/blob/master/docs/architecture.md).

Run these commands from the repository root:

| Command                                      | What it does                                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm --filter relatinator build`            | Deletes `dist` and compiles `src` with `tsc`.                                                                                                                                                                                                                                                                                                                            |
| `pnpm --filter relatinator test`             | Runs the Vitest tests. The tests import `src`, so you do not have to build first.                                                                                                                                                                                                                                                                                        |
| `pnpm --filter relatinator check`            | Type-checks `src`, `test`, and `scripts` with `tsc`.                                                                                                                                                                                                                                                                                                                     |
| `pnpm --filter relatinator test:portability` | Builds the package and bundles `dist/index.js` for a neutral platform. It fails if the bundle keeps an import, such as a Node.js module, or is larger than 60 KB.                                                                                                                                                                                                        |
| `pnpm --filter relatinator format:check`     | Checks the format with Prettier. `format` writes the changes.                                                                                                                                                                                                                                                                                                            |
| `pnpm --filter relatinator bench`            | Builds the package. Then it times `createModel()`, the queries, and `tokenize()` on synthetic posts. Each run starts a new Node.js process. `--impl both` also times `relatinator` 3.0.0 and compares the checksums of the outputs. `--sizes` sets the numbers of posts, as a comma-separated list (default `200,1005`). `--runs` sets the number of runs (default `5`). |

The `prepack` script runs `build`, so `pnpm pack` and `pnpm publish` always include a new build.

## License

MIT
