import { sqliteTable, text, integer, real, unique } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

// ─────────────────────────────────────────────────────────────────
// USERS TABLE
// ─────────────────────────────────────────────────────────────────
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  avatarUrl: text('avatar_url'),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ─────────────────────────────────────────────────────────────────
// SESSIONS TABLE (for auth tokens)
// ─────────────────────────────────────────────────────────────────
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // nanoid token
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
})

// ─────────────────────────────────────────────────────────────────
// PREDICTIONS TABLE (one row per user+match)
// ─────────────────────────────────────────────────────────────────
export const predictions = sqliteTable(
  'predictions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    matchId: text('match_id').notNull(), // e.g., "A1", "R32-5", "FINAL"
    matchType: text('match_type', { enum: ['group', 'knockout'] }).notNull(),
    homeScore: integer('home_score'),
    awayScore: integer('away_score'),
    penaltyWinner: text('penalty_winner'), // Team code if knockout draw
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [unique().on(table.userId, table.matchId)]
)

// ─────────────────────────────────────────────────────────────────
// CACHED SCORES TABLE (for leaderboard performance)
// ─────────────────────────────────────────────────────────────────
export const userScores = sqliteTable('user_scores', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' })
    .unique(),
  matchPoints: real('match_points').notNull().default(0),
  bonusPoints: real('bonus_points').notNull().default(0),
  totalPoints: real('total_points').notNull().default(0),
  exactScores: integer('exact_scores').notNull().default(0),
  correctResults: integer('correct_results').notNull().default(0),
  halfScoreCorrect: integer('half_score_correct').notNull().default(0),
  correctOutcomes: integer('correct_outcomes').notNull().default(0),
  predictionCount: integer('prediction_count').notNull().default(0),
  calculatedAt: text('calculated_at').notNull().default(sql`(datetime('now'))`),
})

// ─────────────────────────────────────────────────────────────────
// MATCH RESULTS TABLE (actual scores entered by admin)
// ─────────────────────────────────────────────────────────────────
export const matchResults = sqliteTable('match_results', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  matchId: text('match_id').notNull().unique(), // e.g., "A1", "R32-5", "FINAL"
  homeTeam: text('home_team'), // Team code, e.g., "BR", "AR"
  awayTeam: text('away_team'), // Team code, e.g., "DE", "FR"
  homeScore: integer('home_score'),
  awayScore: integer('away_score'),
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ─────────────────────────────────────────────────────────────────
// TOURNAMENT PROGRESS TABLE (for bonus points tracking)
// ─────────────────────────────────────────────────────────────────
export const tournamentProgress = sqliteTable('tournament_progress', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(), // e.g., "groupA_winner", "semifinalist_1", "champion"
  teamCode: text('team_code').notNull(), // e.g., "SWE", "BRA"
  updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
})

// ─────────────────────────────────────────────────────────────────
// THIRD PLACE OVERRIDES TABLE (for user tiebreaker resolution)
// ─────────────────────────────────────────────────────────────────
export const thirdPlaceOverrides = sqliteTable(
  'third_place_overrides',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    teamCode: text('team_code').notNull(),
    rank: integer('rank').notNull(),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [unique().on(table.userId, table.teamCode)]
)

// ─────────────────────────────────────────────────────────────────
// TYPE EXPORTS
// ─────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type Prediction = typeof predictions.$inferSelect
export type NewPrediction = typeof predictions.$inferInsert
export type UserScore = typeof userScores.$inferSelect
export type NewUserScore = typeof userScores.$inferInsert
export type MatchResult = typeof matchResults.$inferSelect
export type NewMatchResult = typeof matchResults.$inferInsert
export type TournamentProgress = typeof tournamentProgress.$inferSelect
export type NewTournamentProgress = typeof tournamentProgress.$inferInsert
export type ThirdPlaceOverride = typeof thirdPlaceOverrides.$inferSelect
export type NewThirdPlaceOverride = typeof thirdPlaceOverrides.$inferInsert
