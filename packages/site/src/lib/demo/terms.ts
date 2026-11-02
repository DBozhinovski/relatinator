import { formatScore } from "./scores";

// Terms keep two decimals; they are scores, not counts.
export function termRows(scored: { term: string; score: number }[]): { term: string; score: string }[] {
  const rows: { term: string; score: string }[] = [];
  for (const entry of scored) rows.push({ term: entry.term, score: formatScore(entry.score) });
  return rows;
}
