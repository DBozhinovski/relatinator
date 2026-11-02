// The docs pages render the repository's Markdown files in place; the site never
// copies them.
import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// Each Markdown source and the docs entry id it renders under.
const DOC_SOURCES: Record<string, string> = {
  "packages/relatinator/README.md": "relatinator",
  "packages/astro-relatinator/README.md": "astro-relatinator",
  "docs/architecture.md": "architecture",
};

export const collections = {
  docs: defineCollection({
    loader: glob({
      pattern: Object.keys(DOC_SOURCES),
      base: "../..",
      generateId: ({ entry }) => DOC_SOURCES[entry],
    }),
    schema: z.object({}),
  }),
  // The six playground posts the demo page ranks in the browser. Only the title
  // is needed at build time; the raw body goes to the client script.
  demoPosts: defineCollection({
    loader: glob({
      base: "../playground/src/content/posts",
      pattern: "*.md",
    }),
    schema: z.object({ title: z.string() }),
  }),
};
