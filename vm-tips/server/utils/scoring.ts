import { db } from './db'
import { predictions, matchResults, tournamentProgress, userScores, users, topScorerPredictions, thirdPlaceOverrides as thirdPlaceOverridesTable } from '../database/schema'
import { eq, and, isNotNull, inArray } from 'drizzle-orm'
import {
  calculateAllGroupStandings,
  extractGroupPlacements,
  GROUPS,
  type GroupMatchPrediction,
  type SimulatedTeam
} from './groupSimulation'
import { simulateUserBracket, type BracketMatch, type KnockoutPrediction } from './bracketSimulation'

// ─────────────────────────────────────────────────────────────────
// SCORING CONSTANTS (mirrored from src/services/scoring.ts)
// ─────────────────────────────────────────────────────────────────
export const STAGE_MULTIPLIERS: Record<string, number> = {
  group: 1,
  r32: 1.5,
  r16: 2,
  qf: 2.5,
  sf: 3,
  third: 2,
  final: 4,
}

export const MATCH_POINTS = {
  exact: 5,
  correctResult: 3,
  halfScore: 1.5,
  outcome: 1,
}

export const BONUS_POINTS = {
  groupWinner: 5,
  groupRunner: 3,
  advancing: 2,
  semifinalist: 10,
  finalist: 15,
  champion: 25,
  topScorer: 20,
  bronzeParticipant: 3,
  bronzeWinner: 8,
}

// ─────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────

/**
 * Get the stage from a matchId
 */
function getStageFromMatchId(matchId: string): string {
  if (matchId.startsWith('R32')) return 'r32'
  if (matchId.startsWith('R16')) return 'r16'
  if (matchId.startsWith('QF')) return 'qf'
  if (matchId.startsWith('SF')) return 'sf'
  if (matchId === 'THIRD') return 'third'
  if (matchId === 'FINAL') return 'final'
  return 'group' // A1, B2, etc.
}

/**
 * Calculate base points for a single prediction vs result
 * @param predHome - predicted home score
 * @param predAway - predicted away score
 * @param actualHome - actual home score
 * @param actualAway - actual away score
 * @param isKnockout - whether this is a knockout match
 * @param teamsMatch - whether the predicted teams match the actual teams
 */
export function calculateBasePoints(
  predHome: number | null,
  predAway: number | null,
  actualHome: number | null,
  actualAway: number | null,
  isKnockout: boolean = false,
  teamsMatch: boolean = true
): { points: number; type: 'exact' | 'correctResult' | 'halfScore' | 'outcome' | 'miss' } {
  // If either prediction or result is incomplete, no points
  if (predHome === null || predAway === null || actualHome === null || actualAway === null) {
    return { points: 0, type: 'miss' }
  }

  // 1. Exact score (5 pts) - correct teams AND correct score
  if (teamsMatch && predHome === actualHome && predAway === actualAway) {
    return { points: MATCH_POINTS.exact, type: 'exact' }
  }

  // 2. Correct Result (3 pts) - knockout only, different teams, same scoreline
  if (isKnockout && !teamsMatch && predHome === actualHome && predAway === actualAway) {
    return { points: MATCH_POINTS.correctResult, type: 'correctResult' }
  }

  // 3. Half Score (1.5 pts) - home OR away score matches
  if (predHome === actualHome || predAway === actualAway) {
    return { points: MATCH_POINTS.halfScore, type: 'halfScore' }
  }

  // 4. Correct Outcome (1 pt) - right winner or draw, no score match
  const predOutcome = predHome > predAway ? 'home' : predHome < predAway ? 'away' : 'draw'
  const actualOutcome = actualHome > actualAway ? 'home' : actualHome < actualAway ? 'away' : 'draw'

  if (predOutcome === actualOutcome) {
    return { points: MATCH_POINTS.outcome, type: 'outcome' }
  }

  // 5. No match
  return { points: 0, type: 'miss' }
}

// ─────────────────────────────────────────────────────────────────
// BONUS CALCULATION HELPERS
// ─────────────────────────────────────────────────────────────────

