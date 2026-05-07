import { defineEventHandler, createError } from 'h3'
import { db } from '../../utils/db'
import { users } from '../../database/schema'
import { TOURNAMENT_START, isTournamentLocked } from '../../../shared/constants'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Non-admins can only access after tournament starts
  if (user.role !== 'admin' && !isTournamentLocked()) {
    throw createError({
      statusCode: 403,
      message: `This feature is available after tournament starts (${TOURNAMENT_START})`,
    })
  }

  // Return minimal user info (id + username only)
  const result = await db
    .select({
      id: users.id,
      username: users.username,
    })
    .from(users)

  return result
})
