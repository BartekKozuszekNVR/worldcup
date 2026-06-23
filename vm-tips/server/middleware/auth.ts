import { defineEventHandler, createError } from 'h3'
import { getSessionId, validateSession } from '../utils/session'
import type { User } from '../database/schema'

// Extend H3 event context to include user
declare module 'h3' {
  interface H3EventContext {
    user?: Omit<User, 'passwordHash'>
    sessionId?: string
  }
}

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/leaderboard', // Leaderboard is public for viewing
  '/api/users', // User list is public for leaderboard display
]

export default defineEventHandler(async (event) => {
  const path = event.path

  // Skip non-API routes
  if (!path.startsWith('/api/')) {
    return
  }

  // Check if route is public
  const isPublic = PUBLIC_ROUTES.some((route) => path.startsWith(route))

  // Skip session validation entirely for public routes — no DB round-trip needed
  if (isPublic) {
    return
  }

  // Get session ID from cookie or header
  const sessionId = getSessionId(event)

  if (sessionId) {
    // Validate session
    const result = await validateSession(sessionId)

    if (result) {
      // Attach user to event context (without password hash)
      const { passwordHash, ...safeUser } = result.user
      event.context.user = safeUser
      event.context.sessionId = sessionId
    }
  }

  // If route requires auth and no valid session, return 401
  if (!event.context.user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
      message: 'Authentication required',
    })
  }
})
