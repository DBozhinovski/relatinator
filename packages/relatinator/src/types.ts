import type { ItsFunction } from "wink-nlp";

export interface BM25VectorizerType {
  learn(tokens: string[]): void;
  out<T>(f: ItsFunction<T>): T;
  vectorOf(tokens: string[]): number[];
}

export interface RelatinatorDocument {
  id: string;
  content: string;
}

export type SimilarityMethod = "tfidf" | "bm25";
