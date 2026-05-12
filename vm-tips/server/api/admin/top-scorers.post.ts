import { defineEventHandler, readBody, createError } from 'h3'
import { db } from '../../utils/db'
import { topScorerPredictions } from '../../database/schema'
import { eq } from 'drizzle-orm'
import { recalculateAllScores } from '../../utils/scoring'

interface AwardEntry {
  userId: number
  isCorrect: boolean
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user || user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const body = await readBody<{ awards: AwardEntry[] }>(event)

  if (!body.awards || !Array.isArray(body.awards)) {
    throw createError({
      statusCode: 400,
      message: 'awards array is required',
    })
  }

  // Update isCorrect flag for each user
  for (const award of body.awards) {
    await db
      .update(topScorerPredictions)
      .set({ isCorrect: award.isCorrect ? 1 : 0 })
      .where(eq(topScorerPredictions.userId, award.userId))
  }

  // Recalculate all scores to reflect the changes
  await recalculateAllScores()

  return { success: true }
})
