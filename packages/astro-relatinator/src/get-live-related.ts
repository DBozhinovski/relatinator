import type { LiveDataEntry } from "astro";
import type { LiveContentConfig, LiveLoaderDataType } from "astro:content";
import { entryText } from "./entry-text.js";
import { relatedIndex, type RelatedOptions } from "./related-index.js";

/** The name of a collection in `src/live.config.ts`. */
export type LiveCollectionKey = keyof LiveContentConfig["collections"];

/** An entry of the live collection `C`, as `getLiveCollection()` gives it. */
export type LiveCollectionEntry<C extends LiveCollectionKey> = LiveDataEntry<
  LiveLoaderDataType<C>
>;

export type GetLiveRelatedOptions<E> = RelatedOptions<E>;

// A no-break space becomes a plain space, because both only split words.
const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntity(match: string, code: string): string {
  if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? " ";
  const point =
    code[1] === "x" || code[1] === "X"
      ? parseInt(code.slice(2), 16)
      : Number(code.slice(1));
  return point <= 0x10ffff ? String.fromCodePoint(point) : match;
}

/**
 * The words of rendered HTML, without the tags and without the content of
 * `script` and `style` elements. Named entities other than the common ones
 * become spaces. Tag and entity names would otherwise relate entries.
 */
function htmlText(html: string): string {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, decodeEntity);
}

/** The data of a live entry, followed by the text of its rendered HTML. */
function liveEntryText(
  { id, data, rendered }: LiveDataEntry,
  fields?: readonly string[]
): string {
  return entryText({ id, data, body: htmlText(rendered?.html ?? "") }, fields);
}

/**
 * Finds the entries of the live `collection` that are most related to
 * `entry`, in rank order. Each call reads the collection again. The
 * model is built once and reused until the text of an entry changes.
 */
export async function getLiveRelated<C extends LiveCollectionKey>(
  collection: C,
  entry: LiveCollectionEntry<C> | string,
  options: GetLiveRelatedOptions<LiveCollectionEntry<C>> = {}
): Promise<LiveCollectionEntry<C>[]> {
  const { text, fields } = options;
  // Imported on call so that astro.config can import the integration.
  const { getLiveCollection } = await import("astro:content");
  const { entries = [], error } = await getLiveCollection(collection);
  if (error) {
    throw new Error(
      `astro-relatinator: cannot read live collection "${String(collection)}": ${error.message}`,
      { cause: error }
    );
  }
  const textOf =
    text ?? ((e: LiveCollectionEntry<C>) => liveEntryText(e, fields));
  const index = relatedIndex<LiveCollectionEntry<C>>(
    {
      key: `live\u0000${String(collection)}`,
      entries,
      textOf,
      // A live entry has no digest, so the version is the text.
      versionOf: textOf,
    },
    options
  );
  const id = typeof entry === "string" ? entry : entry.id;
  if (!index.model.has(id)) {
    throw new Error(
      `astro-relatinator: no entry "${id}" in live collection "${String(collection)}"`
    );
  }
  return index.entries(index.model.findRelated(id, index.query(options)));
}
