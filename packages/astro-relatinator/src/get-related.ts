import type { CollectionEntry, CollectionKey } from "astro:content";
import { entryText, type ContentEntry } from "./entry-text.js";
import { relatedIndex, type RelatedOptions } from "./related-index.js";

export type GetRelatedOptions<E> = RelatedOptions<E>;

/**
 * Finds the entries of `collection` that are most related to `entry`,
 * in rank order. The model is built once and reused until an entry
 * changes.
 */
export async function getRelated<C extends CollectionKey>(
  collection: C,
  entry: CollectionEntry<C> | string,
  options: GetRelatedOptions<CollectionEntry<C>> = {}
): Promise<CollectionEntry<C>[]> {
  const { text, fields } = options;
  // Imported on call so that astro.config can import the integration.
  const { getCollection } = await import("astro:content");
  const entries: ContentEntry[] = await getCollection(collection);
  const textOf = text ?? ((e: ContentEntry) => entryText(e, fields));
  const index = relatedIndex(
    {
      key: String(collection),
      entries,
      textOf,
      versionOf: (e) => (!text && e.digest ? e.digest : textOf(e)),
    },
    options
  );
  const id = typeof entry === "string" ? entry : entry.id;
  if (!index.model.has(id)) {
    throw new Error(
      `astro-relatinator: no entry "${id}" in collection "${String(collection)}"`
    );
  }
  return index.entries(index.model.findRelated(id, { limit: options.limit }));
}
