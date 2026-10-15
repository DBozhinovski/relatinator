import {
  createModel,
  type RelatinatorModel,
  type SimilarityMethod,
} from "relatinator";
import type { ContentEntry } from "./entry-text.js";
import { getCachedModel } from "./model-cache.js";

export interface RelatedOptions<E> {
  /** Maximum number of related entries. Default: 5. */
  limit?: number;
  /** Scoring method. Default: "bm25". */
  method?: SimilarityMethod;
  /**
   * Data keys to read. Default: all data. The body of an Astro entry is
   * always read.
   */
  fields?: readonly string[];
  /** Replaces the default text of each entry. */
  text?: (entry: E) => string;
}

/** The entries to rank, and how to read them. */
export interface Corpus<E> {
  /** Names the corpus in the model cache. */
  readonly key: string;
  readonly entries: readonly E[];
  readonly textOf: (entry: E) => string;
  /** A value that changes when the text of the entry changes. */
  readonly versionOf: (entry: E) => string;
}

export interface RelatedIndex<E> {
  readonly model: RelatinatorModel;
  /** The entries of the corpus with the given ids, in the same order. */
  entries(ids: readonly string[]): E[];
}

/**
 * The model of a corpus and a lookup from ids back to its entries. The
 * model is built once and reused until the version of an entry changes.
 * The fingerprint tells apart `text` functions that share their source
 * code.
 */
export function relatedIndex<E extends ContentEntry>(
  { key, entries, textOf, versionOf }: Corpus<E>,
  { method = "bm25", fields, text }: RelatedOptions<E>
): RelatedIndex<E> {
  const source = text ? `text:${text}` : `fields:${JSON.stringify(fields)}`;
  const fingerprint = entries
    .map((entry) => `${entry.id}\u0000${versionOf(entry)}`)
    .join("\u0001");
  const model = getCachedModel(
    `${key}\u0000${method}\u0000${source}`,
    fingerprint,
    () =>
      createModel(
        entries.map((entry) => ({ id: entry.id, content: textOf(entry) })),
        { method }
      )
  );
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return {
    model,
    entries: (ids) =>
      ids.map((id) => {
        const entry = byId.get(id);
        if (!entry) {
          throw new Error(
            `astro-relatinator: internal error: ranked id "${id}" is not in the corpus`
          );
        }
        return entry;
      }),
  };
}
