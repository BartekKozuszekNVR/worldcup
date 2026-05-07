import { defineEventHandler, readBody, createError } from 'h3'
import { db } from '../../utils/db'
import { matchResults } from '../../database/schema'
import { eq } from 'drizzle-orm'
import { recalculateAllScores } from '../../utils/scoring'

interface ResultBody {
  matchId?: string
  homeTeam?: string | null
  awayTeam?: string | null
  homeScore?: number | null
  awayScore?: number | null
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Only admins can save match results
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const body = await readBody<ResultBody>(event)

  // Validate input
  if (!body.matchId) {
    throw createError({
      statusCode: 400,
      message: 'Match ID is required',
    })
  }

  const { matchId, homeTeam, awayTeam, homeScore, awayScore } = body

  // Check if result already exists
  const existing = await db
    .select()
    .from(matchResults)
    .where(eq(matchResults.matchId, matchId))
    .limit(1)

  if (existing.length > 0) {
    // Update existing result
    await db
      .update(matchResults)
      .set({
        homeTeam: homeTeam ?? null,
        awayTeam: awayTeam ?? null,
        homeScore: homeScore ?? null,
        awayScore: awayScore ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(matchResults.matchId, matchId))
  } else {
    // Insert new result
    await db.insert(matchResults).values({
      matchId,
      homeTeam: homeTeam ?? null,
      awayTeam: awayTeam ?? null,
      homeScore: homeScore ?? null,
      awayScore: awayScore ?? null,
      updatedAt: new Date().toISOString(),
    })
  }

  // Recalculate all user scores immediately
  await recalculateAllScores()

  return {
    success: true,
    message: 'Result saved and scores recalculated',
  }
})
