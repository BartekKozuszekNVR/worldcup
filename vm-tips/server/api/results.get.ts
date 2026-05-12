import { defineEventHandler, createError } from 'h3'
import { db } from '../utils/db'
import { matchResults, tournamentProgress, predictions, userScores, topScorerPredictions } from '../database/schema'
import { and, eq, isNotNull } from 'drizzle-orm'
import { STAGE_MULTIPLIERS, MATCH_POINTS, BONUS_POINTS } from '../utils/scoring'

type MatchStage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'

function getStageFromMatchId(matchId: string): MatchStage {
  if (matchId.startsWith('R32')) return 'r32'
  if (matchId.startsWith('R16')) return 'r16'
  if (matchId.startsWith('QF')) return 'qf'
  if (matchId.startsWith('SF')) return 'sf'
  if (matchId === 'THIRD') return 'third'
  if (matchId === 'FINAL') return 'final'
  return 'group'
}

/**
 * Scoring logic matching the authoritative server/utils/scoring.ts calculateBasePoints.
 * Note: teamsMatch/isKnockout are not available here (no team mapping context),
 * so the "correctResult" tier (knockout, different teams, same scoreline) is N/A.
 * For the per-user results page this is acceptable since group matches always have
 * teamsMatch=true and for knockout matches shown here the teams are the same.
 */
function calculateBasePoints(
  predHome: number | null,
  predAway: number | null,
  actualHome: number | null,
  actualAway: number | null,
): { points: number; type: string } {
  if (predHome === null || predAway === null || actualHome === null || actualAway === null) {
    return { points: 0, type: 'miss' }
  }

  // 1. Exact score (5 pts)
  if (predHome === actualHome && predAway === actualAway) {
    return { points: MATCH_POINTS.exact, type: 'exact' }
  }

  // 2. Half Score (1.5 pts) - home OR away score matches
  if (predHome === actualHome || predAway === actualAway) {
    return { points: MATCH_POINTS.halfScore, type: 'halfScore' }
  }

  // 3. Correct Outcome (1 pt) - right winner or draw, no score match
  const predOutcome = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw'
  const actualOutcome = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw'

  if (predOutcome === actualOutcome) {
    return { points: MATCH_POINTS.outcome, type: 'outcome' }
  }

  return { points: 0, type: 'miss' }
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Get only matches with complete results (both scores not null)
  const results = await db
    .select()
    .from(matchResults)
    .where(
      and(
        isNotNull(matchResults.homeScore),
        isNotNull(matchResults.awayScore)
      )
    )

  // Format results with stage info
  const formattedResults = results.map((r) => ({
    matchId: r.matchId,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    stage: getStageFromMatchId(r.matchId),
  }))

  // Get tournament progress for bonus data
  const progress = await db.select().from(tournamentProgress)
  const bonusData: Record<string, string> = {}
  for (const entry of progress) {
    bonusData[entry.key] = entry.teamCode
  }

  // Get user's predictions to compute per-match scores
  const userPredictions = await db
    .select()
    .from(predictions)
    .where(eq(predictions.userId, user.id))

  const predictionsMap = new Map<string, { homeScore: number | null; awayScore: number | null }>()
  for (const pred of userPredictions) {
    predictionsMap.set(pred.matchId, { homeScore: pred.homeScore, awayScore: pred.awayScore })
  }

  // Calculate per-match scores for the logged-in user
  const scores: Record<string, { points: number; type: string }> = {}
  let matchPoints = 0

  for (const result of formattedResults) {
    const pred = predictionsMap.get(result.matchId)
    if (pred) {
      const { points, type } = calculateBasePoints(
        pred.homeScore,
        pred.awayScore,
        result.homeScore,
        result.awayScore
      )
      const multiplier = STAGE_MULTIPLIERS[result.stage] || 1
      const totalMatchPoints = points * multiplier
      scores[result.matchId] = { points: totalMatchPoints, type }
      matchPoints += totalMatchPoints
    } else {
      scores[result.matchId] = { points: 0, type: 'miss' }
    }
  }

  // Get cached user scores for bonus/total
  const cachedScore = await db
    .select()
    .from(userScores)
    .where(eq(userScores.userId, user.id))
    .limit(1)

  const bonusPoints = cachedScore.length > 0 ? cachedScore[0].bonusPoints : 0
  const totalPoints = matchPoints + bonusPoints

  // Get user's top scorer prediction and status
  const topScorerPred = await db
    .select()
    .from(topScorerPredictions)
    .where(eq(topScorerPredictions.userId, user.id))
    .limit(1)

  // Get actual top scorers from progress data
  const actualTopScorers: string[] = []
  for (const [key, value] of Object.entries(bonusData)) {
    if (key.startsWith('topScorer_')) {
      actualTopScorers.push(value)
    }
  }

  return {
    results: formattedResults,
    bonusData,
    userPoints: {
      totalPoints,
      matchPoints,
      bonusPoints,
      scores,
    },
    topScorer: {
      prediction: topScorerPred.length > 0 ? topScorerPred[0].playerName : null,
      isCorrect: topScorerPred.length > 0 ? topScorerPred[0].isCorrect === 1 : false,
      points: topScorerPred.length > 0 && topScorerPred[0].isCorrect === 1 ? BONUS_POINTS.topScorer : 0,
      actualTopScorers,
    },
  }
})
