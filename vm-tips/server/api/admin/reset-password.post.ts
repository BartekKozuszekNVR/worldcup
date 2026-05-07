import { defineEventHandler, readBody, createError } from 'h3'
import { db } from '../../utils/db'
import { users } from '../../database/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

interface ResetPasswordBody {
  userId?: number
  newPassword?: string
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Only admins can reset passwords
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  const body = await readBody<ResetPasswordBody>(event)

  // Validate input
  if (!body.userId || !body.newPassword) {
    throw createError({
      statusCode: 400,
      message: 'User ID and new password are required',
    })
  }

  const { userId, newPassword } = body

  if (newPassword.length < 4) {
    throw createError({
      statusCode: 400,
      message: 'Password must be at least 4 characters',
    })
  }

  // Check if target user exists
  const targetUser = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (targetUser.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  // Hash new password
  const passwordHash = await bcrypt.hash(newPassword, 10)

  // Update user password
  await db
    .update(users)
    .set({ passwordHash })
    .where(eq(users.id, userId))

  return {
    success: true,
    message: 'Password reset successfully',
  }
})
