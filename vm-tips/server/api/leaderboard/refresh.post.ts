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

  // Add rank with shared ranks for tied users (same totalPoints + exactScores)
  let currentRank = 1
  return result.map((user, index) => {
    const totalPoints = user.totalPoints || 0
    const exactScores = user.exactScores || 0

    if (index > 0) {
      const prev = result[index - 1]
      const prevTotal = prev.totalPoints || 0
      const prevExact = prev.exactScores || 0
      if (totalPoints !== prevTotal || exactScores !== prevExact) {
        currentRank = index + 1
      }
    }

    return {
      ...user,
      rank: currentRank,
      matchPoints: user.matchPoints || 0,
      bonusPoints: user.bonusPoints || 0,
      totalPoints,
      exactScores,
      correctResults: user.correctResults || 0,
      halfScoreCorrect: user.halfScoreCorrect || 0,
      correctOutcomes: user.correctOutcomes || 0,
      predictionCount: user.predictionCount || 0,
    }
  })
})
