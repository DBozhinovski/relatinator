import pkg, { TfIdfDocument } from "natural";

const { TfIdf } = pkg;

async function writeDebug(message: string) {
  console.log("[relatinator DEBUG]", message);
}

declare global {
  var instance: InstanceType<typeof TfIdf> | undefined;
}

export const getInstance = () => {
  if (!globalThis.instance) {
    globalThis.instance = new TfIdf();
  }
  return globalThis.instance;
};

export const resetInstance = () => {
  globalThis.instance = new TfIdf();
  return globalThis.instance;
};

export interface Document {
  id: string;
  content: string;
}

export const train = async (documents: Document[], debug: boolean = false) => {
  if (debug) {
    await writeDebug(
      "[relatinator, train] Training TF-IDF on existing data..."
    );
    await writeDebug(
      `[relatinator, train] Number of documents: ${documents.length}`
    );
  }

  documents.forEach((document) => {
    getInstance().addDocument(document.content, document.id);
  });

  if (debug) {
    await writeDebug("[relatinator, train] End of training state:");
    await writeDebug(
      `[relatinator, train] Documents in TF-IDF: ${(getInstance().documents as any[]).map((doc: any) => doc.__key).join(", ")}`
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
    await writeDebug(
      `[relatinator, findRelated] Input document: ${documentToCompare.substring(0, 100)}...`
    );
    await writeDebug(
      `[relatinator, findRelated] Looking for documents related to ID: ${id}`
    );
    await writeDebug(
      `[relatinator, findRelated] Current TF-IDF state: ${(getInstance().documents as any[]).map((doc: any) => doc.__key).join(", ")}`
    );
  }

  const scores: { index: number; score: number; key: string }[] = [];

  getInstance().tfidfs(documentToCompare, (i, measure, key) => {
    if (debug) {
      writeDebug(
        `[relatinator, findRelated] Score for document ${key}: ${measure}`
      );
    }
    scores.push({
      index: i,
      score: measure,
      key: typeof key === "string" ? key : "",
    });
  });

  if (debug) {
    await writeDebug(
      `[relatinator, findRelated] All scores: ${JSON.stringify(scores)}`
    );
  }

  const topScores = scores
    .filter((entry) => entry.key !== id)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  if (debug) {
    await writeDebug(
      `[relatinator, findRelated] Top scores: ${JSON.stringify(topScores)}`
    );
    await writeDebug(
      `[relatinator, findRelated] Returning: ${topScores.map((score) => score.key).join(", ")}`
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
    console.log("[relatinator, getTopTermsForId] Id:", id);
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
  const scores: { index: number; score: number; key: string }[] = [];

  getInstance().tfidfs(term, (i, measure, key) => {
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
