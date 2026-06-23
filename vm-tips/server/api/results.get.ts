import { defineEventHandler, createError } from 'h3'
import { db } from '../utils/db'
import { matchResults, tournamentProgress, predictions, userScores, topScorerPredictions, thirdPlaceOverrides as thirdPlaceOverridesTable } from '../database/schema'
import { and, eq, isNotNull } from 'drizzle-orm'
import { STAGE_MULTIPLIERS, BONUS_POINTS, calculateBasePoints } from '../utils/scoring'
import { calculateAllGroupStandings } from '../utils/groupSimulation'
import { simulateUserBracket } from '../utils/bracketSimulation'

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

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Run all independent DB queries in parallel to minimize round-trips to Turso
  const [results, progress, userPredictions, cachedScore, overrideRows, topScorerPred] = await Promise.all([
    // Get only matches with complete results (both scores not null)
    db
      .select()
      .from(matchResults)
      .where(and(isNotNull(matchResults.homeScore), isNotNull(matchResults.awayScore))),
    // Get tournament progress for bonus data
    db.select().from(tournamentProgress),
    // Get user's predictions to compute per-match scores
    db.select().from(predictions).where(eq(predictions.userId, user.id)),
    // Get cached user scores from authoritative source
    db.select().from(userScores).where(eq(userScores.userId, user.id)).limit(1),
    // Get user's third-place overrides for bracket simulation
    db.select().from(thirdPlaceOverridesTable).where(eq(thirdPlaceOverridesTable.userId, user.id)),
    // Get user's top scorer prediction
    db.select().from(topScorerPredictions).where(eq(topScorerPredictions.userId, user.id)).limit(1),
  ])

  // Format results with stage info
  const formattedResults = results.map((r) => ({
    matchId: r.matchId,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    stage: getStageFromMatchId(r.matchId),
    penaltyWinner: r.penaltyWinner,
  }))

  const bonusData: Record<string, string> = {}
  for (const entry of progress) {
    bonusData[entry.key] = entry.teamCode
  }

  const predictionsMap = new Map<string, { homeScore: number | null; awayScore: number | null }>()
  for (const pred of userPredictions) {
    predictionsMap.set(pred.matchId, { homeScore: pred.homeScore, awayScore: pred.awayScore })
  }

  const matchPoints = cachedScore.length > 0 ? cachedScore[0].matchPoints : 0
  const bonusPoints = cachedScore.length > 0 ? cachedScore[0].bonusPoints : 0
  const totalPoints = cachedScore.length > 0 ? cachedScore[0].totalPoints : 0

  const overrides: Record<string, number> = {}
  for (const row of overrideRows) {
    overrides[row.teamCode] = row.rank
  }

  // Build group and knockout prediction maps for bracket simulation
  const groupPreds: Record<string, { homeScore: number | null; awayScore: number | null }> = {}
  const knockoutPreds: Record<string, { homeScore: number | null; awayScore: number | null; penaltyWinner: string | null }> = {}
  for (const pred of userPredictions) {
    if (pred.matchType === 'group') {
      groupPreds[pred.matchId] = { homeScore: pred.homeScore, awayScore: pred.awayScore }
    } else {
      knockoutPreds[pred.matchId] = { homeScore: pred.homeScore, awayScore: pred.awayScore, penaltyWinner: pred.penaltyWinner }
    }
  }

  // Simulate user's full bracket
  const standings = calculateAllGroupStandings(groupPreds)
  const bracket = simulateUserBracket(standings, knockoutPreds, overrides)

  // Calculate per-match scores for display using canonical scoring logic
  const scores: Record<string, { points: number; type: string }> = {}

  for (const result of formattedResults) {
    const pred = predictionsMap.get(result.matchId)
    if (pred) {
      const isKnockout = result.stage !== 'group'
      const bracketMatch = bracket[result.matchId]
      const teamsMatch = !isKnockout || (bracketMatch?.homeTeam === result.homeTeam && bracketMatch?.awayTeam === result.awayTeam)
      const { points, type } = calculateBasePoints(
        pred.homeScore,
        pred.awayScore,
        result.homeScore,
        result.awayScore,
        isKnockout,
        teamsMatch
      )
      const multiplier = STAGE_MULTIPLIERS[result.stage] || 1
      scores[result.matchId] = { points: points * multiplier, type }
    } else {
      scores[result.matchId] = { points: 0, type: 'miss' }
    }
  }

  // Top scorer bonus (not included in displayed bonusPoints to avoid double-count)
  const topScorerPoints = topScorerPred.length > 0 && topScorerPred[0].isCorrect === 1 ? BONUS_POINTS.topScorer : 0
  const displayBonusPoints = bonusPoints - topScorerPoints

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
      bonusPoints: displayBonusPoints,
      scores,
    },
    topScorer: {
      prediction: topScorerPred.length > 0 ? topScorerPred[0].playerName : null,
      isCorrect: topScorerPred.length > 0 ? topScorerPred[0].isCorrect === 1 : false,
      points: topScorerPoints,
      actualTopScorers,
    },
  }
})
