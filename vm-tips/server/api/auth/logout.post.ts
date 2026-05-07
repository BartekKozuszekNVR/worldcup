import { defineEventHandler } from 'h3'
import { deleteSession, clearSessionCookie } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const sessionId = event.context.sessionId

  if (sessionId) {
    await deleteSession(sessionId)
  }

  clearSessionCookie(event)

  return { success: true }
})