interface PredictionsMap {
  group: Record<string, GroupMatchPrediction>
  knockout: Record<string, KnockoutPrediction>
}

/**
 * Rank third-place teams across all groups
 */
function rankThirdPlaceTeams(
  standings: Record<string, SimulatedTeam[]>,
  thirdPlaceOverrides: Record<string, number> = {}
): SimulatedTeam[] {
  const thirdPlaceTeams: SimulatedTeam[] = []

  for (const group of GROUPS) {
    const groupStandings = standings[group]
    if (groupStandings && groupStandings[2]) {
      thirdPlaceTeams.push(groupStandings[2])
    }
  }

  // Sort by: points > goal diff > goals for > overrides > alphabetical
  return thirdPlaceTeams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor

    const oa = thirdPlaceOverrides[a.code]
    const ob = thirdPlaceOverrides[b.code]
    if (oa !== undefined && ob !== undefined) return oa - ob
    if (oa !== undefined) return -1
    if (ob !== undefined) return 1

    return a.code.localeCompare(b.code)
  })
}

/**
 * Get predicted third place teams (best 8 third-place teams)
 */
function getPredictedThirdPlaceTeams(
  standings: Record<string, SimulatedTeam[]>,
  thirdPlaceOverrides: Record<string, number> = {}
): string[] {
  const thirdPlaceRanked = rankThirdPlaceTeams(standings, thirdPlaceOverrides)
  const teams: string[] = []
  for (let i = 0; i < 8 && i < thirdPlaceRanked.length; i++) {
    if (thirdPlaceRanked[i]?.code) teams.push(thirdPlaceRanked[i].code)
  }
  return teams
}

/**
 * Resolve winner of a knockout match from prediction
 * For knockout matches, we need homeTeam and awayTeam from the match result (or resolved from bracket)
 */
function resolveKnockoutWinner(
  prediction: KnockoutPrediction | undefined,
  homeTeam: string | null,
  awayTeam: string | null
): string | null {
  if (!prediction || prediction.homeScore === null || prediction.awayScore === null) {
    return null
  }
  if (!homeTeam || !awayTeam) {
    return null
  }

  if (prediction.homeScore > prediction.awayScore) {
    return homeTeam
  }
  if (prediction.awayScore > prediction.homeScore) {
    return awayTeam
  }

  // Draw - use penalty winner
  return prediction.penaltyWinner || null
}

/**
 * Calculate predicted semifinalists from knockout predictions
 * Semifinalists are winners of QF matches
 */
function getPredictedSemifinalists(
  knockoutPredictions: Record<string, KnockoutPrediction>,
  bracket: Record<string, BracketMatch>
): string[] {
  const semifinalists: string[] = []
  const qfMatches = ['QF-1', 'QF-2', 'QF-3', 'QF-4']

  for (const matchId of qfMatches) {
    const prediction = knockoutPredictions[matchId]
    const match = bracket[matchId]
    if (prediction && match) {
      const winner = resolveKnockoutWinner(prediction, match.homeTeam, match.awayTeam)
      if (winner) semifinalists.push(winner)
    }
  }

  return semifinalists
}

/**
 * Calculate predicted finalists from knockout predictions
 * Finalists are winners of SF matches
 */
function getPredictedFinalists(
  knockoutPredictions: Record<string, KnockoutPrediction>,
  bracket: Record<string, BracketMatch>
): string[] {
  const finalists: string[] = []
  const sfMatches = ['SF-1', 'SF-2']

  for (const matchId of sfMatches) {
    const prediction = knockoutPredictions[matchId]
    const match = bracket[matchId]
    if (prediction && match) {
      const winner = resolveKnockoutWinner(prediction, match.homeTeam, match.awayTeam)
      if (winner) finalists.push(winner)
    }
  }

  return finalists
}

/**
 * Calculate predicted champion from FINAL prediction
 */
function getPredictedChampion(
  knockoutPredictions: Record<string, KnockoutPrediction>,
  bracket: Record<string, BracketMatch>
): string | null {
  const prediction = knockoutPredictions['FINAL']
  const match = bracket['FINAL']
  if (prediction && match) {
    return resolveKnockoutWinner(prediction, match.homeTeam, match.awayTeam)
  }
  return null
}

