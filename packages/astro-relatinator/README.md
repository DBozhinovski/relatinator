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

The integration hooks into the Astro build (or dev) process, and will train the model based on the files you've provided. You can then use the utility functions exported by the package (`BM25Utils` or `TfIdfUtils`, depending on your chosen `similarityMethod`) to find related content and terms.

### Example:

```astro
---
import { getCollection } from "astro:content";
// Import the utils corresponding to your configured similarityMethod
// (BM25Utils in this example, matching the config example above)
import { BM25Utils } from "astro-relatinator";

const blogEntries = await getCollection("posts"); // assuming your collection is called posts
// let's say we want to compare against the first blog entry
const first = blogEntries[0];

// Concatenate the same fields we used for training and declare how many related posts we want to find
const related = await BM25Utils.findRelated(`${first.data.title} ${first.data.description} ${first.data.tags.join(' ')} ${first.body}`, first.id, 3)

---

<div>
<!-- render your related posts here -->
{ related.map((id) => {
  const post = blogEntries.find((post) => post.id === id);
  if (!post) return null; // Handle case where post might not be found
  return (
    <a href={`/posts/${post.slug}/`}> {/* Adjust href based on your routing */}
      <h2>{post.data.title}</h2>
      <p>{post.data.description}</p>
    </a>
  );
}) }
</div>

```

**Note:** The `BM25Utils` and `TfIdfUtils` objects also provide `getTopTermsForId` and `getTopRelatedDocumentsForTerm` functions, similar to the core `relatinator` library.

**Development Server:** When running `astro dev`, the integration uses debouncing (a small delay) before re-training the model after a markdown file change. This improves performance for larger sites by preventing rapid, successive re-trains during saves.
