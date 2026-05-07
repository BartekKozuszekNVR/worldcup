import { defineEventHandler, readBody, createError, getRouterParam } from 'h3'
import { db } from '../../utils/db'
import { users } from '../../database/schema'
import { eq } from 'drizzle-orm'

interface UpdateUserBody {
  avatarUrl?: string
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  const id = getRouterParam(event, 'id')
  const userId = parseInt(id || '', 10)

  if (isNaN(userId)) {
    throw createError({
      statusCode: 400,
      message: 'Invalid user ID',
    })
  }

  // Only allow updating own profile (or admin can update anyone)
  if (user.id !== userId && user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Not authorized to update this user',
    })
  }

  const body = await readBody<UpdateUserBody>(event)

  // Update user
  const result = await db
    .update(users)
    .set({
      avatarUrl: body.avatarUrl,
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      username: users.username,
      avatarUrl: users.avatarUrl,
      role: users.role,
      createdAt: users.createdAt,
    })

  if (result.length === 0) {
    throw createError({
      statusCode: 404,
      message: 'User not found',
    })
  }

  return result[0]
})