/**
 * Count matches between two arrays
 */
function countMatches(predicted: string[], actual: string[]): number {
  const actualSet = new Set(actual)
  return predicted.filter((code) => actualSet.has(code)).length
}

/**
 * Build knockout teams map from match results
 * This tells us which teams are in each knockout match
 */
function buildKnockoutTeamsMap(
  allResults: { matchId: string; homeTeam: string | null; awayTeam: string | null }[]
): Record<string, { home: string | null; away: string | null }> {
  const teamsMap: Record<string, { home: string | null; away: string | null }> = {}

  for (const result of allResults) {
    if (result.matchId.startsWith('R32') ||
        result.matchId.startsWith('R16') ||
        result.matchId.startsWith('QF') ||
        result.matchId.startsWith('SF') ||
        result.matchId === 'FINAL' ||
        result.matchId === 'THIRD') {
      teamsMap[result.matchId] = {
        home: result.homeTeam,
        away: result.awayTeam
      }
    }
  }

  return teamsMap
}

/**
 * Count how many matches in a specific group have results
 */
function countMatchesInGroup(group: string, allResults: Array<{ matchId: string }>): number {
  return allResults.filter(r => r.matchId.startsWith(group)).length
}

/**
 * Check if a specific group stage is complete (all 6 matches have results)
 */
function isGroupComplete(group: string, allResults: Array<{ matchId: string }>): boolean {
  return countMatchesInGroup(group, allResults) === 6
}

/**
 * Check if all group stages are complete (72 total matches: 12 groups × 6 matches)
 */
function isAllGroupStageComplete(allResults: Array<{ matchId: string }>): boolean {
  // Only count group stage matches (not knockout)
  const groupMatches = allResults.filter(r => {
    const matchId = r.matchId
    return !matchId.startsWith('R32') &&
           !matchId.startsWith('R16') &&
           !matchId.startsWith('QF') &&
           !matchId.startsWith('SF') &&
           matchId !== 'THIRD' &&
           matchId !== 'FINAL'
  })
  return groupMatches.length === 72
}

/**
 * Check if any knockout matches have results
 */
function hasKnockoutResults(allResults: Array<{ matchId: string }>): boolean {
  return allResults.some(r => {
    const matchId = r.matchId
    return matchId.startsWith('R32') ||
           matchId.startsWith('R16') ||
           matchId.startsWith('QF') ||
           matchId.startsWith('SF') ||
           matchId === 'THIRD' ||
           matchId === 'FINAL'
  })
}

/**
 * Calculate full bonus points for a user
 */
