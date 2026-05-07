import { defineEventHandler, createError } from 'h3'
import { db } from '../../../utils/db'
import { predictions, thirdPlaceOverrides, users, userScores } from '../../../database/schema'
import { eq } from 'drizzle-orm'
import { isTournamentLocked } from '../../../../shared/constants'

// Total number of matches that must be predicted to be considered "complete"
// 72 group stage matches + 32 knockout matches = 104 total
const TOTAL_MATCHES = 104

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Non-admins can only view others' predictions after tournament starts
  if (user.role !== 'admin' && !isTournamentLocked()) {
    throw createError({
      statusCode: 403,
      message: 'Predictions are only viewable after tournament starts',
    })
  }

  const userId = Number(event.context.params?.userId)
  if (!userId || isNaN(userId)) {
    throw createError({
      statusCode: 400,
      message: 'Valid user ID required',
    })
  }

  // Check if target user exists and get their info
  const targetUser = await db
    .select({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get()

  if (!targetUser) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  // Check if user has completed all predictions (skip for admins)
  if (user.role !== 'admin') {
    const scoreRecord = await db
      .select({ predictionCount: userScores.predictionCount })
      .from(userScores)
      .where(eq(userScores.userId, userId))
      .get()

    const predictionCount = scoreRecord?.predictionCount ?? 0

    if (predictionCount < TOTAL_MATCHES) {
      throw createError({
        statusCode: 403,
        message: 'User has not completed all predictions',
      })
    }
  }

  // Get all predictions for the target user
  const result = await db
    .select()
    .from(predictions)
    .where(eq(predictions.userId, userId))

  // Get third-place overrides for target user
  const overridesResult = await db
    .select()
    .from(thirdPlaceOverrides)
    .where(eq(thirdPlaceOverrides.userId, userId))

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
    user: targetUser,
  }
})
