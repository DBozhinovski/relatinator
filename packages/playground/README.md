# Relatinator playground

This Astro 7.3.8 site shows `astro-relatinator` with a content collection of six posts. Each post page lists three related posts from `getRelated("posts", post, { limit: 3 })`. The page uses the default method (BM25) and the default text of each entry. The package is private, so it is not on npm.

The playground is the manual check for changes that affect Astro. The `astro-relatinator` unit tests replace `astro:content` with a stub. The playground uses the real Astro content layer.

- `src/content.config.ts` defines the `posts` collection with the `glob()` loader.
- `src/pages/posts/[id].astro` calls `getRelated()` in a static page. It also calls `classify()` with the topics of `src/topics.ts` and the text of `entryText(post, ["title"])`, as in [Topics for your entries](../astro-relatinator/README.md#topics-for-your-entries).
- `astro.config.mjs` adds the optional `relatinator()` integration.

## Run

From the repository root:

1. Run `pnpm install`.
2. Run `pnpm build`. This command builds the libraries and the playground.
3. Run `pnpm --filter playground dev` and open the URL that Astro shows.

`pnpm --filter playground check` builds the libraries and then runs `astro check`.

## Expected related lists

`pnpm build` writes a static page for each post to `dist/posts/<id>/index.html`. On 2026-10-15, the build gave these related lists:

| Post                   | Related posts, most related first                                      |
| ---------------------- | ---------------------------------------------------------------------- |
| `post-one`             | `science-books-summer`, `science-books-spring`, `science-books-autumn` |
| `science-books-autumn` | `science-books-summer`, `science-books-spring`, `science-books-space`  |
| `science-books-space`  | `science-books-summer`, `science-books-autumn`, `science-books-spring` |
| `science-books-spring` | `science-books-summer`, `science-books-autumn`, `tech-books-2023`      |
| `science-books-summer` | `science-books-autumn`, `science-books-spring`, `tech-books-2023`      |
| `tech-books-2023`      | `science-books-summer`, `science-books-spring`, `science-books-autumn` |

To print the lists after `pnpm build`, run this command in `packages/playground`:

```sh
for f in dist/posts/*/index.html; do
  printf '%s: ' "$(basename "$(dirname "$f")")"
  grep -oE 'href="/posts/[^/"]+/' "$f" | cut -d/ -f3 | paste -sd ' ' -
done
```

The command prints the `/posts/` links of each post page. On a post page, only the related list has `/posts/` links.

A change to the tokenizer, the weights, the default text, or the posts can change the lists. If a list changes, find the cause before you update this table.

## Expected topics

On 2026-10-19, the build gave these topics:

| Post                   | Topics, best first            |
| ---------------------- | ----------------------------- |
| `post-one`             | `life-sciences`               |
| `science-books-autumn` | `life-sciences`               |
| `science-books-space`  | `space`                       |
| `science-books-spring` | `life-sciences`, `technology` |
| `science-books-summer` | `life-sciences`, `technology` |
| `tech-books-2023`      | `technology`                  |

To print the topics after `pnpm build`, run this command in `packages/playground`:

```sh
for f in dist/posts/*/index.html; do
  printf '%s: ' "$(basename "$(dirname "$f")")"
  grep -oE '<ul id="topics"[^>]*>(<li[^>]*>[^<]*</li>)*' "$f" | grep -oE '<li[^>]*>[^<]+' | sed 's/<li[^>]*>//' | paste -sd ' ' -
done
```

The command prints the items of the `topics` list of each post page.

A change to the tokenizer, the weights, `classify()`, the default text, the topics, or the posts can change the topics. If a topic list changes, find the cause before you update this table.
