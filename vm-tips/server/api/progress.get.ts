import { defineEventHandler, createError } from 'h3'
import { db } from '../utils/db'
import { tournamentProgress } from '../database/schema'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Get all tournament progress entries (available to all authenticated users)
  const progress = await db.select().from(tournamentProgress)

  // Return as a map for easy lookup
  const progressMap: Record<string, string> = {}
  for (const entry of progress) {
    progressMap[entry.key] = entry.teamCode
  }

  return progressMap
})
