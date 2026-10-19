# astro-relatinator

Find related entries in your Astro content collections.

This package wraps [relatinator](https://github.com/DBozhinovski/relatinator/tree/master/packages/relatinator). It scores entries with BM25 (default) or TF-IDF.

## Compatibility

- Astro 6 and Astro 7. The `astro` peer dependency is `^6.0.0 || ^7.0.0`.
- Node.js 22.12 or later.
- Static output and on-demand rendering.
- The Cloudflare adapter, also when the adapter prerenders pages in workerd.
- EmDash 1.x (1.0 or later), for `astro-relatinator/emdash` only. The optional `emdash` peer dependency is `^1.0.0`.
- EmDash 1.3.1 or later, for the `astro-relatinator/emdash-plugin` plugin. The checks used EmDash 1.3.1 only.
- ES modules only, with TypeScript type declarations.

For the checks behind this list, read [Verification](https://github.com/DBozhinovski/relatinator/blob/master/docs/architecture.md#verification).

## Installation

```sh
npx astro add astro-relatinator
```

You can also install the package without `astro add`:

```sh
npm install astro-relatinator
```

The integration is optional. `getRelated()` works without an entry in `integrations`. [How it works](#how-it-works) gives the reason. The `astro add` command adds `relatinator()` to your config. You can keep it or remove it.

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import relatinator from "astro-relatinator";

export default defineConfig({
  integrations: [relatinator()],
});
```

## Usage

Call `getRelated()` in the frontmatter of a page. Give it the collection name and an entry (or the id of an entry). It returns the related entries of the same collection, most related first.

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

`getRelated()` throws an error if the collection has no entry with the given id.

## Options

| Option   | Type                  | Default    | Description                                                                                     |
| -------- | --------------------- | ---------- | ----------------------------------------------------------------------------------------------- |
| `limit`  | `number`              | `5`        | The maximum number of related entries.                                                          |
| `method` | `"bm25"` or `"tfidf"` | `"bm25"`   | The scoring method.                                                                             |
| `fields` | `readonly string[]`   | all fields | The `data` keys to read. The body is always read.                                               |
| `text`   | `(entry) => string`   | none       | A function that returns the full text of an entry. It replaces the default.                     |
| `filter` | `(entry) => boolean`  | none       | Keeps an entry in the results only when the function returns `true`. It applies before `limit`. |

The default text of an entry has two parts:

1. All string and number values in `entry.data`, also in arrays and nested objects. `getRelated()` does not read dates, booleans, or `null`. When you set `fields`, it reads only those keys.
2. The body of the entry (`entry.body`), when the entry has one.

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

`filter` changes only the results. The model contains all entries of the collection, so the scores do not change. Because `filter` applies before `limit`, the result has `limit` entries when enough entries match.

## How it works

`getRelated()` reads the collection with `getCollection()` each time that a page calls it. It does not read files when Astro starts, and it does not watch files.

### The model cache

`getRelated()` builds one model for each combination of collection, `method`, and `fields` (or `text`). `limit` and `filter` do not change the model. Later calls use the same model while the collection does not change. Thus a build with many pages builds each model one time.

To find changes, `getRelated()` compares the id and the `digest` of each entry. Entries from the built-in loaders have a digest. If an entry has no digest, it compares the text of the entry.

When you use `text`, it compares the text that your function returns. Your function runs for each entry on each call.

In `astro dev`, the related entries update when you edit a content file. You do not need to restart the server.

### Why the integration is optional

`getRelated()` imports `astro:content`, and only Vite can resolve this module. Astro processes `astro-relatinator` with Vite because the package has an `astro` peer dependency, the `astro` keyword, and a name that starts with `astro-`. Thus `getRelated()` works with or without the integration. For the details, read [The integration is optional](https://github.com/DBozhinovski/relatinator/blob/master/docs/architecture.md#the-integration-is-optional).

## Limitations

- With on-demand rendering, each Node.js process or Cloudflare Workers isolate builds its own model on the first call. The cache is in memory. A new process or isolate starts with an empty cache.
- Each call reads the whole collection. With `text`, and on EmDash, each call also makes the text of every entry to find changes. The time for a call and for a model build grows with the size of the collection.
- The cache keeps a model for each set of options that your pages use. It does not remove models.
- The related entries come from the collection that you give. `getRelated()` does not compare entries across collections.
- `filter` does not remove entries from the model. All entries of the collection change the weights of the terms.
- `getEmDashRelated()` ranks only published entries. [Which entries are compared](#which-entries-are-compared) tells how it uses a draft or a preview.
- The tokenizer is for English text. [How scoring works](https://github.com/DBozhinovski/relatinator/tree/master/packages/relatinator#how-scoring-works) gives the steps.

## EmDash

[EmDash](https://github.com/emdash-cms/emdash) keeps content in a database, not in content collections. For EmDash sites, use `getEmDashRelated()` from `astro-relatinator/emdash`. It uses the same scoring and the same model cache as `getRelated()`.

It needs `emdash` 1.x (1.0 or later). Install the package next to `emdash`:

```sh
npm install astro-relatinator
```

You do not need the integration in `astro.config.mjs`.

### Usage

Give `getEmDashRelated()` the collection slug and an entry (or the id of an entry). It returns the related entries, most related first.

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

The result contains the published entries from the collection, not copies of the entry that you give. The types are:

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

To set `D`, give it as a type argument. Then the entry object can have only some of the keys of `D`. The result has all of the keys of `D`, so you can map it without a cast:

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

The options are the same as for `getRelated()`: `limit` (default `5`), `method` (default `"bm25"`), `fields`, `text`, and `filter`. `getEmDashRelated()` also has `locale`. The `GetEmDashRelatedOptions<D>` type describes them.

| Option   | Type     | Default           | Description                                                                                  |
| -------- | -------- | ----------------- | -------------------------------------------------------------------------------------------- |
| `locale` | `string` | EmDash selects it | The locale of the entries to read. `getEmDashRelated()` gives it to `getEmDashCollection()`. |

The `text` function gets each published entry. It also gets the entry object that you give when its id is not in the published entries. Thus the type of its argument is `EmDashEntry<Partial<D>>`, and each key of `entry.data` can be `undefined`.

The `filter` function gets only published entries. Thus the type of its argument is `EmDashEntry<D>`.

When you do not set `locale`, EmDash selects the locale (emdash 1.3.1):

- A request with a preview token or with the edit-mode cookie uses the locale of the request.
- Other requests use the default locale when the site has more than one locale.
- On a site with one locale, EmDash does not filter by locale.

Thus, on a site with more than one locale, a page in a different locale gets the entries of the default locale. To compare the entries of the locale of the page, set `locale`:

```ts
await getEmDashRelated("posts", post, {
  limit: 3,
  locale: Astro.currentLocale,
});
```

Each locale has its own model.

The default text of an entry has two parts:

1. The string and number values of the content fields in `entry.data`. A Portable Text value becomes plain text. The plain text contains the text of each block, without keys, styles, and marks. It does not contain other block types, such as images.
2. The labels of the taxonomy terms of the entry, such as tag and category names.

The default text does not include the values that EmDash adds to each entry. These are `id`, `slug`, `status`, `authorId`, `primaryBylineId`, `createdAt`, `updatedAt`, `publishedAt`, `scheduledAt`, `draftRevisionId`, `liveRevisionId`, `locale`, `translationGroup`, `byline`, `bylines`, and `seo`. The default text also leaves out term ids and term slugs.

When you set `fields`, the default text reads only those keys. It reads all of the values in those keys, including EmDash system values and all of the properties of terms. Portable Text in those keys still becomes plain text. When you set `text`, your function gives all of the text.

```ts
// Only read the title, the excerpt, and the content.
await getEmDashRelated("posts", post, {
  fields: ["title", "excerpt", "content"],
});
```

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

The model contains only the published entries of the collection. `getEmDashRelated()` reads all pages of the collection with `getEmDashCollection()`.

EmDash uses the slug of an entry as its id. Thus a preview of a published entry has the id of the published entry, unless the draft changes the slug.

- If you give the id of an entry that is not published, `getEmDashRelated()` throws an error.
- If you give an entry object whose id is in the published entries, `getEmDashRelated()` uses the published text of that id. It does not read the text of the object. For a preview of a published entry, the related entries come from the published text, not from the preview text.
- If you give an entry object whose id is not in the published entries, `getEmDashRelated()` uses the text of the object. An example is a draft of an entry that was never published. The result does not contain that id.
- If EmDash returns an error, `getEmDashRelated()` throws an error that names the collection.

### Caching on servers and Workers

EmDash sites render on request. `getEmDashRelated()` reads the collection on each call. It keeps one model for each locale until an entry changes. To find changes, it compares the id and the text of each entry. [Limitations](#limitations) tells how the cache works on Node.js servers and on Cloudflare Workers.

For the measured time of a call with and without a cached model, read the [3.1.0 changelog](https://github.com/DBozhinovski/relatinator/blob/master/packages/astro-relatinator/CHANGELOG.md#310---2026-10-16).

## EmDash topic suggestions

`astro-relatinator/emdash-plugin` is an EmDash plugin. It adds a "Suggested topics" panel to the entry editor. The panel suggests terms from the taxonomies of the collection, such as categories and tags. The user selects the terms to add. The plugin does not add a term without the user.

The panel scores the terms with `classify()` from [`relatinator`](https://github.com/DBozhinovski/relatinator/tree/master/packages/relatinator#classifytopics-text-options). Each term is a topic. The tag of the topic is the term slug. The description of the topic is the term label and the term description.

### Install the plugin

The plugin needs `emdash` 1.3.1 or later. Install the package next to `emdash`:

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

The plugin asks for the `content:read` and `taxonomies:write` capabilities. Users with the `content:edit_own` permission can use the panel. In EmDash 1.3.1, the Author role and the roles above it have this permission. Contributors have only `content:edit_own_drafts`, so they cannot use the panel. EmDash also checks that the user can edit that entry.

### What users see

The panel shows one group of check boxes for each taxonomy of the collection. Each suggested term shows its score as a percent of the best score in its taxonomy. The panel does not suggest a term that the entry already has. It shows the assigned terms in a line below the suggestions.

1. Open a saved entry in the editor.
2. In "Suggested topics", select the terms to add.
3. Click "Add selected terms". The panel adds the terms. Then the admin loads the entry page again, so the taxonomy fields show the new terms.

The panel shows a message in these conditions:

- The collection has no taxonomy.
- The taxonomies have no terms.
- No term matches the saved text of the entry.

When a term has no description, the panel shows "Descriptions improve suggestions".

### Write term descriptions

A term without a description matches only through its slug and its label. To get better suggestions, give each term a description in the EmDash admin. Write the names of the specific things that your entries mention, such as projects, tools, places, and events. Use 10 to 25 words. [Best practices for topic lists](https://github.com/DBozhinovski/relatinator/tree/master/packages/relatinator#best-practices-for-topic-lists) tells you how to write them.

### How the panel gets the text

The text of the entry is the [default EmDash text](#emdash-options), without the labels of the assigned terms. Otherwise, each assigned term matches its own label and gets the best score. Then the other terms fall below the cut.

`classify()` runs one time for each taxonomy, with its defaults: `ratio` 0.5 and `limit` 3. Thus each taxonomy gets at most 3 suggestions, before the panel removes the assigned terms. The panel reads the terms in the locale of the entry.

### Limits of the panel

- The panel reads the saved entry. It does not read the changes that are not saved in the editor.
- After the panel adds terms, the admin loads the entry page again. This reload loses the changes that the editor did not save yet. The editor saves changes automatically after a short time. Wait until the Save button shows "Saved" before you add terms.
- The plugin runs in `plugins: []` only. EmDash reads the entry file of a plugin in `sandboxed: []` as one module, and this entry file imports other modules. Thus the plugin does not load in the sandbox.
- The panel does not make new terms. It suggests only the terms that exist.
- The tokenizer is for English text.

## Migrating from 2.x

Version 3.0 removes the old API. Make these changes:

1. Remove all options from `relatinator()` in your Astro config. In a type-checked config (`astro.config.ts`, or a file with `// @ts-check`), the 2.x options cause a type error. In a config without type checks, version 3.0 ignores the options and logs a warning. You can also remove the integration.
2. Remove `BM25Utils` and `TfIdfUtils` from your pages. Call `getRelated()` instead.
3. Use entry ids, not titles. Version 2.x used the `title` frontmatter field as the id. `getRelated()` uses `entry.id` and returns entries.
4. Replace `schema` with `fields`. Replace `similarityMethod` with `method`. The `paths` option has no replacement, because `getRelated()` reads the collection with `getCollection()`.
5. Note the new default method. Version 2.x used TF-IDF by default. Version 3.0 uses BM25. Set `method: "tfidf"` to keep the old method.

In version 2.x, `findRelated` returns the `title` frontmatter field of each related entry, not the entry id. Thus a lookup by `post.id` finds no entries. This 2.x example finds the entries by title:

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

This package is part of a pnpm workspace. For the workspace commands, read [Development](https://github.com/DBozhinovski/relatinator#development) in the repository README. For the design decisions and the verification, read [docs/architecture.md](https://github.com/DBozhinovski/relatinator/blob/master/docs/architecture.md).

Run these commands from the repository root:

| Command                                        | What it does                                                                                                                                                                                                                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter astro-relatinator build`        | Deletes `dist` and compiles `src` with `tsc`.                                                                                                                                                                                                                                                                                            |
| `pnpm --filter astro-relatinator test`         | Builds `relatinator` in `pretest`. Then it runs the Vitest tests. The tests replace `astro:content` and `emdash` with stubs.                                                                                                                                                                                                             |
| `pnpm --filter astro-relatinator check`        | Builds `relatinator` in `precheck`. Then it type-checks `src` and `test` with `tsc`.                                                                                                                                                                                                                                                     |
| `pnpm --filter astro-relatinator format:check` | Checks the format with Prettier. `format` writes the changes.                                                                                                                                                                                                                                                                            |
| `pnpm --filter astro-relatinator bench`        | Builds `relatinator` and this package. Then it times `getEmDashRelated()` and `getRelated()` on synthetic posts in memory, without Astro and without a database. `--size` sets the number of posts (default `1005`). `--runs` sets the number of runs (default `5`). `--dist` sets the `dist` directory to time (default: this package). |

The tests do not run Astro. To test a change in a real Astro site, build the playground and compare its [expected related lists](https://github.com/DBozhinovski/relatinator/tree/master/packages/playground#expected-related-lists).

The `prepack` script runs `build`. Thus `pnpm pack` and `pnpm publish` always include a new build.

## License

MIT
