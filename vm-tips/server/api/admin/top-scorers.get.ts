import { defineEventHandler, createError } from 'h3'
import { db } from '../../utils/db'
import { topScorerPredictions, users } from '../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user || user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  // Get all users' top scorer predictions with user info
  const allUsers = await db.select({ id: users.id, username: users.username }).from(users)
  const allPredictions = await db.select().from(topScorerPredictions)

  const predictionsMap = new Map(allPredictions.map(p => [p.userId, p]))

  const result = allUsers.map(u => {
    const pred = predictionsMap.get(u.id)
    return {
      userId: u.id,
      username: u.username,
      playerName: pred?.playerName ?? null,
      isCorrect: pred?.isCorrect === 1,
    }
  }).filter(u => u.playerName !== null) // Only return users who have made a prediction

  return { predictions: result }
})
