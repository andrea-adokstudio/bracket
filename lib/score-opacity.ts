/**
 * Opacità per punteggi a confronto: vincente 1, perdente 0.3, pari entrambi 1.
 */
export function getFinishedScoreOpacityClass(
  score: number | undefined,
  opponentScore: number | undefined,
): string {
  if (score == null || opponentScore == null) return "opacity-100"
  if (score > opponentScore) return "opacity-100"
  if (score < opponentScore) return "opacity-30"
  return "opacity-100"
}
