import { tokenize } from "./tokenize.js";
import type {
  ModelOptions,
  QueryOptions,
  RelatinatorDocument,
  RelatinatorModel,
  ScoredDocument,
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
  keep: (id: string) => boolean
): number[] {
  const top: number[] = [];
  for (const [index, score] of scores.entries()) {
    const enters = top.length < limit || score > scores[top[limit - 1]];
    if (!(score > 0 && enters) || !keep(documents[index].id)) continue;
    let slot = top.length;
    while (slot > 0 && scores[top[slot - 1]] < score) slot--;
    top.splice(slot, 0, index);
    if (top.length > limit) top.pop();
  }
  return top;
}

/** The scores of one query, and the indices of its results in rank order. */
interface Ranking {
  readonly scores: Float64Array;
  readonly indices: readonly number[];
}

/** The indices of the ranked documents, best first. */
function rank(
  documents: readonly IndexedDocument[],
  scores: Float64Array,
  limit: number,
  keep: (id: string) => boolean = () => true
): number[] {
  if (Number.isInteger(limit) && limit >= 0 && limit <= MAX_TOP_LIMIT) {
    return topIndices(documents, scores, limit, keep);
  }
  // Sorting indices in input order with a stable sort keeps 3.0.0's tie order.
  return documents
    .map((doc) => doc.index)
    .filter((index) => scores[index] > 0 && keep(documents[index].id))
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, limit);
}

/** Keeps the ids that are not excluded and that `filter` accepts. */
function keeper(
  excluded: Iterable<string>,
  filter?: QueryOptions["filter"]
): (id: string) => boolean {
  const skip = new Set(excluded);
  return filter ? (id) => !skip.has(id) && filter(id) : (id) => !skip.has(id);
}

function byScoreThenTerm(a: ScoredTerm, b: ScoredTerm): number {
  return b.score - a.score || (a.term < b.term ? -1 : a.term > b.term ? 1 : 0);
}

/**
 * The terms of `query` that `other` also contains, each with the amount that
 * it adds to the score of `other`: its tf in `query` times its weight in
 * `other`. These are the summands of the score, in query order.
 */
function contributions(
  corpus: Corpus,
  weightFor: TermWeight,
  query: IndexedDocument,
  other: IndexedDocument
): ScoredTerm[] {
  const otherTfs = new Map(other.terms.map((term, i) => [term, other.tfs[i]]));
  return query.terms.flatMap((term, i) => {
    const tf = otherTfs.get(term);
    if (tf === undefined) return [];
    const weight = weightFor(corpus.dfs[term])(tf, other);
    return [{ term: corpus.terms[term], score: query.tfs[i] * weight }];
  });
}

/** Per-document score totals of queries against one indexed corpus. */
export interface Scorer {
  readonly corpus: Corpus;
  readonly weightFor: TermWeight;
  score(query: TermCounts): Float64Array;
  queryOf(tokens: readonly string[]): TermCounts;
  scoreText(text: string): Float64Array;
}

export function createScorer(
  documents: readonly RelatinatorDocument[],
  method: SimilarityMethod,
  bm25: Bm25Options
): Scorer {
  const corpus = indexCorpus(documents);
  const weightFor = weightings[method](corpus, bm25);
  const { offsets, indices, weights } = buildPostings(corpus, weightFor);

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
    corpus,
    weightFor,
    score,
    queryOf,
    scoreText: (text) => score(queryOf(tokenize(text))),
  };
}

export function createModel(
  documents: readonly RelatinatorDocument[],
  options: ModelOptions = {}
): RelatinatorModel {
  const method = options.method ?? "bm25";
  const { corpus, weightFor, score, queryOf, scoreText } = createScorer(
    documents,
    method,
    options.bm25 ?? {}
  );

  const lookup = (id: string): IndexedDocument => {
    const doc = corpus.byId.get(id);
    if (doc === undefined) throw new Error(`Unknown document id: "${id}"`);
    return doc;
  };

  const relatedTo = (
    id: string,
    { limit = DEFAULT_LIMIT, exclude = [], filter }: QueryOptions = {}
  ): Ranking => {
    const scores = score(lookup(id));
    const keep = keeper([id, ...exclude], filter);
    return { scores, indices: rank(corpus.documents, scores, limit, keep) };
  };

  const relatedToText = (
    text: string,
    { limit = DEFAULT_LIMIT, exclude = [], filter }: QueryOptions = {}
  ): Ranking => {
    const scores = scoreText(text);
    const keep = keeper(exclude, filter);
    return { scores, indices: rank(corpus.documents, scores, limit, keep) };
  };

  const idsOf = (indices: readonly number[]): string[] =>
    indices.map((index) => corpus.documents[index].id);

  const scoredOf = ({ scores, indices }: Ranking): ScoredDocument[] =>
    indices.map((index) => ({
      id: corpus.documents[index].id,
      score: scores[index],
    }));

  return {
    method,
    size: corpus.documents.length,
    has: (id) => corpus.byId.has(id),
    findRelated: (id, options) => idsOf(relatedTo(id, options).indices),
    findRelatedToText: (text, options) =>
      idsOf(relatedToText(text, options).indices),
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
        : idsOf(rank(corpus.documents, score(queryOf([token])), limit));
    },
    findRelatedScored: (id, options) => scoredOf(relatedTo(id, options)),
    findRelatedToTextScored: (text, options) =>
      scoredOf(relatedToText(text, options)),
    explainRelated: (id, otherId, limit = DEFAULT_LIMIT) =>
      contributions(corpus, weightFor, lookup(id), lookup(otherId))
        .sort(byScoreThenTerm)
        .slice(0, limit),
  };
}
