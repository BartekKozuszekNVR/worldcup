export type MatchStage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'third' | 'final'

export interface Team {
  code: string
  name: string
  nameEn: string
  group: string
  qualified: boolean
}

export interface SimulatedTeam {
  code: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
  position: number
}

export interface AuthUser {
  id: number
  username: string
  avatarUrl?: string | null
  role: 'user' | 'admin'
  createdAt: string
}

export interface Prediction {
  matchId: string
  homeScore: number | null
  awayScore: number | null
}

export interface KnockoutPrediction {
  matchId: string
  homeTeam: string
  awayTeam: string
  homeScore: number | null
  awayScore: number | null
  penaltyWinner?: string | null
}

export interface MatchResult {
  matchId: string
  homeTeam?: string | null
  awayTeam?: string | null
  homeScore: number
  awayScore: number
  stage: MatchStage
}

export interface LeaderboardEntry {
  userId: number
  username: string
  avatarUrl?: string | null
  totalPoints: number
  matchPoints: number
  bonusPoints: number
  exactScores: number
  correctResults: number
  halfScoreCorrect: number
  correctOutcomes: number
  predictionCount: number
}

export interface TieGroup {
  teams: SimulatedTeam[]
  startRank: number
  endRank: number
}
