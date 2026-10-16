import { tokenize } from "./tokenize.js";
import type {
  ModelOptions,
  RelatinatorDocument,
  RelatinatorModel,
  ScoredTerm,
  SimilarityMethod,
} from "./index.js";

/** Term ids in order of first occurrence, and how often each one occurs. */
interface TermCounts {
  readonly terms: readonly number[];
  readonly tfs: readonly number[];
}

interface IndexedDocument extends TermCounts {
  readonly id: string;
  readonly index: number;
  readonly length: number;
}

interface Corpus {
  readonly documents: readonly IndexedDocument[];
  readonly byId: ReadonlyMap<string, IndexedDocument>;
  /** Term ids, numbered in order of first appearance in the corpus. */
  readonly termIds: ReadonlyMap<string, number>;
  readonly terms: readonly string[];
  /** The number of documents that contain each term, by term id. */
  readonly dfs: readonly number[];
  readonly averageLength: number;
}

/** Weighs a term in `df` documents, then its `tf` occurrences in one of them. */
type TermWeight = (df: number) => (tf: number, doc: IndexedDocument) => number;

/**
 * Every term's documents (by index) and their weights, in input order, in one
 * pair of arrays: term id `t` owns the slots from `offsets[t]` up to
 * `offsets[t + 1]`.
 */
interface Postings {
  readonly offsets: Int32Array;
  readonly indices: Int32Array;
  readonly weights: Float64Array;
}

type Bm25Options = NonNullable<ModelOptions["bm25"]>;

const DEFAULT_LIMIT = 5;

/** Each insert into the top list is O(limit), so larger limits sort instead. */
const MAX_TOP_LIMIT = 64;

type Weighting = (corpus: Corpus, bm25: Bm25Options) => TermWeight;

// No prototype, so an invalid method such as "constructor" finds no function.
const weightings: Readonly<Record<SimilarityMethod, Weighting>> =
  Object.setPrototypeOf(
    {
      tfidf: (corpus) => {
        const n = corpus.documents.length;
        return (df) => {
          const idf = 1 + Math.log(n / (1 + df));
          return (tf) => tf * idf;
        };
      },
      bm25: (corpus, { k1 = 1.2, b = 0.75 }) => {
        const n = corpus.documents.length;
        return (df) => {
          const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
          return (tf, doc) => {
            const norm = k1 * (1 - b + (b * doc.length) / corpus.averageLength);
            return (idf * tf * (k1 + 1)) / (tf + norm);
          };
        };
      },
    } satisfies Record<SimilarityMethod, Weighting>,
    null
  );

function countTerms(tokens: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

/**
 * Numbers the corpus terms and counts them per document with one map lookup
 * per token. `seenIn` holds the last document index that contained each term,
 * and `slotOf` its position in that document's counts.
 */
function termCounter() {
  const termIds = new Map<string, number>();
  const terms: string[] = [];
  const dfs: number[] = [];
  const seenIn: number[] = [];
  const slotOf: number[] = [];
  const count = (tokens: readonly string[], index: number): TermCounts => {
    const docTerms: number[] = [];
    const tfs: number[] = [];
    for (const token of tokens) {
      let term = termIds.get(token);
      if (term === undefined) {
        term = terms.push(token) - 1;
        termIds.set(token, term);
        dfs.push(0);
        seenIn.push(-1);
        slotOf.push(0);
      }
      if (seenIn[term] === index) {
        tfs[slotOf[term]]++;
      } else {
        seenIn[term] = index;
        slotOf[term] = docTerms.push(term) - 1;
        tfs.push(1);
        dfs[term]++;
      }
    }
    return { terms: docTerms, tfs };
  };
  return { termIds, terms, dfs, count };
}

function indexCorpus(documents: readonly RelatinatorDocument[]): Corpus {
  const byId = new Map<string, IndexedDocument>();
  const { count, ...vocabulary } = termCounter();
  let totalLength = 0;
  for (const { id, content } of documents) {
    if (byId.has(id)) throw new Error(`Duplicate document id: "${id}"`);
    const tokens = tokenize(content);
    const index = byId.size;
    byId.set(id, { id, index, length: tokens.length, ...count(tokens, index) });
    totalLength += tokens.length;
  }
  return {
    documents: [...byId.values()],
    byId,
    ...vocabulary,
    averageLength: byId.size === 0 ? 0 : totalLength / byId.size,
  };
}

function buildPostings(corpus: Corpus, weightFor: TermWeight): Postings {
  const { documents, dfs } = corpus;
  const offsets = new Int32Array(dfs.length + 1);
  for (let term = 0; term < dfs.length; term++) {
    offsets[term + 1] = offsets[term] + dfs[term];
  }
  const indices = new Int32Array(offsets[dfs.length]);
  const weights = new Float64Array(indices.length);
  const next = offsets.slice(0, dfs.length);
  // Each slot holds its tf until the second pass weighs it.
  for (const { index, terms, tfs } of documents) {
    for (let i = 0; i < terms.length; i++) {
      const slot = next[terms[i]]++;
      indices[slot] = index;
      weights[slot] = tfs[i];
    }
  }
  for (let term = 0; term < dfs.length; term++) {
    const weight = weightFor(dfs[term]);
    for (let slot = offsets[term]; slot < offsets[term + 1]; slot++) {
      weights[slot] = weight(weights[slot], documents[indices[slot]]);
    }
  }
  return { offsets, indices, weights };
}

/**
 * The indices of the `limit` best documents, by score descending and then
 * input order, which is the order 3.0.0's stable sort gives. Two infinite
 * scores tie in both: the sort reads the NaN of `b.score - a.score` as +0.
 */
function topIndices(
  documents: readonly IndexedDocument[],
  scores: Float64Array,
  limit: number,
  excluded: ReadonlySet<string>
): number[] {
  const top: number[] = [];
  for (const [index, score] of scores.entries()) {
    const enters = top.length < limit || score > scores[top[limit - 1]];
    if (!(score > 0 && enters) || excluded.has(documents[index].id)) continue;
    let slot = top.length;
    while (slot > 0 && scores[top[slot - 1]] < score) slot--;
    top.splice(slot, 0, index);
    if (top.length > limit) top.pop();
  }
  return top;
}

function rank(
  documents: readonly IndexedDocument[],
  scores: Float64Array,
  limit: number,
  excluded: ReadonlySet<string> = new Set()
): string[] {
  if (Number.isInteger(limit) && limit >= 0 && limit <= MAX_TOP_LIMIT) {
    const top = topIndices(documents, scores, limit, excluded);
    return top.map((index) => documents[index].id);
  }
  // Sorting entries in input order with a stable sort keeps 3.0.0's tie order.
  return documents
    .map((doc) => ({ id: doc.id, score: scores[doc.index] }))
    .filter((entry) => entry.score > 0 && !excluded.has(entry.id))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.id);
}

