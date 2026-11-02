// Scores wear two decimals so lists stay readable and comparable.
export function formatScore(score: number): string {
  return score.toFixed(2);
}
