import { defineEventHandler, createError } from 'h3'
import { db } from '../../../../utils/db'
import { predictions, thirdPlaceOverrides, userScores } from '../../../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Only admins can reset predictions
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const userId = Number(event.context.params?.userId)
  if (!userId || isNaN(userId)) {
    throw createError({
      statusCode: 400,
      message: 'Valid user ID required',
    })
  }

  // Delete all predictions for this user
  await db.delete(predictions).where(eq(predictions.userId, userId))

  // Delete third place overrides
  await db.delete(thirdPlaceOverrides).where(eq(thirdPlaceOverrides.userId, userId))

  // Reset user scores
  await db
    .update(userScores)
    .set({
      matchPoints: 0,
      bonusPoints: 0,
      totalPoints: 0,
      exactScores: 0,
      correctResults: 0,
      halfScoreCorrect: 0,
      correctOutcomes: 0,
      predictionCount: 0,
    })
    .where(eq(userScores.userId, userId))

  return {
    success: true,
    message: 'Predictions reset successfully',
  }
})
