import { defineEventHandler, readBody, createError } from 'h3'
import { db } from '../../utils/db'
import { tournamentProgress } from '../../database/schema'
import { eq } from 'drizzle-orm'
import { recalculateAllScores } from '../../utils/scoring'

interface ProgressBody {
  key?: string
  teamCode?: string
}

interface BulkProgressBody {
  entries?: ProgressBody[]
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Only admins can save tournament progress
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const body = await readBody<ProgressBody | BulkProgressBody>(event)

  // Support bulk updates
  if ('entries' in body && Array.isArray(body.entries)) {
    for (const entry of body.entries) {
      if (!entry.key || !entry.teamCode) continue

      const existing = await db
        .select()
        .from(tournamentProgress)
        .where(eq(tournamentProgress.key, entry.key))
        .limit(1)

      if (existing.length > 0) {
        await db
          .update(tournamentProgress)
          .set({
            teamCode: entry.teamCode,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tournamentProgress.key, entry.key))
      } else {
        await db.insert(tournamentProgress).values({
          key: entry.key,
          teamCode: entry.teamCode,
          updatedAt: new Date().toISOString(),
        })
      }
    }
  } else {
    // Single entry update
    const { key, teamCode } = body as ProgressBody

    if (!key || !teamCode) {
      throw createError({
        statusCode: 400,
        message: 'Key and team code are required',
      })
    }

    const existing = await db
      .select()
      .from(tournamentProgress)
      .where(eq(tournamentProgress.key, key))
      .limit(1)

    if (existing.length > 0) {
      await db
        .update(tournamentProgress)
        .set({
          teamCode,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tournamentProgress.key, key))
    } else {
      await db.insert(tournamentProgress).values({
        key,
        teamCode,
        updatedAt: new Date().toISOString(),
      })
    }
  }

  // Recalculate all user scores
  await recalculateAllScores()

  return {
    success: true,
    message: 'Tournament progress saved and scores recalculated',
  }
})
