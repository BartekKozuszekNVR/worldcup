import { defineEventHandler, createError } from 'h3'
import { db } from '../../../utils/db'
import { users } from '../../../database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Only admins can delete users
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const userId = Number(event.context.params?.userId)
  if (!userId || isNaN(userId)) {
    throw createError({
      statusCode: 400,
      message: 'Valid user ID required',
    })
  }

  // Fetch the target user to check if they exist and their role
  const targetUser = await db
    .select({ id: users.id, role: users.role, username: users.username })
    .from(users)
    .where(eq(users.id, userId))
    .get()

  if (!targetUser) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  // Prevent deleting admin users
  if (targetUser.role === 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Cannot delete admin users',
    })
  }

  // Delete the user (cascade will auto-delete sessions, predictions, userScores, thirdPlaceOverrides)
  await db.delete(users).where(eq(users.id, userId))

  return {
    success: true,
    message: `User '${targetUser.username}' deleted successfully`,
  }
})
