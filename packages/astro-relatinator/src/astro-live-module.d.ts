// The live collection types of `astro:content` that this package reads.
// Astro generates them in each project (`templates/content/types.d.ts`
// in astro 7.3.8). The `astro/client` placeholder does not have them, so
// the build declares the most general form.
declare module "astro:content" {
  export type LiveContentConfig = {
    collections: Record<string, unknown>;
  };
  export type LiveLoaderDataType<_C> = Record<string, unknown>;
}
