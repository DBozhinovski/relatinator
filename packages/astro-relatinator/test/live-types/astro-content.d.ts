// The live collection types that `astro sync` generates for
// `live.config.ts`. The helper types are copies from astro 7.3.8
// `templates/content/types.d.ts`.
declare module "astro:content" {
  export type LiveContentConfig = typeof import("./live.config.js");

  type ExtractLoaderTypes<T> = T extends import("astro/loaders").LiveLoader<
    infer TData,
    infer TEntryFilter,
    infer TCollectionFilter,
    infer TError
  >
    ? {
        data: TData;
        entryFilter: TEntryFilter;
        collectionFilter: TCollectionFilter;
        error: TError;
      }
    : {
        data: never;
        entryFilter: never;
        collectionFilter: never;
        error: never;
      };
  type ExtractDataType<T> = ExtractLoaderTypes<T>["data"];

  type LiveLoaderDataType<C extends keyof LiveContentConfig["collections"]> =
    LiveContentConfig["collections"][C]["schema"] extends undefined
      ? ExtractDataType<LiveContentConfig["collections"][C]["loader"]>
      : import("astro/zod").infer<
          Exclude<LiveContentConfig["collections"][C]["schema"], undefined>
        >;
}
