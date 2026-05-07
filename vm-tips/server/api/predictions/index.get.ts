import { defineEventHandler, createError } from 'h3'
import { db } from '../../utils/db'
import { predictions, thirdPlaceOverrides } from '../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Get all predictions for current user
  const result = await db
    .select()
    .from(predictions)
    .where(eq(predictions.userId, user.id))

  // Get third-place overrides for current user
  const overridesResult = await db
    .select()
    .from(thirdPlaceOverrides)
    .where(eq(thirdPlaceOverrides.userId, user.id))

  // Transform to the format expected by the frontend
  const groupPredictions: Record<string, { homeScore: number | null; awayScore: number | null }> = {}
  const knockoutPredictions: Record<
    string,
    { homeScore: number | null; awayScore: number | null; penaltyWinner?: string | null }
  > = {}

  for (const pred of result) {
    if (pred.matchType === 'group') {
      groupPredictions[pred.matchId] = {
        homeScore: pred.homeScore,
        awayScore: pred.awayScore,
      }
    } else {
      knockoutPredictions[pred.matchId] = {
        homeScore: pred.homeScore,
        awayScore: pred.awayScore,
        penaltyWinner: pred.penaltyWinner,
      }
    }
  }

  // Transform overrides to { teamCode: rank } format
  const thirdPlaceOverridesMap: Record<string, number> = {}
  for (const override of overridesResult) {
    thirdPlaceOverridesMap[override.teamCode] = override.rank
  }

  return {
    predictions: groupPredictions,
    knockoutPredictions,
    thirdPlaceOverrides: thirdPlaceOverridesMap,
  }
})
