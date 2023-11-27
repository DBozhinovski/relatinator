import { TfIdf } from "natural";

export const tfIdf = new TfIdf();

interface Document {
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
