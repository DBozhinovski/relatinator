import pkg, { type TfIdfDocument } from "natural";
import utils from "wink-nlp-utils";
import { log } from "./util";
import type { RelatinatorDocument } from "./index";

const { TfIdf } = pkg;

// Helper function to normalize text consistently across all operations
const normalizeText = (text: string) => {
  // Remove elisions (contractions) first
  const withoutElisions = utils.string.removeElisions(text);
  // Remove punctuation and extra spaces
  const cleaned = utils.string.removePunctuations(withoutElisions);
  const normalized = utils.string.removeExtraSpaces(cleaned);

  // Tokenize and process each token
  const tokens = utils.string
    .tokenize(normalized, true)
    .filter((token) => token.tag === "word")
    .map((token) => token.value.toLowerCase());

  // Remove stopwords
  const withoutStopwords = utils.tokens.removeWords(tokens);

  // Apply stemming to each remaining token
  const stemmed = withoutStopwords.map((token) => utils.string.stem(token));

  return stemmed;
};

export const getInstance = () => {
  if (!globalThis.tfidfInstance) {
    globalThis.tfidfInstance = new TfIdf();
  }
  return globalThis.tfidfInstance as InstanceType<typeof TfIdf>;
};

export const resetInstance = () => {
  globalThis.tfidfInstance = new TfIdf();
  return globalThis.tfidfInstance;
};

export const train = (
  documents: RelatinatorDocument[],
  debug: boolean = false
) => {
  if (debug) {
    log("[relatinator, tfidf, train] Training TF-IDF on existing data...");
    log(`[relatinator, tfidf, train] Number of documents: ${documents.length}`);
  }

  documents.forEach((document) => {
    // Normalize and process the document text
    const processedTokens = normalizeText(document.content);

    // Join back into a string for TFIDF
    getInstance().addDocument(processedTokens.join(" "), document.id);
  });

  if (debug) {
    log("[relatinator, tfidf, train] End of training state:");
    log(
      `[relatinator, tfidf, train] Documents in TF-IDF: ${(getInstance().documents as any[]).map((doc: any) => doc.__key).join(", ")}`
    );
  }
};

export const findRelated = (
  documentToCompare: string,
  id: string,
  topN: number = 5,
  debug: boolean = false
) => {
  if (debug) {
    log(
      `[relatinator, tfidf, findRelated] Input document: ${documentToCompare.substring(
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

  const scores: { index: number; score: number; key: string }[] = [];

  getInstance().tfidfs(processedTokens.join(" "), (i, measure, key) => {
    if (debug) {
      log(
        `[relatinator, tfidf, findRelated] Score for document ${key}: ${measure}`
      );
    }
    scores.push({
      index: i,
      score: measure,
      key: typeof key === "string" ? key : "",
    });
  });

  if (debug) {
    log(
      `[relatinator, tfidf, findRelated] All scores: ${JSON.stringify(scores)}`
    );
  }

  const topScores = scores
    .filter((entry) => entry.key !== id)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  if (debug) {
    log(
      `[relatinator, tfidf, findRelated] Top scores: ${JSON.stringify(
        topScores
      )}`
    );
  }

  return topScores.map((score) => score.key);
};

export const getTopTermsForId = (
  id: string,
  topN: number = 5,
  debug: boolean = false
) => {
  const terms: { term: string; score: number }[] = [];

  if (debug) {
    log(`[relatinator, tfidf, getTopTermsForId] Id: ${id}`);
  }

  const index = (
    getInstance().documents as unknown as TfIdfDocument[]
  ).findIndex((document) => {
    return document.__key?.toString() === id;
  });

  if (index === -1) {
    throw new Error(
      `Could not find document for id: "${id}"; Make sure that your input id is correct.`
    );
  }

  let count = 0;

  getInstance()
    .listTerms(index)
    .forEach((item) => {
      if (count++ < topN) {
        terms.push({ term: item.term, score: item.tfidf });
      }
    });

  return terms;
};

export const getTopRelatedDocumentsForTerm = (
  term: string,
  topN: number = 5
) => {
  // Normalize and process the search term
  const processedTokens = normalizeText(term);

  // If all terms were filtered out, return empty array
  if (processedTokens.length === 0) {
    return [];
  }

  const scores: { index: number; score: number; key: string }[] = [];

  getInstance().tfidfs(processedTokens.join(" "), (i, measure, key) => {
    scores.push({
      index: i,
      score: measure,
      key: typeof key === "string" ? key : "",
    });
  });

  const topScores = scores
    .filter((entry) => entry.key !== term)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return topScores.map((score) => score.key);
};
