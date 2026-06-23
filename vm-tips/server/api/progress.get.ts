import { defineEventHandler, createError, setResponseHeader } from 'h3'
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

  // Allow the browser to cache this response for 60s.
  // Progress only changes when an admin updates tournament state, so short-term
  // browser caching avoids redundant requests within the same session.
  setResponseHeader(event, 'Cache-Control', 'private, max-age=60')

  // Return as a map for easy lookup
  const progressMap: Record<string, string> = {}
  for (const entry of progress) {
    progressMap[entry.key] = entry.teamCode
  }

  return progressMap
})
