import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

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

export const collections = { posts };
