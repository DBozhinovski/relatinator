import { tokenize } from "./tokenize.js";
import type {
  ModelOptions,
  RelatinatorDocument,
  RelatinatorModel,
  ScoredTerm,
  SimilarityMethod,
} from "./index.js";

type TermCounts = ReadonlyMap<string, number>;

interface IndexedDocument {
  readonly id: string;
  readonly length: number;
  readonly counts: TermCounts;
}

interface Corpus {
  readonly documents: readonly IndexedDocument[];
  readonly byId: ReadonlyMap<string, IndexedDocument>;
  readonly documentFrequency: TermCounts;
  readonly averageLength: number;
}

type TermWeight = (term: string, doc: IndexedDocument) => number;

type Bm25Options = NonNullable<ModelOptions["bm25"]>;

const DEFAULT_LIMIT = 5;

const weightings: Record<
  SimilarityMethod,
  (corpus: Corpus, bm25: Bm25Options) => TermWeight
> = {
  tfidf: (corpus) => {
    const n = corpus.documents.length;
    return (term, doc) => {
      const tf = doc.counts.get(term) ?? 0;
      if (tf === 0) return 0;
      const df = corpus.documentFrequency.get(term) ?? 0;
      return tf * (1 + Math.log(n / (1 + df)));
    };
  },
  bm25: (corpus, { k1 = 1.2, b = 0.75 }) => {
    const n = corpus.documents.length;
    return (term, doc) => {
      const tf = doc.counts.get(term) ?? 0;
      if (tf === 0) return 0;
      const df = corpus.documentFrequency.get(term) ?? 0;
      const idf = Math.log(1 + (n - df + 0.5) / (df + 0.5));
      const norm = k1 * (1 - b + (b * doc.length) / corpus.averageLength);
      return (idf * tf * (k1 + 1)) / (tf + norm);
    };
  },
};

function countTerms(tokens: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1);
  return counts;
}

function indexCorpus(documents: readonly RelatinatorDocument[]): Corpus {
  const byId = new Map<string, IndexedDocument>();
  const documentFrequency = new Map<string, number>();
  let totalLength = 0;
  for (const { id, content } of documents) {
    if (byId.has(id)) throw new Error(`Duplicate document id: "${id}"`);
    const tokens = tokenize(content);
    const counts = countTerms(tokens);
    byId.set(id, { id, length: tokens.length, counts });
    for (const term of counts.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
    totalLength += tokens.length;
  }
  return {
    documents: [...byId.values()],
    byId,
    documentFrequency,
    averageLength: byId.size === 0 ? 0 : totalLength / byId.size,
  };
}

function rank(
  documents: readonly IndexedDocument[],
  score: (doc: IndexedDocument) => number,
  limit: number,
  excluded: ReadonlySet<string> = new Set()
): string[] {
  return documents
    .filter((doc) => !excluded.has(doc.id))
    .map((doc) => ({ id: doc.id, score: score(doc) }))
    .filter((entry) => entry.score > 0)
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
  const weight = weightings[method](corpus, options.bm25 ?? {});

  const lookup = (id: string): IndexedDocument => {
    const doc = corpus.byId.get(id);
    if (doc === undefined) throw new Error(`Unknown document id: "${id}"`);
    return doc;
  };

  const queryScore = (query: TermCounts) => (doc: IndexedDocument) => {
    let total = 0;
    for (const [term, count] of query) total += count * weight(term, doc);
    return total;
  };

  return {
    method,
    size: corpus.documents.length,
    has: (id) => corpus.byId.has(id),
    findRelated: (id, { limit = DEFAULT_LIMIT } = {}) =>
      rank(
        corpus.documents,
        queryScore(lookup(id).counts),
        limit,
        new Set([id])
      ),
    findRelatedToText: (text, { limit = DEFAULT_LIMIT, exclude = [] } = {}) =>
      rank(
        corpus.documents,
        queryScore(countTerms(tokenize(text))),
        limit,
        new Set(exclude)
      ),
    getTopTerms: (id, limit = DEFAULT_LIMIT) => {
      const doc = lookup(id);
      return [...doc.counts.keys()]
        .map((term) => ({ term, score: weight(term, doc) }))
        .sort(byScoreThenTerm)
        .slice(0, limit);
    },
    getTopDocumentsForTerm: (term, limit = DEFAULT_LIMIT) => {
      const [token] = tokenize(term);
      return token === undefined
        ? []
        : rank(corpus.documents, (doc) => weight(token, doc), limit);
    },
  };
}
