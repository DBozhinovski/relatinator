import pkg from "natural";
import * as TfIdfUtils from "./tfidf";
import * as BM25Utils from "./bm25";
import type {
  BM25VectorizerType,
  RelatinatorDocument,
  SimilarityMethod,
} from "./types";

const { TfIdf } = pkg;

declare global {
  var tfidfInstance: InstanceType<typeof TfIdf> | undefined;
  var bm25Instance: BM25VectorizerType | undefined;
  var relatinatorState: {
    documentMap: Map<number, string>;
  };
}

globalThis.relatinatorState = {
  documentMap: new Map(),
};

export type { BM25VectorizerType, RelatinatorDocument, SimilarityMethod };

export { TfIdfUtils, BM25Utils };