function byScoreThenTerm(a: ScoredTerm, b: ScoredTerm): number {
  return b.score - a.score || (a.term < b.term ? -1 : a.term > b.term ? 1 : 0);
}

export function createModel(
  documents: readonly RelatinatorDocument[],
  options: ModelOptions = {}
): RelatinatorModel {
  const method = options.method ?? "bm25";
  const corpus = indexCorpus(documents);
  const weightFor = weightings[method](corpus, options.bm25 ?? {});
  const { offsets, indices, weights } = buildPostings(corpus, weightFor);

  const lookup = (id: string): IndexedDocument => {
    const doc = corpus.byId.get(id);
    if (doc === undefined) throw new Error(`Unknown document id: "${id}"`);
    return doc;
  };

  // Each document sums its terms in query order, as 3.0.0 did, so the floating
  // point totals are identical. Documents without a query term stay at 0.
  const score = ({ terms, tfs }: TermCounts): Float64Array => {
    const totals = new Float64Array(corpus.documents.length);
    for (let q = 0; q < terms.length; q++) {
      for (let i = offsets[terms[q]]; i < offsets[terms[q] + 1]; i++) {
        totals[indices[i]] += tfs[q] * weights[i];
      }
    }
    return totals;
  };

  // Terms outside the corpus match no document, so the query drops them.
  const queryOf = (tokens: readonly string[]): TermCounts => {
    const query = { terms: [] as number[], tfs: [] as number[] };
    for (const [token, tf] of countTerms(tokens)) {
      const term = corpus.termIds.get(token);
      if (term === undefined) continue;
      query.terms.push(term);
      query.tfs.push(tf);
    }
    return query;
  };

  return {
    method,
    size: corpus.documents.length,
    has: (id) => corpus.byId.has(id),
    findRelated: (id, { limit = DEFAULT_LIMIT } = {}) =>
      rank(corpus.documents, score(lookup(id)), limit, new Set([id])),
    findRelatedToText: (text, { limit = DEFAULT_LIMIT, exclude = [] } = {}) =>
      rank(
        corpus.documents,
        score(queryOf(tokenize(text))),
        limit,
        new Set(exclude)
      ),
    getTopTerms: (id, limit = DEFAULT_LIMIT) => {
      const doc = lookup(id);
      return doc.terms
        .map((term, i) => ({
          term: corpus.terms[term],
          score: weightFor(corpus.dfs[term])(doc.tfs[i], doc),
        }))
        .sort(byScoreThenTerm)
        .slice(0, limit);
    },
    getTopDocumentsForTerm: (term, limit = DEFAULT_LIMIT) => {
      const [token] = tokenize(term);
      return token === undefined
        ? []
        : rank(corpus.documents, score(queryOf([token])), limit);
    },
  };
}
