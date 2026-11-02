import { createModel } from "relatinator";
import type { CollectionEntry } from "astro:content";
import { termRows as formatTerms } from "./demo/terms";

type DemoPost = CollectionEntry<"demoPosts">;

export function prepareLandingData(entries: DemoPost[]) {
  const posts = entries
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((entry) => ({ id: entry.id, title: entry.data.title, content: entry.body ?? "" }));
  const titles = new Map(posts.map((post) => [post.id, post.title]));
  const initialId = "science-books-space";
  const model = createModel(posts);
  const initialRelated = model.findRelatedScored(initialId, { limit: 3 });
  const firstResult = initialRelated.map((row) => ({
    id: row.id,
    label: titles.get(row.id) ?? row.id,
    score: row.score.toFixed(2),
    terms: formatTerms(model.explainRelated(initialId, row.id)).slice(0, 3).map((term) => term.term),
  }));
  const explanation = model.explainRelated(initialId, "science-books-autumn");

  return { posts, initialId, firstResult, explanation, termRows: formatTerms };
}
