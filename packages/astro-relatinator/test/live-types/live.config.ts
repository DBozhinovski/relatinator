// A `src/live.config.ts` for the type test. Only its types are read.
import { defineLiveCollection } from "astro:content";
import type { LiveLoader } from "astro/loaders";
import { z } from "astro/zod";

declare const productLoader: LiveLoader<{ title: string; price: number }>;
declare const reviewLoader: LiveLoader<{ text: string }>;

export const collections = {
  products: defineLiveCollection({ loader: productLoader }),
  reviews: defineLiveCollection({
    loader: reviewLoader,
    schema: z.object({ text: z.string(), stars: z.number() }),
  }),
};
