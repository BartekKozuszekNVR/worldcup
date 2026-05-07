import { defineEventHandler, createError } from 'h3'
import { db } from '../../utils/db'
import { users, userScores } from '../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Only admins can list all users with full details
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  // Get all users with their scores
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      role: users.role,
      createdAt: users.createdAt,
      totalPoints: userScores.totalPoints,
      predictionCount: userScores.predictionCount,
    })
    .from(users)
    .leftJoin(userScores, eq(users.id, userScores.userId))

  return result.map((u) => ({
    ...u,
    totalPoints: u.totalPoints || 0,
    predictionCount: u.predictionCount || 0,
  }))
})
