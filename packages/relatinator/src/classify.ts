import { createScorer } from "./model.js";
import type {
  ClassifyOptions,
  RelatinatorDocument,
  ScoredTopic,
  Topic,
} from "./index.js";

const DEFAULT_RATIO = 0.5;
const DEFAULT_LIMIT = 3;

function documentOf({ tag, description }: Topic): RelatinatorDocument {
  return { id: tag, content: description ? `${tag}\n${description}` : tag };
}

export function classify(
  topics: readonly Topic[],
  text: string,
  { ratio = DEFAULT_RATIO, limit = DEFAULT_LIMIT }: ClassifyOptions = {}
): ScoredTopic[] {
  if (typeof ratio !== "number" || !(ratio >= 0 && ratio <= 1)) {
    throw new RangeError(`Invalid ratio: ${ratio}. Use a number from 0 to 1.`);
  }
  const tags = new Set<string>();
  for (const { tag } of topics) {
    if (tags.has(tag)) throw new Error(`Duplicate topic tag: "${tag}"`);
    tags.add(tag);
  }
  const totals = createScorer(topics.map(documentOf), "bm25", {}).scoreText(
    text
  );
  const best = totals.reduce((max, total) => Math.max(max, total), 0);
  if (best === 0) return [];
  // The stable sort keeps tied topics in input order.
  return topics
    .map(({ tag }, i) => ({ tag, score: totals[i] / best }))
    .filter(({ score }) => score > 0 && score >= ratio)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
