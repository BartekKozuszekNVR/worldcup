import { computed } from 'vue'
import type { MatchResult, MatchStage } from '../types'

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

const STAGE_MULTIPLIERS: Record<MatchStage, number> = {
  group: 1,
  r32: 2,
  r16: 3,
  qf: 4,
  sf: 5,
  third: 5,
  final: 6,
}

const POINT_VALUES: Record<PointType, number> = {
  exact: 5,
  correctResult: 3,
  halfScore: 2,
  outcome: 1,
  miss: 0,
}

function getOutcome(home: number, away: number): '1' | 'X' | '2' {
  if (home > away) return '1'
  if (home < away) return '2'
  return 'X'
}

function calculatePointType(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number
): PointType {
  // Exact score
  if (predHome === actualHome && predAway === actualAway) {
    return 'exact'
  }

  const predOutcome = getOutcome(predHome, predAway)
  const actualOutcome = getOutcome(actualHome, actualAway)

  // Correct result: right outcome + right goal diff (for non-draws)
  if (
    predOutcome === actualOutcome &&
    predHome - predAway === actualHome - actualAway
  ) {
    return 'correctResult'
  }

  // Half score: one team's score is correct
  if (predHome === actualHome || predAway === actualAway) {
    if (predOutcome === actualOutcome) {
      return 'halfScore'
    }
  }

  // Correct outcome only
  if (predOutcome === actualOutcome) {
    return 'outcome'
  }

  return 'miss'
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