function calculateUserBonusPoints(
  userPreds: PredictionsMap,
  progressMap: Map<string, string>,
  knockoutTeamsMap: Record<string, { home: string | null; away: string | null }>,
  thirdPlaceOverrides: Record<string, number> = {},
  actualBronzeWinner: string | null = null,
  allResults: Array<{ matchId: string }> = []
): number {
  let bonus = 0

  // 1. Simulate group standings from user's predictions
  const predictedStandings = calculateAllGroupStandings(userPreds.group)
  const predictedPlacements = extractGroupPlacements(predictedStandings)

  // 2. Compare group winners and runners - ONLY if each group is complete (6 matches)
  for (const group of GROUPS) {
    if (!isGroupComplete(group, allResults)) {
      continue // Skip bonus for groups not yet complete
    }

    const actualWinner = progressMap.get(`group${group}_winner`)
    const actualRunner = progressMap.get(`group${group}_runner`)
    const predictedWinner = predictedPlacements.winners[group]
    const predictedRunner = predictedPlacements.runners[group]

    if (predictedWinner && predictedWinner === actualWinner) {
      bonus += BONUS_POINTS.groupWinner
    }
    if (predictedRunner && predictedRunner === actualRunner) {
      bonus += BONUS_POINTS.groupRunner
    }
  }

  // 3. Calculate advancing teams bonus (third-place teams only, with overrides)
  // ONLY if ALL group stage is complete (all 72 group matches)
  if (isAllGroupStageComplete(allResults)) {
    const predictedThirdPlace = getPredictedThirdPlaceTeams(predictedStandings, thirdPlaceOverrides)
    const actualThirdPlace: string[] = []
    for (let i = 1; i <= 8; i++) {
      const thirdPlace = progressMap.get(`bestThird_${i}`)
      if (thirdPlace) actualThirdPlace.push(thirdPlace)
    }

    const thirdPlaceMatches = countMatches(predictedThirdPlace, actualThirdPlace)
    bonus += thirdPlaceMatches * BONUS_POINTS.advancing
  }

  // 4. Simulate full user bracket for knockout bonuses
  // ONLY if knockout matches have results
  if (hasKnockoutResults(allResults)) {
    const bracket = simulateUserBracket(predictedStandings, userPreds.knockout, thirdPlaceOverrides)

    // 5. Calculate semifinalists bonus
    const predictedSemifinalists = getPredictedSemifinalists(userPreds.knockout, bracket)
    const actualSemifinalists: string[] = []
    for (let i = 1; i <= 4; i++) {
      const sf = progressMap.get(`semifinalist_${i}`)
      if (sf) actualSemifinalists.push(sf)
    }
    const semifinalistMatches = countMatches(predictedSemifinalists, actualSemifinalists)
    bonus += semifinalistMatches * BONUS_POINTS.semifinalist

    // 6. Calculate finalists bonus
    const predictedFinalists = getPredictedFinalists(userPreds.knockout, bracket)
    const actualFinalists: string[] = []
    for (let i = 1; i <= 2; i++) {
      const f = progressMap.get(`finalist_${i}`)
      if (f) actualFinalists.push(f)
    }
    const finalistMatches = countMatches(predictedFinalists, actualFinalists)
    bonus += finalistMatches * BONUS_POINTS.finalist

    // 7. Calculate champion bonus
    const predictedChampion = getPredictedChampion(userPreds.knockout, bracket)
    const actualChampion = progressMap.get('champion')
    if (predictedChampion && actualChampion && predictedChampion === actualChampion) {
      bonus += BONUS_POINTS.champion
    }

    // 8. Bronze participant + winner bonuses
    const bronzeMatch = bracket['THIRD']
    if (bronzeMatch?.homeTeam && bronzeMatch?.awayTeam) {
      const actualBronze = knockoutTeamsMap['THIRD']
      if (actualBronze) {
        if (bronzeMatch.homeTeam === actualBronze.home) bonus += BONUS_POINTS.bronzeParticipant
        if (bronzeMatch.awayTeam === actualBronze.away) bonus += BONUS_POINTS.bronzeParticipant
      }
      if (actualBronzeWinner) {
        const bronzePred = userPreds.knockout['THIRD']
        if (bronzePred) {
          const predictedBronzeWinner = resolveKnockoutWinner(bronzePred, bronzeMatch.homeTeam, bronzeMatch.awayTeam)
          if (predictedBronzeWinner === actualBronzeWinner) {
            bonus += BONUS_POINTS.bronzeWinner
          }
        }
      }
    }
  }

  return bonus
}

// ─────────────────────────────────────────────────────────────────
// MAIN RECALCULATION FUNCTION
// ─────────────────────────────────────────────────────────────────

/**
 * Recalculate scores for all users based on current match results
 */
