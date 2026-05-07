import { defineEventHandler, readBody, createError } from 'h3'
import { db } from '../../utils/db'
import { users, userScores } from '../../database/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { createSession, setSessionCookie } from '../../utils/session'

interface RegisterBody {
  username?: string
  password?: string
}

export default defineEventHandler(async (event) => {
  const body = await readBody<RegisterBody>(event)

  // Validate input
  if (!body.username || !body.password) {
    throw createError({
      statusCode: 400,
      message: 'Username and password are required',
    })
  }

  const username = body.username.trim()
  const password = body.password

  if (username.length < 2) {
    throw createError({
      statusCode: 400,
      message: 'Username must be at least 2 characters',
    })
  }

  if (password.length < 4) {
    throw createError({
      statusCode: 400,
      message: 'Password must be at least 4 characters',
    })
  }

  // Check if username already exists (case-insensitive)
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1)

  if (existing.length > 0) {
    throw createError({
      statusCode: 409,
      message: 'Username already taken',
    })
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10)

  // Create user
  const result = await db
    .insert(users)
    .values({
      username,
      passwordHash,
      role: 'user',
    })
    .returning()

  const newUser = result[0]

  // Initialize user score record
  await db.insert(userScores).values({
    userId: newUser.id,
    matchPoints: 0,
    bonusPoints: 0,
    totalPoints: 0,
    exactScores: 0,
    correctDiffs: 0,
    correctOutcomes: 0,
    predictionCount: 0,
  })

  // Create session
  const sessionId = await createSession(newUser.id)
  setSessionCookie(event, sessionId)

  // Return user without password hash
  return {
    id: newUser.id,
    username: newUser.username,
    avatarUrl: newUser.avatarUrl,
    role: newUser.role,
    createdAt: newUser.createdAt,
  }
})
