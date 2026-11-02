# astro-relatinator

Find related entries in your Astro content collections.

This package wraps [relatinator](https://github.com/DBozhinovski/relatinator/tree/master/packages/relatinator) and scores entries with BM25 (the default) or TF-IDF.

## Compatibility

- Astro 6 and Astro 7. The `astro` peer dependency is `^6.0.0 || ^7.0.0`.
- Node.js 22.12 or later.
- Static output and on-demand rendering.
- Live content collections, with `getLiveRelated()`.
- The Cloudflare adapter, including when it prerenders pages in workerd.
- EmDash 1.x (1.0 or later), for `astro-relatinator/emdash` only. The optional `emdash` peer dependency is `^1.0.0`.
- EmDash 1.3.1 or later for the `astro-relatinator/emdash-plugin` plugin. The checks ran on EmDash 1.3.1. EmDash 1.2.0 also loads the panel, but no check added a term with 1.2.0.
- ES modules only, with TypeScript type declarations.

[Verification](https://github.com/DBozhinovski/relatinator/blob/master/docs/architecture.md#verification) lists the checks behind each item.

## Installation

```sh
npx astro add astro-relatinator
```

You can also install the package without `astro add`:

```sh
npm install astro-relatinator
```

The integration is optional. `getRelated()` works without an entry in `integrations`, and [How it works](#how-it-works) explains why. The `astro add` command puts `relatinator()` in your config anyway. You can keep it or remove it.

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import relatinator from "astro-relatinator";

export default defineConfig({
  integrations: [relatinator()],
});
```

## Usage

Call `getRelated()` in the frontmatter of a page, with the collection name and an entry or an entry id. It returns related entries from the same collection, most related first.

```astro
---
// src/pages/posts/[id].astro
import { getCollection, render } from "astro:content";
import { getRelated } from "astro-relatinator";

export async function getStaticPaths() {
  const posts = await getCollection("posts");
  return posts.map((post) => ({ params: { id: post.id }, props: { post } }));
}

const { post } = Astro.props;
const { Content } = await render(post);
const related = await getRelated("posts", post, { limit: 3 });
---

<article>
  <h1>{post.data.title}</h1>
  <Content />
</article>

<h2>Related</h2>
<ul>
  {related.map((entry) => <li><a href={`/posts/${entry.id}/`}>{entry.data.title}</a></li>)}
</ul>
```

The result has the same type as `getCollection("posts")`, so TypeScript knows the type of `entry.data`.

If the collection has no entry with the given id, `getRelated()` throws an error.

## Options

| Option   | Type                  | Default    | Description                                                                        |
| -------- | --------------------- | ---------- | ---------------------------------------------------------------------------------- |
| `limit`  | `number`              | `5`        | The maximum number of related entries.                                             |
| `method` | `"bm25"` or `"tfidf"` | `"bm25"`   | The scoring method.                                                                |
| `fields` | `readonly string[]`   | all fields | The `data` keys to read. The body is always read.                                  |
| `text`   | `(entry) => string`   | none       | Returns the full text of an entry, in place of the default text.                   |
| `filter` | `(entry) => boolean`  | none       | Keeps an entry in the results only when it returns `true`. It runs before `limit`. |

The default text of an entry has two parts:

1. Every string and number in `entry.data`, including the ones inside arrays and nested objects. `getRelated()` skips dates, booleans, and `null`. If you set `fields`, it reads only those keys.
2. The body of the entry (`entry.body`), if the entry has one.

Examples:

```ts
// Only read the title and tags, plus the body.
await getRelated("posts", post, { fields: ["title", "tags"] });

// Use your own text for each entry.
await getRelated("posts", post, {
  text: (entry) => `${entry.data.title} ${entry.data.tags.join(" ")}`,
});

// Show 3 related posts in the language of this post.
await getRelated("posts", post, {
  limit: 3,
  filter: (entry) => entry.data.lang === post.data.lang,
});
```

`filter` changes only which entries come back. The model still holds every entry in the collection, so the scores stay the same. Because `filter` runs before `limit`, you get `limit` entries as long as enough entries match.

## Topics for your entries

`classify()` from [`relatinator`](https://github.com/DBozhinovski/relatinator/tree/master/packages/relatinator#classifytopics-text-options) picks topics for a text from a fixed list. To get topics for an entry, give it the text of the entry. `entryText(entry, fields?)` returns that text. It is the same default text that `getRelated()` reads when you do not set `text`.

`classify()` needs `relatinator` 3.2 or later. Install `relatinator` next to `astro-relatinator`:

```sh
npm install relatinator
```

Put your topic list in a module:

```ts
// src/topics.ts
import type { Topic } from "relatinator";

export const topics: Topic[] = [
  {
    tag: "astronomy",
    description:
      "black holes, galaxies, comets, planets, telescopes, the James Webb Space Telescope, and the night sky",
  },
  {
    tag: "baking",
    description:
      "sourdough starters, bread, flour, yeast, ovens, pastry, cakes, and recipes for the home kitchen",
  },
];
```

Then call `classify()` in the frontmatter of the page, and show the topics:

```astro
---
// src/pages/posts/[id].astro
import { getCollection } from "astro:content";
import { entryText } from "astro-relatinator";
import { classify } from "relatinator";
import { topics } from "../../topics";

export async function getStaticPaths() {
  const posts = await getCollection("posts");
  return posts.map((post) => ({ params: { id: post.id }, props: { post } }));
}

const { post } = Astro.props;
// Read the title and the description, plus the body. Do not read `tags`.
const postTopics = classify(topics, entryText(post, ["title", "description"]));
---

<h1>{post.data.title}</h1>
<ul>
  {postTopics.map(({ tag }) => <li>{tag}</li>)}
</ul>
```

`classify()` returns at most 3 topics, best first. If no topic shares a term with the text, it returns `[]`.

Do not read the field that already holds the tags of the entry. Without `fields`, `entryText()` reads every field in `entry.data`, `tags` included. Each tag in that text matches the topic with the same tag and raises its score. You then get the existing tags back. Other topics can then drop out of the 3 results. That is why the example sets `fields` to the fields other than `tags`. `entryText()` always reads the body.

`classify()` does not read the collection, and it does not use the model cache of `getRelated()`. It only compares the text with the topic list.

To let a language model choose topics at build time, give this text to `classifyWithLLM()` from the experimental `relatinator/llm` entry point. It needs `relatinator` 3.4 or later and a chat endpoint. [Topics with a language model](https://github.com/DBozhinovski/relatinator/tree/master/packages/relatinator#topics-with-a-language-model) has the details.

Most of the result depends on the topic list. [Best practices for topic lists](https://github.com/DBozhinovski/relatinator/tree/master/packages/relatinator#best-practices-for-topic-lists) shows how to write a good one.

For EmDash entries, `emdashEntryText(entry, fields?)` from `astro-relatinator/emdash` returns the default EmDash text. Without `fields`, that text includes the labels of the taxonomy terms of the entry. To get term suggestions in the entry editor, read [EmDash topic suggestions](#emdash-topic-suggestions).

## Live collections

For a live collection in `src/live.config.ts`, use `getLiveRelated()`. Astro loads a live collection when a page renders, not at build time. `getLiveRelated()` reads the collection with `getLiveCollection()`. It returns related entries from the same live collection, most related first.

```astro
---
// src/pages/products/[id].astro
export const prerender = false;

import { getLiveEntry } from "astro:content";
import { getLiveRelated } from "astro-relatinator";

const { entry: product } = await getLiveEntry("products", Astro.params.id!);
if (!product) return Astro.redirect("/404");
const related = await getLiveRelated("products", product, {
  limit: 3,
  fields: ["title", "description"],
});
---

<h1>{product.data.title}</h1>

<h2>Related</h2>
<ul>
  {related.map((entry) => <li><a href={`/products/${entry.id}`}>{entry.data.title}</a></li>)}
</ul>
```

`getLiveRelated()` takes the same options as `getRelated()`: `limit`, `method`, `fields`, `text`, and `filter`. The result has the entry type of `getLiveCollection("products")`, so TypeScript knows the type of `entry.data`. The collection name must be a key of the `collections` export in `src/live.config.ts`.

Where it differs from `getRelated()`:

- A live entry has no body. The default text is the string and number values of `entry.data`, followed by the words of `entry.rendered.html`. A loader can put the content of an entry there as HTML. Before scoring, `getLiveRelated()` removes the HTML tags and the content of `script` and `style` elements. It decodes common HTML entities such as `&amp;` and removes the other named entities. As a result, tag names and entity names do not relate entries. `fields` limits only the data keys. To use other text, set `text`.
- When `getLiveCollection()` returns an error, `getLiveRelated()` throws an error that names the collection, with the Astro error as its `cause`. It also throws an error if the collection has no entry with the given id.
- Each call loads the collection. `getLiveCollection()` calls the `loadCollection()` function of the loader every time. If the loader fetches from an API, each page render fetches the whole collection one time for `getLiveRelated()`.
- Live entries have no `digest`, so `getLiveRelated()` compares the text of each entry to find changes. That means each call makes the text of every entry. The model stays the same until a text changes.
- A live collection and a content collection with the same name get different models in the cache.

Some data values change on each request, such as a stock count or a time. Then the text changes on each call, and each call builds a new model. Use `fields` or `text` to leave these values out.

`getLiveRelated()` does not give a filter to the loader. If a loader needs a filter, it returns an error, and `getLiveRelated()` throws it. The EmDash live loader is one example, because it needs the collection type. For EmDash collections, use [`getEmDashRelated()`](#emdash).

Astro 6 and 7 have live collections. Astro documents them for pages that render on demand, with an adapter. In Astro 7.3.8, a prerendered page can also call `getLiveRelated()`. Astro then runs the loader at build time, and the page keeps the related list from the build.

## How it works

`getRelated()` reads the collection with `getCollection()` every time a page calls it. It does not read files when Astro starts, and it does not watch files.

### The model cache

`getRelated()` builds one model for each combination of collection, `method`, and `fields` (or `text`). `limit` and `filter` do not change the model. Later calls use the same model until the collection changes. A build with many pages therefore builds each model one time.

To find changes, `getRelated()` compares the id and the `digest` of each entry. Entries from the built-in loaders have a digest. For an entry without one, it compares the text of the entry.

When you use `text`, it compares what your function returns. This means that your function runs for each entry on each call.

In `astro dev`, the related entries update when you edit a content file. You do not need to restart the server.

### Why the integration is optional

`getRelated()` imports `astro:content`, and only Vite can resolve this module. Astro already processes `astro-relatinator` with Vite, because the package has an `astro` peer dependency, the `astro` keyword, and a name that starts with `astro-`. That is why `getRelated()` works with or without the integration. [The integration is optional](https://github.com/DBozhinovski/relatinator/blob/master/docs/architecture.md#the-integration-is-optional) has the details.

## Limitations

- With on-demand rendering, each Node.js process or Cloudflare Workers isolate builds its own model on its first call. The cache is in memory, so a new process or isolate starts with an empty cache.
- Each call reads the whole collection. With `text`, and on EmDash, each call also makes the text of every entry to find changes. Calls and model builds get slower as the collection grows. On EmDash, `maxAge` skips this work inside a [freshness window](#freshness-window).
- The Cloudflare Workers Free plan allows 10 ms of CPU time for each HTTP request. Time spent waiting on a database query does not count. The [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) page also says: "Each isolate has some built-in flexibility to allow for cases where your Worker infrequently runs over the configured limit." The model build is CPU work. In local workerd, it took 182 ms for 200 posts and 831 ms for 1,005 posts. A call that builds the model therefore uses more than 10 ms of CPU time from 200 posts up. The first call in each isolate builds the model, and each change in the collection builds it again. The `maxAge` option does not remove these builds.
- The cache keeps a model for each set of options that your pages use. It never removes a model.
- Related entries come only from the collection that you give. `getRelated()` does not compare entries across collections.
- `filter` does not remove entries from the model. Every entry in the collection still changes the term weights.
- `getEmDashRelated()` ranks only published entries. [Which entries are compared](#which-entries-are-compared) explains what it does with a draft or a preview.
- The tokenizer is for English text. [How scoring works](https://github.com/DBozhinovski/relatinator/tree/master/packages/relatinator#how-scoring-works) lists the steps.

## EmDash

[EmDash](https://github.com/emdash-cms/emdash) keeps content in a database, not in content collections. For EmDash sites, use `getEmDashRelated()` from `astro-relatinator/emdash`. It shares the scoring and the model cache with `getRelated()`.

It needs `emdash` 1.x (1.0 or later). Install the package next to `emdash`:

```sh
npm install astro-relatinator
```

You do not need the integration in `astro.config.mjs`.

### Usage

Give `getEmDashRelated()` the collection slug and an entry or an entry id. It returns the related entries, most related first.

```astro
---
// src/pages/posts/[slug].astro
import { getEmDashEntry } from "emdash";
import { getEmDashRelated } from "astro-relatinator/emdash";

const { entry: post } = await getEmDashEntry("posts", Astro.params.slug);
if (!post) return Astro.redirect("/404");

const related = await getEmDashRelated("posts", post, { limit: 3 });
---

<ul>
  {related.map((entry) => <li><a href={`/posts/${entry.id}`}>{entry.data.title}</a></li>)}
</ul>
```

The result holds published entries from the collection, not copies of the entry that you give. The types are:

```ts
interface EmDashEntry<D extends object = Record<string, unknown>> {
  readonly id: string;
  readonly data: D;
}

function getEmDashRelated<D extends object = Record<string, unknown>>(
  collection: string,
  entry: string | EmDashEntry<D> | EmDashEntry<Partial<D>>,
  options?: GetEmDashRelatedOptions<D>
): Promise<EmDashEntry<D>[]>;
```

`D` is the type of `entry.data` in the published entries. When you give an entry object, TypeScript gets `D` from the type of its `data`. When you give an id, `D` is `Record<string, unknown>`.

You can also set `D` with a type argument. The entry object can then have only some of the keys of `D`, but the result has all of them. You can map the result without a cast:

```ts
interface PostData {
  title: string;
  excerpt: string;
  author: string;
  content: unknown[];
}

// Only some of the keys of PostData.
const { title, excerpt, content } = post.data;
const entry = { id: post.id, data: { title, excerpt, content } };
const related = await getEmDashRelated<PostData>("posts", entry, { limit: 3 });

const cards = related.map(({ id, data }) => ({
  href: `/posts/${id}`,
  title: data.title,
  author: data.author,
}));
```

### EmDash options

`getEmDashRelated()` takes the options of `getRelated()`: `limit` (default `5`), `method` (default `"bm25"`), `fields`, `text`, and `filter`. It also has `locale` and `maxAge`. The `GetEmDashRelatedOptions<D>` type describes them.

| Option   | Type     | Default           | Description                                                                                                                                                   |
| -------- | -------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `locale` | `string` | EmDash selects it | The locale of the entries to read. `getEmDashRelated()` gives it to `getEmDashCollection()`.                                                                  |
| `maxAge` | `number` | `0`               | For how many seconds to use the last full read of the collection again. With `0`, each call reads the collection. Read [Freshness window](#freshness-window). |

The `text` function gets each published entry, and it also gets the entry object that you give. That is why its argument has the type `EmDashEntry<Partial<D>>`, and each key of `entry.data` can be `undefined`.

The `filter` function gets only published entries, so its argument has the type `EmDashEntry<D>`.

When you do not set `locale`, EmDash selects the locale as follows (emdash 1.3.1):

- A request with a preview token or with the edit-mode cookie uses the locale of the request.
- Other requests use the default locale when the site has more than one locale.
- On a site with one locale, EmDash does not filter by locale.

With more than one locale, a page in another locale therefore gets the entries of the default locale. To compare the entries in the locale of the page, set `locale`:

```ts
await getEmDashRelated("posts", post, {
  limit: 3,
  locale: Astro.currentLocale,
});
```

Each locale has its own model.

The default text of an entry has two parts:

1. The string and number values of the content fields in `entry.data`. A Portable Text value becomes plain text: the text of each block, without keys, styles, and marks. Other block types, such as images, are not in the text.
2. The labels of the taxonomy terms of the entry, such as tag and category names.

The default text does not include the values that EmDash adds to each entry. These are `id`, `slug`, `status`, `authorId`, `primaryBylineId`, `createdAt`, `updatedAt`, `publishedAt`, `scheduledAt`, `draftRevisionId`, `liveRevisionId`, `locale`, `translationGroup`, `byline`, `bylines`, and `seo`. It also leaves out term ids and term slugs.

When you set `fields`, the default text reads only those keys. But it reads every value in them, including EmDash system values and all of the properties of terms. Portable Text in those keys still becomes plain text. When you set `text`, your function supplies all of the text.

```ts
// Only read the title, the excerpt, and the content.
await getEmDashRelated("posts", post, {
  fields: ["title", "excerpt", "content"],
});
```

`emdashEntryText(entry, fields?)` from `astro-relatinator/emdash` returns this default text.

To convert Portable Text in your own `text` function, use `portableTextToPlainText()`:

```ts
import {
  getEmDashRelated,
  portableTextToPlainText,
} from "astro-relatinator/emdash";

await getEmDashRelated("posts", post, {
  text: (entry) =>
    `${entry.data.title} ${portableTextToPlainText(entry.data.content)}`,
});
```

### Which entries are compared

The model holds only the published entries of the collection. `getEmDashRelated()` reads all pages of the collection with `getEmDashCollection()`.

EmDash uses the slug of an entry as its id. A preview of a published entry therefore has the id of the published entry, unless the draft changes the slug. EmDash also keeps each entry in a content row, and puts the id of this row in `entry.data.id`. A draft or a preview has the same `data.id` as the published entry, even when the draft changes the slug.

- If you give an id, `getEmDashRelated()` uses the published text of that entry. If the id is not published, it throws an error.
- If you give an entry object, `getEmDashRelated()` makes the text of the object. It uses `text` or `fields` when you set them.
- If this text is the published text of the same id, you get the same result as for the id.
- If not, `getEmDashRelated()` uses the text of the object. This happens with a preview that has changes and with a draft that changes the slug. It also happens with a draft of an entry that was never published. The result does not contain the id of the object. It also does not contain a published entry with the same `data.id`, such as the published version of a draft with a new slug.
- If EmDash returns an error, `getEmDashRelated()` throws an error that names the collection.

In emdash 1.3.1, a read during a preview includes the draft of the previewed entry. A read in edit mode includes all drafts. A call in these requests does not use a [freshness window](#freshness-window), so the model and the entry object have the same text. The text of the object changes the list in these cases:

- With emdash 1.0.0, a read during a preview includes no drafts. A preview with changes therefore gets the list for its own text.
- Outside a preview and edit mode, the text of the object can differ from the model. This happens when your page changes the object, or when an entry changed after a freshness window read the collection.

Keep `data.id` in the entry object that you give, also when your page makes its own object. Without `data.id`, the result can contain the published version of a draft with a new slug. In a preview of such a draft, that version is usually the first related entry.

### Caching on servers and Workers

EmDash sites render on request, and `getEmDashRelated()` reads the collection on each call. It keeps one model for each locale until an entry changes. To find changes, it compares the id and the text of each entry. The [Limitations](#limitations) section explains how the cache works on Node.js servers and on Cloudflare Workers.

For the measured time of a call with and without a cached model, read the [3.1.0 changelog](https://github.com/DBozhinovski/relatinator/blob/master/packages/astro-relatinator/CHANGELOG.md#310---2026-10-16) and the [workerd measurement](https://github.com/DBozhinovski/relatinator/blob/master/docs/architecture.md#workerd-measurement-of-getemdashrelated).

#### Freshness window

On each call, the change check reads all published entries and makes their text. It does this even when the model is in the cache. In local workerd with local D1 and 1,005 posts, a call with a cached model took 215 ms. The same page without the call took 12 ms.

To skip the change check for a while, set `maxAge` to a number of seconds:

```ts
await getEmDashRelated("posts", post, { limit: 3, maxAge: 60 });
```

- If the last full read is less than `maxAge` seconds old, the call does not read the collection. It also does not make the text of the entries. It uses the entries and the model of that read. In the same measurement, this call took 2 ms.
- After the window ends, the next call reads the collection and finds the changes. Then a new window starts.
- The last full read must be for the same collection, locale, `method`, and `fields` or `text`. Each locale therefore has its own window.
- A call without `maxAge` always reads the collection. If a window exists for the same options, this read starts a new window.
- A call in a preview or in edit mode does not use a window and does not keep its read. In emdash 1.3.1, these reads include drafts. A window with such a read would show drafts on public pages.
- In other requests, an entry object uses the model of the window with its own text.
- `maxAge` must be a number of 0 or more. Other values cause a `RangeError`. `Infinity` keeps the first read for the life of the process or isolate.

The tradeoff is stale lists. Inside the window, the related lists do not show changes published after the read. A new entry is not in the lists. An unpublished or deleted entry can stay in the lists, with a link to a page that does not exist. A list can be up to `maxAge` seconds old.

Each Node.js process and each Workers isolate keeps its own window and its own model. Two isolates can therefore show different lists for the same entry, until the window of each isolate ends.

The window uses `Date.now()`. In a Workers isolate, `Date.now()` does not change while code runs, but it changes between requests. The window therefore still ends correctly between requests.

With `text`, two functions with the same source code share one window. Inside the window, the call does not run your function for the published entries. Two pages can use `text` functions with the same source code but different results. In that case, do not use `maxAge`, or make the source code different.

## EmDash topic suggestions

`astro-relatinator/emdash-plugin` is an EmDash plugin that adds a "Suggested topics" panel to the entry editor. The panel suggests terms from the taxonomies of the collection, such as categories and tags. The user selects the terms to add, and the plugin never adds a term on its own.

The plugin reads only EmDash taxonomies, not other fields such as a `multiSelect` field with tags. If your site keeps its tags in a `multiSelect` field, move them to a taxonomy before you use the plugin. Then change your templates to read the terms of the entry. In the entry data, `terms` holds the terms of each taxonomy by taxonomy name, for example `post.data.terms.tag`. `getEntryTerms()` from `emdash` also returns them.

The panel scores the terms with `classify()` from [`relatinator`](https://github.com/DBozhinovski/relatinator/tree/master/packages/relatinator#classifytopics-text-options). Each term becomes a topic. The term slug is the tag of the topic, and the term label plus the term description make its description.

### Install the plugin

Use `emdash` 1.3.1 or later. [Compatibility](#compatibility) lists what was checked. Install the package next to `emdash`:

```sh
npm install astro-relatinator
```

Add the plugin to `plugins` in the EmDash integration:

```js
// astro.config.mjs
import emdash from "emdash/astro";
import relatinatorTopics from "astro-relatinator/emdash-plugin";

export default defineConfig({
  integrations: [
    emdash({
      // database, storage, and other options
      plugins: [relatinatorTopics()],
    }),
  ],
});
```

To show the panel only in some collections, give their slugs:

```js
relatinatorTopics({ collections: ["posts"] });
```

The plugin can also run in the plugin sandbox. Put it in `sandboxed` instead of `plugins`, and set a sandbox runner. On Cloudflare, the runner is `sandbox()` from `@emdash-cms/cloudflare`. It needs a Worker Loader binding named `LOADER` in `wrangler.jsonc`, which is available on the Workers paid plans:

```js
// astro.config.mjs
import { d1, r2, sandbox } from "@emdash-cms/cloudflare";
import emdash from "emdash/astro";
import relatinatorTopics from "astro-relatinator/emdash-plugin";

export default defineConfig({
  integrations: [
    emdash({
      database: d1({ binding: "DB" }),
      storage: r2({ binding: "MEDIA" }),
      sandboxed: [relatinatorTopics()],
      sandboxRunner: sandbox(),
    }),
  ],
});
```

```jsonc
// wrangler.jsonc
"worker_loaders": [{ "binding": "LOADER" }],
```

In the sandbox, the plugin can use only the capabilities that it asks for: `content:read` and `taxonomies:write`. Users with the `content:edit_own` permission can use the panel. In EmDash 1.3.1, the Author role and the roles above it have this permission. Contributors have only `content:edit_own_drafts`, so they cannot use the panel. EmDash also checks that the user can edit that entry.

### What users see

The panel shows one group of check boxes for each taxonomy of the collection. Each suggested term shows its label and up to 3 words of the entry that matched it, best match first. The panel does not suggest a term that the entry already has. It shows the assigned terms on a line below the suggestions. This example is from a post about a related-post classifier, with the tags of darko.io:

```text
Tags
[ ] guest: post, blog, published
[ ] rest: post, get, api
[ ] shorts: post, note, quick
Assigned terms: astro, nlp
```

The words tell you why the panel suggests a term. In this example, they are general words of any blog post, so none of the three suggestions is good. Specific words usually mean a good suggestion, such as "supertokens: supertokens, authenticated, providers" for a post about authentication. Each word is the first word of the entry with that word stem, in lower case. That is why the term "conference" can show the word "conferences".

The panel does not show a score. The score from `classify()` is relative to the best term of the taxonomy. The best term therefore always has 100%, even when it is a bad match.

1. Open a saved entry in the editor.
2. In "Suggested topics", select the terms to add.
3. Click "Add selected terms". The panel adds the terms. Then the admin loads the entry page again, so the taxonomy fields show the new terms.

The panel shows a message in these cases:

- The collection has no taxonomy.
- The taxonomies have no terms.
- No term matches the saved text of the entry.

When a term has no description, the panel shows "Descriptions improve suggestions".

### Write term descriptions

A term without a description matches only through its slug and its label. For better suggestions, give each term a description in the EmDash admin. Name the specific things that your entries mention, such as projects, tools, places, and events. Use 10 to 25 words. When the panel suggests a wrong term, look at its words. They show the general words to remove from its description. [Best practices for topic lists](https://github.com/DBozhinovski/relatinator/tree/master/packages/relatinator#best-practices-for-topic-lists) has more about how to write them.

### How the panel gets the text

The panel uses the [default EmDash text](#emdash-options) of the entry, without the labels of the assigned terms. With those labels in the text, each assigned term would match its own label and get the best score. The other terms would then fall below the cut.

`classify()` runs one time for each taxonomy, with its defaults: `ratio` 0.5 and `limit` 3. Each taxonomy therefore gets at most 3 suggestions, before the panel removes the assigned terms. The panel reads the terms in the locale of the entry.

### Limits of the panel

- The panel reads the saved entry, not the changes that are not saved in the editor.
- After the panel adds terms, the admin loads the entry page again. This reload loses the changes that the editor did not save yet. The editor saves changes automatically after a short time. Wait until the Save button shows "Saved" before you add terms.
- In the sandbox, EmDash sets limits for each call of the plugin. On Cloudflare, the default limits are 50 ms of CPU time and 10 subrequests. A panel request reads the entry, the taxonomies, the assigned terms, and the terms of each taxonomy of the collection. An add also writes the terms of each taxonomy with selected terms. A collection with many taxonomies or many terms can go above these limits. The checks ran in local workerd only, not on Cloudflare.
- The panel does not make new terms. It suggests only the terms that exist.
- The panel reads only taxonomies, not `multiSelect` fields.
- The tokenizer is for English text.

## Migrating from 2.x

Version 3.0 removes the old API. Make these changes:

1. Remove all options from `relatinator()` in your Astro config. In a type-checked config (`astro.config.ts`, or a file with `// @ts-check`), the 2.x options cause a type error. In a config without type checks, version 3.0 ignores the options and logs a warning. You can also remove the integration.
2. Remove `BM25Utils` and `TfIdfUtils` from your pages. Call `getRelated()` instead.
3. Use entry ids, not titles. Version 2.x used the `title` frontmatter field as the id. `getRelated()` uses `entry.id` and returns entries.
4. Replace `schema` with `fields`. Replace `similarityMethod` with `method`. The `paths` option has no replacement, because `getRelated()` reads the collection with `getCollection()`.
5. Note the new default method. Version 2.x used TF-IDF by default, and version 3.0 uses BM25. To keep the old method, set `method: "tfidf"`.

In version 2.x, `findRelated` returns the `title` frontmatter field of each related entry, not the entry id. A lookup by `post.id` therefore finds no entries. This 2.x example finds the entries by title:

```astro
---
import { getCollection } from "astro:content";
import { BM25Utils } from "astro-relatinator";

const posts = await getCollection("posts");
const post = posts[0];
// 2.x returns frontmatter titles, not entry ids.
const titles = await BM25Utils.findRelated(`${post.data.title} ${post.body}`, post.data.title, 3);
const related = titles.map((title) => posts.find((p) => p.data.title === title));
---
```

In version 3.0, one call replaces this code:

```astro
---
import { getCollection } from "astro:content";
import { getRelated } from "astro-relatinator";

const posts = await getCollection("posts");
const related = await getRelated("posts", posts[0], { limit: 3 });
---
```

## Development

This package is part of a pnpm workspace. The repository README lists the workspace commands under [Development](https://github.com/DBozhinovski/relatinator#development). [docs/architecture.md](https://github.com/DBozhinovski/relatinator/blob/master/docs/architecture.md) has the design decisions and the verification.

Run these commands from the repository root:

| Command                                        | What it does                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter astro-relatinator build`        | Deletes `dist` and compiles `src` with `tsc`. Then `scripts/bundle-sandbox.js` bundles the plugin entry into one file, `dist/emdash-plugin-entry.js`, with esbuild.                                                                                                                                                                      |
| `pnpm --filter astro-relatinator test`         | Builds `relatinator` in `pretest`, then runs the Vitest tests. The tests replace `astro:content` and `emdash` with stubs.                                                                                                                                                                                                                |
| `pnpm --filter astro-relatinator check`        | Builds `relatinator` in `precheck`, then type-checks `src` and `test` with `tsc`.                                                                                                                                                                                                                                                        |
| `pnpm --filter astro-relatinator test:sandbox` | Runs `build`. Then `scripts/check-sandbox.js` makes sure that `dist/emdash-plugin-entry.js` imports no other module, and that EmDash can find it with `require.resolve()`.                                                                                                                                                               |
| `pnpm --filter astro-relatinator format:check` | Checks the format with Prettier. `format` writes the changes.                                                                                                                                                                                                                                                                            |
| `pnpm --filter astro-relatinator bench`        | Builds `relatinator` and this package. Then it times `getEmDashRelated()` and `getRelated()` on synthetic posts in memory, without Astro and without a database. `--size` sets the number of posts (default `1005`). `--runs` sets the number of runs (default `5`). `--dist` sets the `dist` directory to time (default: this package). |

The tests do not run Astro. To test a change in a real Astro site, build the playground and compare its [expected related lists](https://github.com/DBozhinovski/relatinator/tree/master/packages/playground#expected-related-lists).

The `prepack` script runs `test:sandbox`, so `pnpm pack` and `pnpm publish` always include a new build. They stop if the plugin entry is not one file.

## License

MIT
