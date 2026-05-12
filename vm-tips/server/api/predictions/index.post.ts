import { defineEventHandler, readBody, createError } from 'h3'
import { db } from '../../utils/db'
import { predictions, userScores, thirdPlaceOverrides, topScorerPredictions } from '../../database/schema'
import { eq, and, sql } from 'drizzle-orm'
import { isTournamentLocked } from '../../../shared/constants'

interface PredictionData {
  homeScore: number | null
  awayScore: number | null
  penaltyWinner?: string | null
}

interface SavePredictionsBody {
  predictions?: Record<string, PredictionData>
  knockoutPredictions?: Record<string, PredictionData>
  thirdPlaceOverrides?: Record<string, number>
  topScorer?: string | null
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Check if predictions are locked
  if (isTournamentLocked()) {
    throw createError({
      statusCode: 403,
      message: 'Predictions are locked - tournament has started',
    })
  }

  const body = await readBody<SavePredictionsBody>(event)

  const now = new Date().toISOString()
  const upsertValues: Array<{
    userId: number
    matchId: string
    matchType: 'group' | 'knockout'
    homeScore: number | null
    awayScore: number | null
    penaltyWinner: string | null
    updatedAt: string
  }> = []

  // Process group predictions
  if (body.predictions) {
    for (const [matchId, pred] of Object.entries(body.predictions)) {
      upsertValues.push({
        userId: user.id,
        matchId,
        matchType: 'group',
        homeScore: pred.homeScore,
        awayScore: pred.awayScore,
        penaltyWinner: null,
        updatedAt: now,
      })
    }
  }

  // Process knockout predictions
  if (body.knockoutPredictions) {
    for (const [matchId, pred] of Object.entries(body.knockoutPredictions)) {
      upsertValues.push({
        userId: user.id,
        matchId,
        matchType: 'knockout',
        homeScore: pred.homeScore,
        awayScore: pred.awayScore,
        penaltyWinner: pred.penaltyWinner || null,
        updatedAt: now,
      })
    }
  }

  // Upsert all predictions
  if (upsertValues.length > 0) {
    for (const value of upsertValues) {
      // Check if prediction exists
      const existing = await db
        .select()
        .from(predictions)
        .where(and(eq(predictions.userId, value.userId), eq(predictions.matchId, value.matchId)))
        .limit(1)

      if (existing.length > 0) {
        // Update
        await db
          .update(predictions)
          .set({
            homeScore: value.homeScore,
            awayScore: value.awayScore,
            penaltyWinner: value.penaltyWinner,
            updatedAt: value.updatedAt,
          })
          .where(and(eq(predictions.userId, value.userId), eq(predictions.matchId, value.matchId)))
      } else {
        // Insert
        await db.insert(predictions).values(value)
      }
    }
  }

  // Process third-place overrides
  if (body.thirdPlaceOverrides) {
    for (const [teamCode, rank] of Object.entries(body.thirdPlaceOverrides)) {
      // Check if override exists for this user+team
      const existing = await db
        .select()
        .from(thirdPlaceOverrides)
        .where(and(eq(thirdPlaceOverrides.userId, user.id), eq(thirdPlaceOverrides.teamCode, teamCode)))
        .limit(1)

      if (existing.length > 0) {
        // Update
        await db
          .update(thirdPlaceOverrides)
          .set({
            rank,
            updatedAt: now,
          })
          .where(and(eq(thirdPlaceOverrides.userId, user.id), eq(thirdPlaceOverrides.teamCode, teamCode)))
      } else {
        // Insert
        await db.insert(thirdPlaceOverrides).values({
          userId: user.id,
          teamCode,
          rank,
          updatedAt: now,
        })
      }
    }
  }

  // Process top scorer prediction
  if (body.topScorer !== undefined) {
    if (body.topScorer && body.topScorer.trim().length > 0) {
      const playerName = body.topScorer.trim()
      const existingTopScorer = await db
        .select()
        .from(topScorerPredictions)
        .where(eq(topScorerPredictions.userId, user.id))
        .limit(1)

      if (existingTopScorer.length > 0) {
        await db
          .update(topScorerPredictions)
          .set({ playerName, updatedAt: now })
          .where(eq(topScorerPredictions.userId, user.id))
      } else {
        await db.insert(topScorerPredictions).values({
          userId: user.id,
          playerName,
          updatedAt: now,
        })
      }
    } else {
      // Clear top scorer prediction if empty string or null
      await db
        .delete(topScorerPredictions)
        .where(eq(topScorerPredictions.userId, user.id))
    }
  }

  // Update prediction count in user_scores
  const predCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(predictions)
    .where(eq(predictions.userId, user.id))

  await db
    .update(userScores)
    .set({
      predictionCount: predCount[0]?.count || 0,
      calculatedAt: now,
    })
    .where(eq(userScores.userId, user.id))

  return { success: true, count: upsertValues.length }
})
