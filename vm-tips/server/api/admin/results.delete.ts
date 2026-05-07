import { defineEventHandler, createError } from 'h3'
import { db } from '../../utils/db'
import { matchResults, userScores } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Only admins can clear match results
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  // Delete all match results
  await db.delete(matchResults)

  // Reset all user scores to zero
  await db.update(userScores).set({
    matchPoints: 0,
    bonusPoints: 0,
    totalPoints: 0,
    exactScores: 0,
    correctDiffs: 0,
    correctOutcomes: 0,
    calculatedAt: new Date().toISOString(),
  })

  return {
    success: true,
    message: 'All results cleared and scores reset',
  }
})
