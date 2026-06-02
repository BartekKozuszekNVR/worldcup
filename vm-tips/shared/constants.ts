/** Tournament start date — predictions lock after this */
export const TOURNAMENT_START = '2026-06-11T18:50:00Z'

/** Check if the tournament has started (predictions are locked) */
export function isTournamentLocked(): boolean {
  return new Date().toISOString() >= TOURNAMENT_START
}
