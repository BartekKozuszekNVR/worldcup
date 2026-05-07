import { defineEventHandler, readBody, createError } from 'h3'
import { db } from '../../utils/db'
import { users } from '../../database/schema'
import { eq } from 'drizzle-orm'
import { createSession, setSessionCookie, deleteSession } from '../../utils/session'

interface SwitchUserBody {
  targetUserId?: number
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Only admins can switch users
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const body = await readBody<SwitchUserBody>(event)

  if (!body.targetUserId) {
    throw createError({
      statusCode: 400,
      message: 'Target user ID is required',
    })
  }

  // Get target user
  const result = await db
    .select()
    .from(users)
    .where(eq(users.id, body.targetUserId))
    .limit(1)

  if (result.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'Target user not found',
    })
  }

  const targetUser = result[0]

  // Delete current session
  const sessionId = event.context.sessionId
  if (sessionId) {
    await deleteSession(sessionId)
  }

  // Create new session for target user
  const newSessionId = await createSession(targetUser.id)
  setSessionCookie(event, newSessionId)

  // Return target user without password hash
  return {
    id: targetUser.id,
    username: targetUser.username,
    avatarUrl: targetUser.avatarUrl,
    role: targetUser.role,
    createdAt: targetUser.createdAt,
  }
})
