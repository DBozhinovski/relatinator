import type { QueryOptions } from "relatinator";
import { emdashEntryText } from "./emdash-text.js";
import { portableTextToPlainText } from "./portable-text.js";
import {
  modelKey,
  relatedIndex,
  type RelatedIndex,
  type RelatedOptions,
} from "./related-index.js";

export { emdashEntryText, portableTextToPlainText };

/**
 * An EmDash entry. `D` is the type of `data` in the published entries
 * of the collection.
 */
export interface EmDashEntry<D extends object = Record<string, unknown>> {
  readonly id: string;
  readonly data: D;
}

/**
 * `text` gets the published entries and the entry object. Thus its data
 * is a part of `D`. `filter` gets only published entries.
 */
export interface GetEmDashRelatedOptions<
  D extends object = Record<string, unknown>,
> extends RelatedOptions<EmDashEntry<Partial<D>>, EmDashEntry<D>> {
  /**
   * The locale of the entries to read. `getEmDashCollection()` gets it.
   * Default: EmDash selects the locale.
   */
  locale?: string;
  /**
   * Seconds to reuse the last full read of the collection, for the same
   * locale, `method`, and text source. Inside this window, a call does
   * not read the collection and does not find changes. Each process or
   * isolate has its own window. Default: 0, which reads on each call.
   */
  maxAge?: number;
}

const PAGE_SIZE = 100;

type GetEmDashCollection = typeof import("emdash").getEmDashCollection;

async function readPublished<D extends object>(
  getEmDashCollection: GetEmDashCollection,
  collection: string,
  locale: string | undefined
): Promise<EmDashEntry<D>[]> {
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
  return entries;
}

/** A full read of a corpus, for `maxAge`. */
interface RecentRead {
  /** `Date.now()` when the read started. */
  readonly at: number;
  readonly index: RelatedIndex<EmDashEntry<object>>;
}

/** The last full read of each model key. */
const recentReads = new Map<string, RecentRead>();

/**
 * The index of the published entries. Inside the `maxAge` window of the
 * last full read of the same model key, it is the index of that read.
 */
async function publishedIndex<D extends object>(
  collection: string,
  options: GetEmDashRelatedOptions<D>,
  textOf: (entry: EmDashEntry<Partial<D>>) => string
): Promise<RelatedIndex<EmDashEntry<D>>> {
  const { maxAge = 0 } = options;
  if (typeof maxAge !== "number" || !(maxAge >= 0)) {
    throw new RangeError(
      `Invalid maxAge: ${maxAge}. Use a number of seconds from 0.`
    );
  }
  // Imported on call so that astro.config can import this package.
  const { getEmDashCollection, getRequestContext } = await import("emdash");
  // Without `locale`, EmDash queries the locale of the request context
  // (emdash 1.3.1 `resolveLocale()` in `src/i18n/resolve.ts`).
  const context = getRequestContext();
  const locale = options.locale ?? context?.locale;
  // EmDash gives preview and edit-mode reads the drafts. A window must not
  // keep a read with drafts for public requests.
  const shared = !context?.preview && !context?.editMode;
  // Tells an unset locale apart from each locale, also from "".
  const localeKey = locale === undefined ? "" : `locale:${locale}`;
  const corpusKey = `emdash\u0000${collection}\u0000${localeKey}`;
  const key = modelKey(corpusKey, options);
  const now = Date.now();
  const recent = shared ? recentReads.get(key) : undefined;
  if (recent && now - recent.at < maxAge * 1000) {
    // The entries of one collection have the same shape for each `D`.
    return recent.index as RelatedIndex<EmDashEntry<D>>;
  }
  const entries = await readPublished<D>(
    getEmDashCollection,
    collection,
    options.locale
  );
  const index = relatedIndex<EmDashEntry<D>>(
    {
      key: corpusKey,
      entries,
      textOf,
      // EmDash keeps `updatedAt` when only the terms or bylines of an
      // entry change, so the version is the text.
      versionOf: textOf,
    },
    options
  );
  // A call without a window keeps no entries, unless a window uses them.
  if (shared && (maxAge > 0 || recent)) {
    recentReads.set(key, { at: now, index });
  }
  return index;
}

/**
 * Finds the published entries of an EmDash `collection` that are most
 * related to `entry`, in rank order. The model is built once and reused
 * until an entry changes. `D` is the type of `data` in the published
 * entries. An entry object can have only a part of `D`. When its text is
 * not the published text of its id, such as in a preview, the query is
 * its text.
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
  const index = await publishedIndex(collection, options, textOf);
  return index.entries(
    rank(index, collection, entry, textOf, index.query(options))
  );
}

/**
 * The id of the content row of an entry. EmDash puts it in `data.id`. A
 * draft or a preview keeps the id of its row when its slug changes.
 */
function rowId(entry: EmDashEntry<object>): unknown {
  return (entry.data as { id?: unknown }).id;
}

/** The ids of the corpus entries that come from the row of `entry`. */
function sameRow(
  index: RelatedIndex<EmDashEntry<object>>,
  entry: EmDashEntry<object>
): string[] {
  const row = rowId(entry);
  if (typeof row !== "string" || row === "") return [];
  return index.idsWhere((published) => rowId(published) === row);
}

function rank<E extends EmDashEntry<object>>(
  index: RelatedIndex<EmDashEntry<object>>,
  collection: string,
  entry: E | string,
  textOf: (entry: E) => string,
  query: QueryOptions
): string[] {
  const { model } = index;
  if (typeof entry !== "string") {
    // For a published entry with its published text, this gives the
    // same list as `findRelated(entry.id)`.
    return model.findRelatedToText(textOf(entry), {
      ...query,
      exclude: [entry.id, ...sameRow(index, entry)],
    });
  }
  if (model.has(entry)) return model.findRelated(entry, query);
  throw new Error(
    `astro-relatinator: no published entry "${entry}" in EmDash collection "${collection}"`
  );
}