export async function recalculateAllScores(): Promise<void> {
  // 1. Get all match results
  const allResults = await db.select().from(matchResults)
  const resultsMap = new Map<string, { homeScore: number | null; awayScore: number | null }>()
  for (const r of allResults) {
    resultsMap.set(r.matchId, { homeScore: r.homeScore, awayScore: r.awayScore })
  }

  // 2. Build knockout teams map for bonus calculation
  const knockoutTeamsMap = buildKnockoutTeamsMap(
    allResults.map((r) => ({ matchId: r.matchId, homeTeam: r.homeTeam, awayTeam: r.awayTeam }))
  )

  // 3. Get all tournament progress (for bonus points)
  const allProgress = await db.select().from(tournamentProgress)
  const progressMap = new Map<string, string>()
  for (const p of allProgress) {
    progressMap.set(p.key, p.teamCode)
  }

  // 4. Get all users
  const allUsers = await db.select({ id: users.id }).from(users)

  // Get all third-place overrides for tiebreaker resolution
  const overrideRows = await db.select().from(thirdPlaceOverridesTable)

  // Resolve actual bronze winner from THIRD match result
  const thirdResult = allResults.find(r => r.matchId === 'THIRD')
  const thirdTeams = knockoutTeamsMap['THIRD']
  let actualBronzeWinner: string | null = null
  if (thirdResult && thirdTeams?.home && thirdTeams?.away && thirdResult.homeScore !== null && thirdResult.awayScore !== null) {
    if (thirdResult.homeScore > thirdResult.awayScore) actualBronzeWinner = thirdTeams.home
    else if (thirdResult.awayScore > thirdResult.homeScore) actualBronzeWinner = thirdTeams.away
    else actualBronzeWinner = thirdResult.penaltyWinner ?? null
  }

  // 5. For each user, calculate their score
  for (const user of allUsers) {
    // Get user's predictions
    const userPredictions = await db
      .select()
      .from(predictions)
      .where(eq(predictions.userId, user.id))

    // Separate group and knockout predictions
    const userPreds: PredictionsMap = {
      group: {},
      knockout: {}
    }

    for (const pred of userPredictions) {
      if (pred.matchType === 'knockout') {
        userPreds.knockout[pred.matchId] = {
          homeScore: pred.homeScore,
          awayScore: pred.awayScore,
          penaltyWinner: pred.penaltyWinner
        }
      } else {
        userPreds.group[pred.matchId] = {
          homeScore: pred.homeScore,
          awayScore: pred.awayScore
        }
      }
    }

    // Build user's third-place overrides map
    const overrides: Record<string, number> = {}
    for (const row of overrideRows) {
      if (row.userId === user.id) {
        overrides[row.teamCode] = row.rank
      }
    }

    let matchPoints = 0
    let exactScores = 0
    let correctResults = 0
    let halfScoreCorrect = 0
    let correctOutcomes = 0

    // Simulate user's bracket once for teamsMatch checks
    const predictedStandings = calculateAllGroupStandings(userPreds.group)
    const bracket = simulateUserBracket(predictedStandings, userPreds.knockout, overrides)

    // Calculate match points
    for (const pred of userPredictions) {
      const result = resultsMap.get(pred.matchId)
      if (!result) continue

      const stage = getStageFromMatchId(pred.matchId)
      const isKnockout = stage !== 'group'
      
      // For knockout matches, check if user's predicted teams match actual teams
      let teamsMatch = true
      if (isKnockout) {
        const actualTeams = knockoutTeamsMap[pred.matchId]
        if (actualTeams?.home && actualTeams?.away) {
          const bracketMatch = bracket[pred.matchId]
          teamsMatch = bracketMatch?.homeTeam === actualTeams.home && bracketMatch?.awayTeam === actualTeams.away
        }
      }

      const { points, type } = calculateBasePoints(
        pred.homeScore,
        pred.awayScore,
        result.homeScore,
        result.awayScore,
        isKnockout,
        teamsMatch
      )

      const multiplier = STAGE_MULTIPLIERS[stage] || 1
      matchPoints += points * multiplier

      if (type === 'exact') exactScores++
      else if (type === 'correctResult') correctResults++
      else if (type === 'halfScore') halfScoreCorrect++
      else if (type === 'outcome') correctOutcomes++
    }

    // Calculate bonus points using the new helper function
    const bonusPoints = calculateUserBonusPoints(userPreds, progressMap, knockoutTeamsMap, overrides, actualBronzeWinner, allResults)

    // Check top scorer prediction
    let topScorerBonus = 0
    const topScorerPred = await db
      .select()
      .from(topScorerPredictions)
      .where(eq(topScorerPredictions.userId, user.id))
      .limit(1)
    if (topScorerPred.length > 0 && topScorerPred[0].isCorrect === 1) {
      topScorerBonus = BONUS_POINTS.topScorer
    }

    const totalPoints = matchPoints + bonusPoints + topScorerBonus

    // Update or insert user score
    const existingScore = await db
      .select()
      .from(userScores)
      .where(eq(userScores.userId, user.id))
      .limit(1)

    if (existingScore.length > 0) {
      await db
        .update(userScores)
        .set({
          matchPoints,
          bonusPoints: bonusPoints + topScorerBonus,
          totalPoints,
          exactScores,
          correctResults,
          halfScoreCorrect,
          correctOutcomes,
          predictionCount: userPredictions.length,
          calculatedAt: new Date().toISOString(),
        })
        .where(eq(userScores.userId, user.id))
    } else {
      await db.insert(userScores).values({
        userId: user.id,
        matchPoints,
        bonusPoints: bonusPoints + topScorerBonus,
        totalPoints,
        exactScores,
        correctResults,
        halfScoreCorrect,
        correctOutcomes,
        predictionCount: userPredictions.length,
        calculatedAt: new Date().toISOString(),
      })
    }
  }
}

