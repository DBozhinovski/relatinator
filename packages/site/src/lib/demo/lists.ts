import { formatScore } from "./scores";

// Turns library results into rows the page can render.
export function relatedRows(
  scored: { id: string; score: number }[],
  titleOf: (id: string) => string,
): { id: string; label: string; score: string }[] {
  const rows: { id: string; label: string; score: string }[] = [];
  for (const row of scored) {
    rows.push({ id: row.id, label: titleOf(row.id), score: formatScore(row.score) });
  }
  return rows;
}

// Topic results carry a tag instead of a document id.
export function topicRows(scored: { tag: string; score: number }[]): { id: string; label: string; score: string }[] {
  const rows: { id: string; label: string; score: string }[] = [];
  for (const row of scored) rows.push({ id: row.tag, label: row.tag, score: formatScore(row.score) });
  return rows;
}
