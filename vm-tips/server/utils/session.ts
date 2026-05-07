import { nanoid } from 'nanoid'
import { db } from './db'
import { sessions, users } from '../database/schema'
import { eq, and, gt, lt, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { getCookie, setCookie, deleteCookie, getHeader } from 'h3'

const SESSION_COOKIE_NAME = 'vm_session'
const SESSION_DURATION_DAYS = 7

/**
 * Create a new session for a user
 */
export async function createSession(userId: number): Promise<string> {
  const sessionId = nanoid(32)
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS)

  await db.insert(sessions).values({
    id: sessionId,
    userId,
    expiresAt: expiresAt.toISOString(),
  })

  return sessionId
}

/**
 * Validate a session and return the associated user
 */
export async function validateSession(sessionId: string) {
  const now = new Date().toISOString()

  const result = await db
    .select({
      session: sessions,
      user: users,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1)

  if (result.length === 0) {
    return null
  }

  return {
    session: result[0].session,
    user: result[0].user,
  }
}

/**
 * Delete a session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, sessionId))
}

/**
 * Delete all expired sessions (cleanup)
 */
export async function deleteExpiredSessions(): Promise<void> {
  const now = new Date().toISOString()
  await db.delete(sessions).where(lt(sessions.expiresAt, now))
}

/**
 * Get session ID from request cookie or Authorization header
 */
export function getSessionId(event: H3Event): string | null {
  // First check cookie
  const cookieSession = getCookie(event, SESSION_COOKIE_NAME)
  if (cookieSession) {
    return cookieSession
  }

  // Then check Authorization header
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return null
}

/**
 * Set session cookie on response
 */
export function setSessionCookie(event: H3Event, sessionId: string): void {
  setCookie(event, SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60, // seconds
    path: '/',
  })
}

/**
 * Clear session cookie
 */
export function clearSessionCookie(event: H3Event): void {
  deleteCookie(event, SESSION_COOKIE_NAME, {
    path: '/',
  })
}
