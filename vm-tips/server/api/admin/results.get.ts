import { defineEventHandler, createError } from 'h3'
import { db } from '../../utils/db'
import { matchResults, tournamentProgress } from '../../database/schema'

type MatchStage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'

function getStageFromMatchId(matchId: string): MatchStage {
  if (matchId.startsWith('R32')) return 'r32'
  if (matchId.startsWith('R16')) return 'r16'
  if (matchId.startsWith('QF')) return 'qf'
  if (matchId.startsWith('SF')) return 'sf'
  if (matchId === 'THIRD') return 'third'
  if (matchId === 'FINAL') return 'final'
  return 'group'
}

export default defineEventHandler(async (event) => {
  const user = event.context.user

  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Not authenticated',
    })
  }

  // Only admins can view all match results
  if (user.role !== 'admin') {
    throw createError({
      statusCode: 403,
      message: 'Admin access required',
    })
  }

  // Get all match results (including incomplete ones for admin)
  const results = await db.select().from(matchResults)

  // Return as array with stage info (matching MatchResult interface)
  const formattedResults = results.map((r) => ({
    matchId: r.matchId,
    homeTeam: r.homeTeam,
    awayTeam: r.awayTeam,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    stage: getStageFromMatchId(r.matchId),
    penaltyWinner: r.penaltyWinner,
  }))

  // Get tournament progress for bonus data
  const progress = await db.select().from(tournamentProgress)
  const bonusData: Record<string, string> = {}
  for (const entry of progress) {
    bonusData[entry.key] = entry.teamCode
  }

  return {
    results: formattedResults,
    bonusData,
  }
})
