import { defineEventHandler, createError } from 'h3'
import { db } from '../../utils/db'
import { tournamentProgress, userScores } from '../../database/schema'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Only admins can clear tournament progress
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  // Delete all tournament progress
  await db.delete(tournamentProgress)

  // Reset bonus points to zero (keep match points)
  await db.update(userScores).set({
    bonusPoints: 0,
    totalPoints: userScores.matchPoints,
    calculatedAt: new Date().toISOString(),
  })

  return {
    success: true,
    message: 'All bonus data cleared',
  }
})
