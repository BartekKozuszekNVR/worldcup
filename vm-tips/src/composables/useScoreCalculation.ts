import { computed } from 'vue'
import type { MatchResult, MatchStage } from '../types'
import { STAGE_MULTIPLIERS, MATCH_POINTS } from '../services/scoring'

export type PointType = 'exact' | 'correctResult' | 'halfScore' | 'outcome' | 'miss'

export interface MatchScore {
  matchId: string
  points: number
  type: PointType
}

export interface ScoreCalculationResult {
  matchScores: MatchScore[]
  totalMatchPoints: number
  bonusPoints: number
  totalPoints: number
}

/**
 * Scoring logic matching the authoritative server/utils/scoring.ts calculateBasePoints.
 * The "correctResult" tier (knockout, different teams, same scoreline) requires team
 * mapping context not available client-side, so it is omitted here. For the user's own
 * predictions the teams always match, so this tier would never apply.
 */
function calculatePointType(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number
): PointType {
  // 1. Exact score (5 pts) - both scores correct
  if (predHome === actualHome && predAway === actualAway) {
    return 'exact'
  }

  // 2. Half Score (1.5 pts) - home OR away score matches
  if (predHome === actualHome || predAway === actualAway) {
    return 'halfScore'
  }

  // 3. Correct Outcome (1 pt) - right winner or draw, no score match
  const predOutcome = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw'
  const actualOutcome = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw'

  if (predOutcome === actualOutcome) {
    return 'outcome'
  }

  return 'miss'
}

const POINT_VALUES: Record<PointType, number> = {
  exact: MATCH_POINTS.exact,
  correctResult: MATCH_POINTS.correctResult,
  halfScore: MATCH_POINTS.halfScore,
  outcome: MATCH_POINTS.outcome,
  miss: 0,
}

export function useScoreCalculation(
  predictions: () => Record<string, { homeScore: number | null; awayScore: number | null }>,
  results: () => MatchResult[],
  bonusPoints?: () => number
) {
  const calculation = computed<ScoreCalculationResult>(() => {
    const preds = predictions()
    const res = results()
    const bonus = bonusPoints?.() ?? 0

    const matchScores: MatchScore[] = []
    let totalMatchPoints = 0

    for (const result of res) {
      const pred = preds[result.matchId]
      if (!pred || pred.homeScore === null || pred.awayScore === null) {
        matchScores.push({ matchId: result.matchId, points: 0, type: 'miss' })
        continue
      }

      const type = calculatePointType(
        pred.homeScore,
        pred.awayScore,
        result.homeScore,
        result.awayScore
      )

      const multiplier = STAGE_MULTIPLIERS[result.stage] ?? 1
      const points = POINT_VALUES[type] * multiplier

      matchScores.push({ matchId: result.matchId, points, type })
      totalMatchPoints += points
    }

    return {
      matchScores,
      totalMatchPoints,
      bonusPoints: bonus,
      totalPoints: totalMatchPoints + bonus,
    }
  })

  return calculation
}
