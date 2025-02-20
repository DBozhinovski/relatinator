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
  var instance: InstanceType<typeof TfIdf> | BM25VectorizerType | undefined;
  var relatinatorState: {
    method: SimilarityMethod;
    documentMap: Map<number, string>;
  };
}

globalThis.relatinatorState = {
  method: "tfidf",
  documentMap: new Map(),
};

export type { BM25VectorizerType, RelatinatorDocument, SimilarityMethod };

export const getInstance = async (
  similarityMethod: SimilarityMethod = "tfidf"
) => {
  if (!globalThis.instance) {
    if (similarityMethod === "tfidf") {
      globalThis.instance = TfIdfUtils.getInstance();
      globalThis.relatinatorState.method = "tfidf";
    } else if (similarityMethod === "bm25") {
      globalThis.relatinatorState.method = "bm25";
      globalThis.instance = await BM25Utils.getInstance();
    } else {
      throw new Error(`Unsupported similarity method: ${similarityMethod}`);
    }
  }
  return globalThis.instance;
};

export const resetInstance = async () => {
  if (globalThis.relatinatorState.method === "tfidf") {
    globalThis.instance = TfIdfUtils.getInstance();
  } else if (globalThis.relatinatorState.method === "bm25") {
    globalThis.instance = await BM25Utils.resetInstance();
  } else {
    throw new Error(
      `Unsupported similarity method: ${globalThis.relatinatorState.method}`
    );
  }
  return globalThis.instance;
};

export const train = async (
  documents: RelatinatorDocument[],
  debug: boolean = false
) => {
  if (globalThis.relatinatorState.method === "tfidf") {
    TfIdfUtils.train(documents, debug);
  } else if (globalThis.relatinatorState.method === "bm25") {
    await BM25Utils.train(documents, debug);
  } else {
    throw new Error(
      `Unsupported similarity method: ${globalThis.relatinatorState.method}`
    );
  }
};

export const findRelated = async (
  documentToCompare: string,
  id: string,
  topN: number = 5,
  debug: boolean = false
): Promise<string[]> => {
  if (globalThis.relatinatorState.method === "tfidf") {
    return TfIdfUtils.findRelated(documentToCompare, id, topN, debug);
  } else if (globalThis.relatinatorState.method === "bm25") {
    return BM25Utils.findRelated(documentToCompare, id, topN, debug);
  } else {
    throw new Error(
      `Unsupported similarity method: ${globalThis.relatinatorState.method}`
    );
  }
};

export const getTopTermsForId = async (
  id: string,
  topN: number = 5,
  debug: boolean = false
) => {
  if (globalThis.relatinatorState.method === "tfidf") {
    return TfIdfUtils.getTopTermsForId(id, topN, debug);
  } else if (globalThis.relatinatorState.method === "bm25") {
    return BM25Utils.getTopTermsForId(id, topN, debug);
  } else {
    throw new Error(
      `Unsupported similarity method: ${globalThis.relatinatorState.method}`
    );
  }
};

export const getTopRelatedDocumentsForTerm = async (
  term: string,
  topN: number = 5
) => {
  if (globalThis.relatinatorState.method === "tfidf") {
    return TfIdfUtils.getTopRelatedDocumentsForTerm(term, topN);
  } else if (globalThis.relatinatorState.method === "bm25") {
    return BM25Utils.getTopRelatedDocumentsForTerm(term, topN);
  } else {
    throw new Error(
      `Unsupported similarity method: ${globalThis.relatinatorState.method}`
    );
  }
};
