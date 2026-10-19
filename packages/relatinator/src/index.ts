export interface RelatinatorDocument {
  id: string;
  content: string;
}

export type SimilarityMethod = "tfidf" | "bm25";

export interface ModelOptions {
  method?: SimilarityMethod;
  bm25?: { k1?: number; b?: number };
}

export interface ScoredTerm {
  term: string;
  score: number;
}

export interface QueryOptions {
  limit?: number;
  /** Ids to leave out of the results. */
  exclude?: readonly string[];
  /** Keeps a document in the results only when it returns true. */
  filter?: (id: string) => boolean;
}

export interface RelatinatorModel {
  readonly method: SimilarityMethod;
  readonly size: number;
  has(id: string): boolean;
  findRelated(id: string, options?: QueryOptions): string[];
  findRelatedToText(text: string, options?: QueryOptions): string[];
  getTopTerms(id: string, limit?: number): ScoredTerm[];
  getTopDocumentsForTerm(term: string, limit?: number): string[];
}

export interface Topic {
  tag: string;
  description?: string;
}

export interface ClassifyOptions {
  ratio?: number;
  limit?: number;
}

export interface ScoredTopic {
  tag: string;
  score: number;
}

export { tokenize } from "./tokenize.js";
export { createModel } from "./model.js";
export { classify } from "./classify.js";
