import BM25Vectorizer, {
  type BM25Vectorizer as BM25VectorizerType,
} from "wink-nlp/utilities/bm25-vectorizer";
import winkNLP from "wink-nlp";
import model from "wink-eng-lite-web-model";
import { log } from "./util";
import type { RelatinatorDocument } from "./index";

let nlp: any;

const initializeNLP = () => {
  if (!nlp) {
    // Initialize winkNLP with just the model and sentence boundary detection
    nlp = winkNLP(model, ["sbd"]);
  }
  return nlp;
};

export const getInstance = async () => {
  if (!globalThis.instance) {
    globalThis.instance = BM25Vectorizer();
  }
  await initializeNLP();
  return globalThis.instance as BM25VectorizerType;
};

export const resetInstance = async () => {
  globalThis.instance = BM25Vectorizer();
  globalThis.relatinatorState.documentMap.clear();
  await initializeNLP();
  return globalThis.instance;
};

export const train = async (
  documents: RelatinatorDocument[],
  debug: boolean = false
) => {
  if (debug) {
    log("[relatinator, bm25, train] Training BM25 on existing data...");
    log(`[relatinator, bm25, train] Number of documents: ${documents.length}`);
  }

  const its = nlp.its;
  const instance = await getInstance();

  documents.forEach((document, index) => {
    const tokens = nlp.readDoc(document.content).tokens().out(its.normal);
    instance.learn(tokens);
    globalThis.relatinatorState.documentMap.set(index, document.id);
  });

  if (debug) {
    log("[relatinator, bm25, train] End of training state:");
    log(
      `[relatinator, bm25, train] Documents in BM25: ${globalThis.relatinatorState.documentMap.size}`
    );
  }
};

export const findRelated = async (
  documentToCompare: string,
  id: string,
  topN: number = 5,
  debug: boolean = false
) => {
  if (debug) {
    log(
      `[relatinator, bm25, findRelated] Input document: ${documentToCompare.substring(
        0,
        100
      )}...`
    );
  }

  const its = nlp.its;
  const tokens = nlp.readDoc(documentToCompare).tokens().out(its.normal);
  const instance = await getInstance();

  // Get document term matrix and terms
  const docMatrix = instance.out(its.docTermMatrix as any) as number[][];
  const terms = instance.out(its.terms as any) as string[];

  // Calculate document scores by comparing token vectors
  const documentScores = docMatrix.map((docVector, idx) => {
    // Sum up the BM25 scores for matching terms
    const score = tokens.reduce((sum: number, token: string) => {
      const termIndex = terms.indexOf(token);
      return sum + (termIndex >= 0 ? docVector[termIndex] : 0);
    }, 0);

    return {
      index: idx,
      score,
      key: globalThis.relatinatorState.documentMap.get(idx) || "",
    };
  });

  if (debug) {
    log(
      `[relatinator, bm25, findRelated] All scores: ${JSON.stringify(
        documentScores
      )}`
    );
  }

  const topScores = documentScores
    .filter((entry) => entry.key !== id && entry.key !== "")
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  if (debug) {
    log(
      `[relatinator, bm25, findRelated] Top scores: ${JSON.stringify(
        topScores
      )}`
    );
  }

  return topScores.map((score) => score.key);
};

export const getTopTermsForId = async (
  id: string,
  topN: number = 5,
  debug: boolean = false
) => {
  if (debug) {
    log(`[relatinator, bm25, getTopTermsForId] Id: ${id}`);
  }

  // Find the document index using our documentMap
  const index = Array.from(
    globalThis.relatinatorState.documentMap.entries()
  ).find(([_, docId]) => docId === id)?.[0];

  if (index === undefined) {
    throw new Error(
      `Could not find document for id: "${id}"; Make sure that your input id is correct.`
    );
  }

  const instance = (await getInstance()) as BM25VectorizerType;
  const its = nlp.its;

  const docMatrix = instance.out(its.docTermMatrix as any) as number[][];
  const terms = instance.out(its.terms as any) as string[];

  const docVector = docMatrix[index];

  // Combine terms with their scores
  const termScores = terms.map((term: string, i: number) => ({
    term,
    score: docVector[i] || 0,
  }));

  // Sort by score and take top N
  return termScores.sort((a, b) => b.score - a.score).slice(0, topN);
};

export const getTopRelatedDocumentsForTerm = async (
  term: string,
  topN: number = 5
) => {
  // Create a document with just the term
  const termDoc = nlp.readDoc(term).tokens().out();

  // Get BM25 scores for the term against all documents
  const instance = await getInstance();
  const scores = instance
    .vectorOf(termDoc)
    .map((score: number, idx: number) => ({
      index: idx,
      score,
      key: globalThis.relatinatorState.documentMap.get(idx) || "",
    }));

  // Filter, sort and return top results
  const topScores = scores
    .filter((entry) => entry.score > 0) // Filter out zero scores
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return topScores.map((score) => score.key);
};
