# astro-relatinator

Find related entries in your Astro content collections.

This package wraps [relatinator](https://github.com/DBozhinovski/relatinator/tree/master/packages/relatinator). It scores entries with BM25 (default) or TF-IDF.

## Compatibility

- Astro 6 and Astro 7. The `astro` peer dependency is `^6.0.0 || ^7.0.0`.
- Node.js 22.12 or later.
- Static output and on-demand rendering.
- The Cloudflare adapter, also when the adapter prerenders pages in workerd.
- EmDash 1.x (1.0 or later), for `astro-relatinator/emdash` only. The optional `emdash` peer dependency is `^1.0.0`.
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

| Option   | Type                  | Default    | Description                                                                 |
| -------- | --------------------- | ---------- | --------------------------------------------------------------------------- |
| `limit`  | `number`              | `5`        | The maximum number of related entries.                                      |
| `method` | `"bm25"` or `"tfidf"` | `"bm25"`   | The scoring method.                                                         |
| `fields` | `readonly string[]`   | all fields | The `data` keys to read. The body is always read.                           |
| `text`   | `(entry) => string`   | none       | A function that returns the full text of an entry. It replaces the default. |

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
```

## How it works

`getRelated()` reads the collection with `getCollection()` each time that a page calls it. It does not read files when Astro starts, and it does not watch files.

### The model cache

`getRelated()` builds one model for each combination of collection, `method`, and `fields` (or `text`). Later calls use the same model while the collection does not change. Thus a build with many pages builds each model one time.

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

The options are the same as for `getRelated()`: `limit` (default `5`), `method` (default `"bm25"`), `fields`, and `text`. The `GetEmDashRelatedOptions<D>` type describes them.

The `text` function gets each published entry. It also gets the entry object that you give when its id is not in the published entries. Thus the type of its argument is `EmDashEntry<Partial<D>>`, and each key of `entry.data` can be `undefined`.

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

EmDash sites render on request. `getEmDashRelated()` reads the collection on each call. It keeps the model until an entry changes. To find changes, it compares the id and the text of each entry. [Limitations](#limitations) tells how the cache works on Node.js servers and on Cloudflare Workers.

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

| Command                                        | What it does                                                                                                                 |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `pnpm --filter astro-relatinator build`        | Deletes `dist` and compiles `src` with `tsc`.                                                                                |
| `pnpm --filter astro-relatinator test`         | Builds `relatinator` in `pretest`. Then it runs the Vitest tests. The tests replace `astro:content` and `emdash` with stubs. |
| `pnpm --filter astro-relatinator check`        | Builds `relatinator` in `precheck`. Then it type-checks `src` and `test` with `tsc`.                                         |
| `pnpm --filter astro-relatinator format:check` | Checks the format with Prettier. `format` writes the changes.                                                                |

The tests do not run Astro. To test a change in a real Astro site, build the playground and compare its [expected related lists](https://github.com/DBozhinovski/relatinator/tree/master/packages/playground#expected-related-lists).

The `prepack` script runs `build`. Thus `pnpm pack` and `pnpm publish` always include a new build.

## License

MIT