/**
 * Recalculate scores for a single user
 */
export async function recalculateUserScore(userId: number): Promise<void> {
  // Get all match results
  const allResults = await db.select().from(matchResults)
  const resultsMap = new Map<string, { homeScore: number | null; awayScore: number | null }>()
  for (const r of allResults) {
    resultsMap.set(r.matchId, { homeScore: r.homeScore, awayScore: r.awayScore })
  }

  // Build knockout teams map for bonus calculation
  const knockoutTeamsMap = buildKnockoutTeamsMap(
    allResults.map((r) => ({ matchId: r.matchId, homeTeam: r.homeTeam, awayTeam: r.awayTeam }))
  )

  // Get tournament progress
  const allProgress = await db.select().from(tournamentProgress)
  const progressMap = new Map<string, string>()
  for (const p of allProgress) {
    progressMap.set(p.key, p.teamCode)
  }

  // Get user's third-place overrides
  const overrideRows = await db
    .select()
    .from(thirdPlaceOverridesTable)
    .where(eq(thirdPlaceOverridesTable.userId, userId))
  const overrides: Record<string, number> = {}
  for (const row of overrideRows) {
    overrides[row.teamCode] = row.rank
  }

  // Resolve actual bronze winner from THIRD match result
  const thirdResult = allResults.find(r => r.matchId === 'THIRD')
  const thirdTeams = knockoutTeamsMap['THIRD']
  let actualBronzeWinner: string | null = null
  if (thirdResult && thirdTeams?.home && thirdTeams?.away && thirdResult.homeScore !== null && thirdResult.awayScore !== null) {
    if (thirdResult.homeScore > thirdResult.awayScore) actualBronzeWinner = thirdTeams.home
    else if (thirdResult.awayScore > thirdResult.homeScore) actualBronzeWinner = thirdTeams.away
    else actualBronzeWinner = thirdResult.penaltyWinner ?? null
  }

  // Get user's predictions
  const userPredictions = await db
    .select()
    .from(predictions)
    .where(eq(predictions.userId, userId))

  // Separate group and knockout predictions
  const userPreds: PredictionsMap = {
    group: {},
    knockout: {}
  }

  for (const pred of userPredictions) {
    if (pred.matchType === 'knockout') {
      userPreds.knockout[pred.matchId] = {
        homeScore: pred.homeScore,
        awayScore: pred.awayScore,
        penaltyWinner: pred.penaltyWinner
      }
    } else {
      userPreds.group[pred.matchId] = {
        homeScore: pred.homeScore,
        awayScore: pred.awayScore
      }
    }
  }

  let matchPoints = 0
  let exactScores = 0
  let correctResults = 0
  let halfScoreCorrect = 0
  let correctOutcomes = 0

  // Simulate user's bracket once for teamsMatch checks
  const predictedStandings = calculateAllGroupStandings(userPreds.group)
  const bracket = simulateUserBracket(predictedStandings, userPreds.knockout, overrides)

  for (const pred of userPredictions) {
    const result = resultsMap.get(pred.matchId)
    if (!result) continue

    const stage = getStageFromMatchId(pred.matchId)
    const isKnockout = stage !== 'group'
    
    // For knockout matches, check if user's predicted teams match actual teams
    let teamsMatch = true
    if (isKnockout) {
      const actualTeams = knockoutTeamsMap[pred.matchId]
      if (actualTeams?.home && actualTeams?.away) {
        const bracketMatch = bracket[pred.matchId]
        teamsMatch = bracketMatch?.homeTeam === actualTeams.home && bracketMatch?.awayTeam === actualTeams.away
      }
    }

    const { points, type } = calculateBasePoints(
      pred.homeScore,
      pred.awayScore,
      result.homeScore,
      result.awayScore,
      isKnockout,
      teamsMatch
    )

    const multiplier = STAGE_MULTIPLIERS[stage] || 1
    matchPoints += points * multiplier

    if (type === 'exact') exactScores++
    else if (type === 'correctResult') correctResults++
    else if (type === 'halfScore') halfScoreCorrect++
    else if (type === 'outcome') correctOutcomes++
  }

  // Calculate bonus points using the helper function
  const bonusPoints = calculateUserBonusPoints(userPreds, progressMap, knockoutTeamsMap, overrides, actualBronzeWinner, allResults)

  // Check top scorer prediction
  let topScorerBonus = 0
  const topScorerPred = await db
    .select()
    .from(topScorerPredictions)
    .where(eq(topScorerPredictions.userId, userId))
    .limit(1)
  if (topScorerPred.length > 0 && topScorerPred[0].isCorrect === 1) {
    topScorerBonus = BONUS_POINTS.topScorer
  }

  const totalPoints = matchPoints + bonusPoints + topScorerBonus

  const existingScore = await db
    .select()
    .from(userScores)
    .where(eq(userScores.userId, userId))
    .limit(1)

  if (existingScore.length > 0) {
    await db
      .update(userScores)
      .set({
        matchPoints,
        bonusPoints: bonusPoints + topScorerBonus,
        totalPoints,
        exactScores,
        correctResults,
        halfScoreCorrect,
        correctOutcomes,
        predictionCount: userPredictions.length,
        calculatedAt: new Date().toISOString(),
      })
      .where(eq(userScores.userId, userId))
  } else {
    await db.insert(userScores).values({
      userId,
      matchPoints,
      bonusPoints: bonusPoints + topScorerBonus,
      totalPoints,
      exactScores,
      correctResults,
      halfScoreCorrect,
      correctOutcomes,
      predictionCount: userPredictions.length,
      calculatedAt: new Date().toISOString(),
    })
  }
}

