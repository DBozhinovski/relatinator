import type { RelatinatorModel } from "relatinator";
import { emdashEntryText } from "./emdash-text.js";
import { portableTextToPlainText } from "./portable-text.js";
import { relatedIndex, type RelatedOptions } from "./related-index.js";

export { portableTextToPlainText };

/**
 * An EmDash entry. `D` is the type of `data` in the published entries
 * of the collection.
 */
export interface EmDashEntry<D extends object = Record<string, unknown>> {
  readonly id: string;
  readonly data: D;
}

/**
 * `text` gets the published entries and, for an entry object that is not
 * published, that object. Thus its data is a part of `D`.
 */
export type GetEmDashRelatedOptions<
  D extends object = Record<string, unknown>,
> = RelatedOptions<EmDashEntry<Partial<D>>>;

const PAGE_SIZE = 100;

async function getPublishedEntries<D extends object>(
  collection: string
): Promise<EmDashEntry<D>[]> {
  // Imported on call so that astro.config can import this package.
  const { getEmDashCollection } = await import("emdash");
  const entries: EmDashEntry<D>[] = [];
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
    entries.push(...(page.entries as EmDashEntry<D>[]));
    cursor = page.nextCursor;
  } while (cursor);
  return entries;
}

/**
 * Finds the published entries of an EmDash `collection` that are most
 * related to `entry`, in rank order. The model is built once and reused
 * until an entry changes. `D` is the type of `data` in the published
 * entries. An entry object can have only a part of `D`.
 */
export async function getEmDashRelated<
  D extends object = Record<string, unknown>,
>(
  collection: string,
  // `EmDashEntry<D>` makes inference keep the optional keys of `D`.
  entry: string | EmDashEntry<D> | EmDashEntry<Partial<D>>,
  options: GetEmDashRelatedOptions<D> = {}
): Promise<EmDashEntry<D>[]> {
  const { text, fields } = options;
  const textOf =
    text ?? ((e: EmDashEntry<Partial<D>>) => emdashEntryText(e, fields));
  const index = relatedIndex<EmDashEntry<D>>(
    {
      key: `emdash\u0000${collection}`,
      entries: await getPublishedEntries<D>(collection),
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

function rank<E extends EmDashEntry<object>>(
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
