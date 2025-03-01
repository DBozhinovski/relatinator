## Astro Integration for Relatinator

An Astro integration for the [humble library for finding related posts and content](https://github.com/DBozhinovski/relatinator/tree/master/packages/relatinator).

## Installation

Assuming you're running Astro v3 or later, you can install this integration by running:

```
npx astro add astro-relatinator
```

OR

```
npm install astro-relatinator
```

## Configuration

The integration takes four input arguments, `paths`, `schema`, `similarityMethod`, and `debug`.

- `paths` is an array of paths to the `.md` or `.mdx` files you want to use for training the model. If you're using the [Content Collections API](https://docs.astro.build/en/guides/content-collections/), you can find these at `./src/collections/<collection-name>/`.
- `schema` is an array of frontmatter fields you want to use for training the model.
- `similarityMethod` is the algorithm to use for training the model. Can be `"tfidf"` or `"bm25"`.
- `debug` is a boolean flag to enable debug mode. It gets VERY verbose, so use it with caution.

### Example:

```ts
export default defineConfig({
  // ...
  integrations: [
    // ...
    relatinatorIntegration({
      paths: ["./src/content/posts"], // path yo your content files
      schema: ["title", "descriptions", "tags"], // frontmatter fields to use for training
      similarityMethod: "bm25", // use BM25 for training
      debug: true, // enable debug mode
    }),
    // ...
  ],
});
```

**Note:** the fields you specify in the `schema` array must be present in the frontmatter of the files you're training on. If they're not, the integration will throw an error or lead to unexpected results.

## Usage

The integration hooks into the Astro build (or dev) process, and will train the model based on the files you've provided. You can then use the `findRelated` function from the package to find related content.

### Example:

```astro
---
import { getCollection } from "astro:content";
import { findRelated } from "astro-relatinator";

const blogEntries = await getCollection("posts"); // assuming your collection is called posts
// let's say we want to compare against the first blog entry
const first = blogEntries[0];

// Concatenate the same fields we used for training and declare how many related posts we want to find
const related = findRelated(`${first.frontmatter.title} ${first.frontmatter.description} ${first.frontmatter.tags.join(' ')} ${first.body}`, first.id, 3)

---

<div>
<!-- render your related posts here -->
{ related.map((id) => {
  const post = posts.find((post) => post.id === id);
  return (
    <a href={post.slug}>
      <h2>{post.frontmatter.title}</h2>
      <p>{post.frontmatter.description}</p>
    </a>
  );
}) }
</div>

```
