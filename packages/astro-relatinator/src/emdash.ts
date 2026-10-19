import type { QueryOptions, RelatinatorModel } from "relatinator";
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
 * published, that object. Thus its data is a part of `D`. `filter` gets
 * only published entries.
 */
export interface GetEmDashRelatedOptions<
  D extends object = Record<string, unknown>,
> extends RelatedOptions<EmDashEntry<Partial<D>>, EmDashEntry<D>> {
  /**
   * The locale of the entries to read. `getEmDashCollection()` gets it.
   * Default: EmDash selects the locale.
   */
  locale?: string;
}

const PAGE_SIZE = 100;

/** The published entries of a collection, and the locale of the query. */
interface PublishedEntries<D extends object> {
  readonly entries: EmDashEntry<D>[];
  /** Tells an unset locale apart from each locale, also from "". */
  readonly localeKey: string;
}

async function getPublishedEntries<D extends object>(
  collection: string,
  locale: string | undefined
): Promise<PublishedEntries<D>> {
  // Imported on call so that astro.config can import this package.
  const { getEmDashCollection, getRequestContext } = await import("emdash");
  // Without `locale`, EmDash queries the locale of the request context
  // (emdash 1.3.1 `resolveLocale()` in `src/i18n/resolve.ts`).
  const effective = locale ?? getRequestContext()?.locale;
  const entries: EmDashEntry<D>[] = [];
  let cursor: string | undefined;
  do {
    const page = await getEmDashCollection(collection, {
      status: "published",
      limit: PAGE_SIZE,
      cursor,
      ...(locale === undefined ? {} : { locale }),
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
  return {
    entries,
    localeKey: effective === undefined ? "" : `locale:${effective}`,
  };
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
  const { entries, localeKey } = await getPublishedEntries<D>(
    collection,
    options.locale
  );
  const index = relatedIndex<EmDashEntry<D>>(
    {
      key: `emdash\u0000${collection}\u0000${localeKey}`,
      entries,
      textOf,
      // EmDash keeps `updatedAt` when only the terms or bylines of an
      // entry change, so the version is the text.
      versionOf: textOf,
    },
    options
  );
  return index.entries(
    rank(index.model, collection, entry, textOf, index.query(options))
  );
}

function rank<E extends EmDashEntry<object>>(
  model: RelatinatorModel,
  collection: string,
  entry: E | string,
  textOf: (entry: E) => string,
  query: QueryOptions
): string[] {
  const id = typeof entry === "string" ? entry : entry.id;
  if (model.has(id)) return model.findRelated(id, query);
  if (typeof entry === "string") {
    throw new Error(
      `astro-relatinator: no published entry "${id}" in EmDash collection "${collection}"`
    );
  }
  return model.findRelatedToText(textOf(entry), { ...query, exclude: [id] });
}