/**
 * Auto-derive group winners/runners from actual match results
 * Only fills keys that don't already exist in tournamentProgress (preserving manual overrides)
 */
export async function autoDeriveGroupProgress(): Promise<void> {
  const results = await db
    .select()
    .from(matchResults)
    .where(and(isNotNull(matchResults.homeScore), isNotNull(matchResults.awayScore)))

  const groupResults = results.filter(r => /^[A-L]\d+$/.test(r.matchId))

  const resultsMap: Record<string, GroupMatchPrediction> = {}
  for (const r of groupResults) {
    resultsMap[r.matchId] = { homeScore: r.homeScore, awayScore: r.awayScore }
  }

  const standings = calculateAllGroupStandings(resultsMap)
  const { winners, runners } = extractGroupPlacements(standings)

  // Get existing progress keys so we don't overwrite manual overrides
  const existingEntries = await db
    .select()
    .from(tournamentProgress)

  const existingKeys = new Set(existingEntries.map(e => e.key))

  for (const group of GROUPS) {
    const winnerKey = `group${group}_winner`
    const runnerKey = `group${group}_runner`

    if (winners[group] && !existingKeys.has(winnerKey)) {
      await db.insert(tournamentProgress).values({ key: winnerKey, teamCode: winners[group]! }).catch(() => {})
    }

    if (runners[group] && !existingKeys.has(runnerKey)) {
      await db.insert(tournamentProgress).values({ key: runnerKey, teamCode: runners[group]! }).catch(() => {})
    }
  }
}
