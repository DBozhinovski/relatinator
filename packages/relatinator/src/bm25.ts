import BM25Vectorizer, {
  type BM25Vectorizer as BM25VectorizerType,
} from "wink-nlp/utilities/bm25-vectorizer";
import winkNLP from "wink-nlp";
import model from "wink-eng-lite-web-model";
import utils from "wink-nlp-utils";
import { log } from "./util";
import type { RelatinatorDocument } from "./index";

let nlp: any;

// Helper function to normalize text consistently across all operations
const normalizeText = (text: string) => {
  // Remove elisions (contractions) first
  const withoutElisions = utils.string.removeElisions(text);
  // Remove punctuation and extra spaces
  const cleaned = utils.string.removePunctuations(withoutElisions);
  const normalized = utils.string.removeExtraSpaces(cleaned);

  // Get tokens using winkNLP for better tokenization
  const tokens = nlp.readDoc(normalized).tokens().out(nlp.its.normal);

  // Remove stopwords
  const withoutStopwords = utils.tokens.removeWords(tokens);

  // Apply stemming to each remaining token
  const stemmed = withoutStopwords.map((token) => utils.string.stem(token));

  return stemmed;
};

const initializeNLP = () => {
  if (!nlp) {
    // Initialize winkNLP with just the model and sentence boundary detection
    nlp = winkNLP(model, ["sbd"]);
  }
  return nlp;
};

export const getInstance = async () => {
  if (!globalThis.bm25Instance) {
    globalThis.bm25Instance = BM25Vectorizer();
  }
  await initializeNLP();
  return globalThis.bm25Instance as BM25VectorizerType;
};

export const resetInstance = async () => {
  globalThis.bm25Instance = BM25Vectorizer();
  globalThis.relatinatorState.documentMap.clear();
  await initializeNLP();
  return globalThis.bm25Instance;
};

export const train = async (
  documents: RelatinatorDocument[],
  debug: boolean = false
) => {
  if (debug) {
    log("[relatinator, bm25, train] Training BM25 on existing data...");
    log(`[relatinator, bm25, train] Number of documents: ${documents.length}`);
  }

  const instance = await getInstance();

  documents.forEach((document, index) => {
    // Normalize and process the document text
    const processedTokens = normalizeText(document.content);
    instance.learn(processedTokens);
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

  // Normalize and process the input document
  const processedTokens = normalizeText(documentToCompare);

  // If all terms were filtered out, return empty array
  if (processedTokens.length === 0) {
    return [];
  }

  const instance = await getInstance();

  // Get document term matrix and terms
  const docMatrix = instance.out(nlp.its.docTermMatrix as any) as number[][];
  const terms = instance.out(nlp.its.terms as any) as string[];

  // Calculate document scores by comparing token vectors
  const documentScores = docMatrix.map((docVector, idx) => {
    // Sum up the BM25 scores for matching terms
    const score = processedTokens.reduce((sum: number, token: string) => {
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

  const docMatrix = instance.out(nlp.its.docTermMatrix as any) as number[][];
  const terms = instance.out(nlp.its.terms as any) as string[];

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
  topN: number = 5,
  debug: boolean = false
) => {
  // Normalize and process the search term
  const processedTokens = normalizeText(term);

  // If all terms were filtered out, return empty array
  if (processedTokens.length === 0) {
    return [];
  }

  // Get BM25 scores for the term against all documents
  const instance = await getInstance();
  const docMatrix = instance.out(nlp.its.docTermMatrix as any) as number[][];
  const terms = instance.out(nlp.its.terms as any) as string[];

  // Find the term index in our vocabulary
  const termIndex = terms.indexOf(processedTokens[0]);

  // If term not found in vocabulary, return empty array
  if (termIndex === -1) {
    return [];
  }

  // Calculate scores for each document based on the term's BM25 score
  const scores = docMatrix.map((docVector, idx) => ({
    index: idx,
    score: docVector[termIndex],
    key: globalThis.relatinatorState.documentMap.get(idx) || "",
  }));

  if (debug) {
    log(
      `[relatinator, bm25, getTopRelatedDocumentsForTerm] All scores: ${JSON.stringify(
        scores
      )}`
    );
  }

  // Filter, sort and return top results
  const topScores = scores
    .filter((entry) => entry.key !== "") // Only filter out empty keys
    .sort((a, b) => b.score - a.score) // Sort by score, even if some are 0
    .slice(0, topN);

  if (debug) {
    log(
      `[relatinator, bm25, getTopRelatedDocumentsForTerm] Top scores: ${JSON.stringify(
        topScores
      )}`
    );
  }

  return topScores.map((score) => score.key);
};
