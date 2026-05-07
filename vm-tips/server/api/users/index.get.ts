import { defineEventHandler } from 'h3'
import { db } from '../../utils/db'
import { users } from '../../database/schema'

export default defineEventHandler(async () => {
  // Get all users (public info only for leaderboard)
  const result = await db
    .select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt,
    })
    .from(users)

  return result
})
