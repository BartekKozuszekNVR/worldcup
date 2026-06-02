import { defineEventHandler } from 'h3'
import { db } from '../../utils/db'
import { users, userScores } from '../../database/schema'
import { eq, desc } from 'drizzle-orm'
import { recalculateAllScores } from '../../utils/scoring'

export default defineEventHandler(async () => {
  // Recalculate all scores first
  await recalculateAllScores()

  // Then fetch and return the updated leaderboard
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      matchPoints: userScores.matchPoints,
      bonusPoints: userScores.bonusPoints,
      totalPoints: userScores.totalPoints,
      exactScores: userScores.exactScores,
      correctResults: userScores.correctResults,
      halfScoreCorrect: userScores.halfScoreCorrect,
      correctOutcomes: userScores.correctOutcomes,
      predictionCount: userScores.predictionCount,
    })
    .from(users)
    .leftJoin(userScores, eq(users.id, userScores.userId))
    .orderBy(desc(userScores.totalPoints), desc(userScores.exactScores))

  // Add rank to each user
  return result.map((user, index) => ({
    ...user,
    rank: index + 1,
    matchPoints: user.matchPoints || 0,
    bonusPoints: user.bonusPoints || 0,
    totalPoints: user.totalPoints || 0,
    exactScores: user.exactScores || 0,
    correctResults: user.correctResults || 0,
    halfScoreCorrect: user.halfScoreCorrect || 0,
    correctOutcomes: user.correctOutcomes || 0,
    predictionCount: user.predictionCount || 0,
  }))
})
