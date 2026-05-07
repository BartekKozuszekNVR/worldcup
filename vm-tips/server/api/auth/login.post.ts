import { defineEventHandler, readBody, createError } from 'h3'
import { db } from '../../utils/db'
import { users } from '../../database/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { createSession, setSessionCookie } from '../../utils/session'

interface LoginBody {
  username?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<LoginBody>(event)

  // Validate input
  if (!body.username || !body.password) {
    throw createError({
      statusCode: 400,
      message: 'Username and password are required',
    })
  }

  const username = body.username.trim()
  const password = body.password

  // Find user by username (case-insensitive matching in application)
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1)

  if (result.length === 0) {
    throw createError({
      statusCode: 401,
      message: 'Invalid username or password',
    })
  }

  const user = result[0]

  // Verify password
  const passwordValid = await bcrypt.compare(password, user.passwordHash)

  if (!passwordValid) {
    throw createError({
      statusCode: 401,
      message: 'Invalid username or password',
    })
  }

  // Create session
  const sessionId = await createSession(user.id)
  setSessionCookie(event, sessionId)

  // Return user without password hash
  return {
    id: user.id,
    username: user.username,
    avatarUrl: user.avatarUrl,
    role: user.role,
    createdAt: user.createdAt,
  }
})
