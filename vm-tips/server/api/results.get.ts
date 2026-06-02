import { defineEventHandler, createError } from 'h3'
import { db } from '../utils/db'
import { matchResults, tournamentProgress, predictions, userScores, topScorerPredictions } from '../database/schema'
import { and, eq, isNotNull } from 'drizzle-orm'
import { STAGE_MULTIPLIERS, BONUS_POINTS, calculateBasePoints } from '../utils/scoring'
import { calculateAllGroupStandings } from '../utils/groupSimulation'
import { GROUPS } from '../data/groupMatches'

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

/** Compute the user's predicted advancing teams from their group predictions */
function getPredictedAdvancingTeams(userPredictions: typeof predictions.$inferSelect[]): Set<string> {
  const groupPredictions: Record<string, { homeScore: number | null; awayScore: number | null }> = {}
  for (const pred of userPredictions) {
    if (pred.matchType === 'group') {
      groupPredictions[pred.matchId] = { homeScore: pred.homeScore, awayScore: pred.awayScore }
    }
  }

  const standings = calculateAllGroupStandings(groupPredictions)
  const advancing = new Set<string>()

  for (const group of GROUPS) {
    const table = standings[group]
    if (table) {
      if (table[0]?.code) advancing.add(table[0].code)
      if (table[1]?.code) advancing.add(table[1].code)
    }
  }

  // Best 8 third-place teams
  const thirdPlace: { code: string; points: number; goalDiff: number; goalsFor: number }[] = []
  for (const group of GROUPS) {
    const table = standings[group]
    if (table && table[2]) {
      thirdPlace.push(table[2])
    }
  }
  thirdPlace.sort((a, b) => b.points - a.points || b.goalDiff - a.goalDiff || b.goalsFor - a.goalsFor || a.code.localeCompare(b.code))
  for (let i = 0; i < 8 && i < thirdPlace.length; i++) {
    if (thirdPlace[i]?.code) advancing.add(thirdPlace[i].code)
  }

  return advancing
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
    penaltyWinner: r.penaltyWinner,
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

  // Get cached user scores from authoritative source
  const cachedScore = await db
    .select()
    .from(userScores)
    .where(eq(userScores.userId, user.id))
    .limit(1)

  const matchPoints = cachedScore.length > 0 ? cachedScore[0].matchPoints : 0
  const bonusPoints = cachedScore.length > 0 ? cachedScore[0].bonusPoints : 0
  const totalPoints = cachedScore.length > 0 ? cachedScore[0].totalPoints : 0

  // Compute user's predicted advancing teams for teamsMatch check
  const predictedAdvancing = getPredictedAdvancingTeams(userPredictions)

  // Calculate per-match scores for display using canonical scoring logic
  const scores: Record<string, { points: number; type: string }> = {}

  for (const result of formattedResults) {
    const pred = predictionsMap.get(result.matchId)
    if (pred) {
      const isKnockout = result.stage !== 'group'
      const teamsMatch = !isKnockout || (predictedAdvancing.has(result.homeTeam) && predictedAdvancing.has(result.awayTeam))
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

  // Get user's top scorer prediction and status
  const topScorerPred = await db
    .select()
    .from(topScorerPredictions)
    .where(eq(topScorerPredictions.userId, user.id))
    .limit(1)

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
