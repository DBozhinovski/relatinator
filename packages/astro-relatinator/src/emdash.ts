import type { RelatinatorModel } from "relatinator";
import { emdashEntryText } from "./emdash-text.js";
import type { ContentEntry } from "./entry-text.js";
import { portableTextToPlainText } from "./portable-text.js";
import { relatedIndex, type RelatedOptions } from "./related-index.js";

export { portableTextToPlainText };

/** The entry type when `getEmDashRelated` gets an id. */
export interface EmDashEntry {
  readonly id: string;
  readonly data: Record<string, unknown>;
}

export type GetEmDashRelatedOptions<E> = RelatedOptions<E>;

const PAGE_SIZE = 100;

async function getPublishedEntries<E extends ContentEntry>(
  collection: string
): Promise<E[]> {
  // Imported on call so that astro.config can import this package.
  const { getEmDashCollection } = await import("emdash");
  const entries: E[] = [];
  let cursor: string | undefined;
  do {
    const page = await getEmDashCollection(collection, {
      status: "published",
      limit: PAGE_SIZE,
      cursor,
    });
    if (page.error) {
      throw new Error(
        `astro-relatinator: cannot read EmDash collection "${collection}": ${page.error.message}`,
        { cause: page.error }
      );
    }
    entries.push(...(page.entries as E[]));
    cursor = page.nextCursor;
  } while (cursor);
  return entries;
}

/**
 * Finds the published entries of an EmDash `collection` that are most
 * related to `entry`, in rank order. The model is built once and reused
 * until an entry changes.
 */
export function getEmDashRelated<E extends ContentEntry>(
  collection: string,
  entry: E,
  options?: GetEmDashRelatedOptions<E>
): Promise<E[]>;
export function getEmDashRelated<E extends ContentEntry = EmDashEntry>(
  collection: string,
  entry: string,
  options?: GetEmDashRelatedOptions<E>
): Promise<E[]>;
export async function getEmDashRelated<E extends ContentEntry>(
  collection: string,
  entry: E | string,
  options: GetEmDashRelatedOptions<E> = {}
): Promise<E[]> {
  const { text, fields } = options;
  const textOf = text ?? ((e: E) => emdashEntryText(e, fields));
  const index = relatedIndex(
    {
      key: `emdash\u0000${collection}`,
      entries: await getPublishedEntries<E>(collection),
      textOf,
      // EmDash keeps `updatedAt` when only the terms or bylines of an
      // entry change, so the version is the text.
      versionOf: textOf,
    },
    options
  );
  return index.entries(
    rank(index.model, collection, entry, textOf, options.limit)
  );
}

function rank<E extends ContentEntry>(
  model: RelatinatorModel,
  collection: string,
  entry: E | string,
  textOf: (entry: E) => string,
  limit: number | undefined
): string[] {
  const id = typeof entry === "string" ? entry : entry.id;
  if (model.has(id)) return model.findRelated(id, { limit });
  if (typeof entry === "string") {
    throw new Error(
      `astro-relatinator: no published entry "${id}" in EmDash collection "${collection}"`
    );
  }
  return model.findRelatedToText(textOf(entry), { limit, exclude: [id] });
}
