import { defineCollection, z } from "astro:content";

import { glob } from "astro/loaders";

const posts = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/posts" }),
  schema: z.object({
    title: z.string(),
    date: z.date(),
    author: z.string(),
    categories: z.array(z.string()),
    tags: z.array(z.string()),
  }),
});

// 4. Export a single `collections` object to register your collection(s)
export const collections = { posts };
