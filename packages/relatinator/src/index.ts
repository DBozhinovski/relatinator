import pkg, { TfIdfDocument } from "natural";

const { TfIdf } = pkg;
export const tfIdf = new TfIdf();

export interface Document {
  id: string;
  content: string;
}

export const train = (documents: Document[]) => {
  documents.forEach((document) => {
    tfIdf.addDocument(document.content, document.id);
  });
};

export const findRelated = (
  documentToCompare: string,
  id: string,
  topN: number = 5
) => {
  const scores: { index: number; score: number; key: string }[] = [];

  tfIdf.tfidfs(documentToCompare, (i, measure, key) => {
    scores.push({ index: i, score: measure, key: key || "" });
  });

  const topScores = scores
    .filter((entry) => entry.key !== id)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return topScores.map((score) => score.key);
};

export const getTopTermsForId = (id: string, topN: number = 5) => {
  const terms: { term: string; score: number }[] = [];

  console.log(id);

  const index = (tfIdf.documents as unknown as TfIdfDocument[]).findIndex(
    (document) => {
      return document.__key === id;
    }
  );

  if (index === -1) {
    throw new Error(
      `Could not find document for id: "${id}"; Make sure that your input id is correct.`
    );
  }

  let count = 0;

  tfIdf.listTerms(index).forEach((item) => {
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

  tfIdf.tfidfs(term, (i, measure, key) => {
    scores.push({ index: i, score: measure, key: key || "" });
  });

  const topScores = scores
    .filter((entry) => entry.key !== term)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);

  return topScores.map((score) => score.key);
};
