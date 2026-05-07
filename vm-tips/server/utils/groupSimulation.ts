// Server-side group simulation for calculating standings from predictions
// Ported from src/composables/useGroupSimulation.ts

import { groupMatches, teamsByGroup, GROUPS } from '../data/groupMatches'

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

export interface GroupMatchPrediction {
  homeScore: number | null
  awayScore: number | null
}

function emptyStats(teamCode: string): SimulatedTeam {
  return {
    code: teamCode,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    goalDiff: 0,
    points: 0,
    position: 0
  }
}

function applyMatch(team: SimulatedTeam, goalsFor: number, goalsAgainst: number): void {
  team.played += 1
  team.goalsFor += goalsFor
  team.goalsAgainst += goalsAgainst
  team.goalDiff = team.goalsFor - team.goalsAgainst

  if (goalsFor > goalsAgainst) {
    team.won += 1
    team.points += 3
  } else if (goalsFor === goalsAgainst) {
    team.drawn += 1
    team.points += 1
  } else {
    team.lost += 1
  }
}

function sortStandings(standings: SimulatedTeam[]): SimulatedTeam[] {
  return [...standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
    // Alphabetical by team code as tiebreaker
    return a.code.localeCompare(b.code)
  })
}

/**
 * Calculate group standings from predictions for a single group
 */
export function calculateGroupStandings(
  group: string,
  predictions: Record<string, GroupMatchPrediction>
): SimulatedTeam[] {
  const teams = teamsByGroup[group]
  const matches = groupMatches[group]

  if (!teams || !matches) {
    return []
  }

  // Initialize table for each team
  const table: Record<string, SimulatedTeam> = {}
  for (const teamCode of teams) {
    table[teamCode] = emptyStats(teamCode)
  }

  // Apply each match prediction
  for (const match of matches) {
    const prediction = predictions[match.id]
    if (!prediction || prediction.homeScore === null || prediction.awayScore === null) {
      continue
    }

    const home = table[match.home]
    const away = table[match.away]
    if (!home || !away) continue

    applyMatch(home, prediction.homeScore, prediction.awayScore)
    applyMatch(away, prediction.awayScore, prediction.homeScore)
  }

  // Sort and assign positions
  const sorted = sortStandings(Object.values(table))
  return sorted.map((team, index) => ({ ...team, position: index + 1 }))
}

/**
 * Calculate standings for all groups from predictions
 */
export function calculateAllGroupStandings(
  predictions: Record<string, GroupMatchPrediction>
): Record<string, SimulatedTeam[]> {
  const result: Record<string, SimulatedTeam[]> = {}

  for (const group of GROUPS) {
    result[group] = calculateGroupStandings(group, predictions)
  }

  return result
}

/**
 * Extract group winners and runners-up from standings
 */
export function extractGroupPlacements(standings: Record<string, SimulatedTeam[]>): {
  winners: Record<string, string | null>
  runners: Record<string, string | null>
} {
  const winners: Record<string, string | null> = {}
  const runners: Record<string, string | null> = {}

  for (const [group, table] of Object.entries(standings)) {
    winners[group] = table[0]?.code || null
    runners[group] = table[1]?.code || null
  }

  return { winners, runners }
}

/**
 * Get all teams that advance from group stage (top 2 from each group)
 */
export function getAdvancingTeamsFromGroups(standings: Record<string, SimulatedTeam[]>): string[] {
  const advancing: string[] = []

  for (const group of GROUPS) {
    const table = standings[group]
    if (table && table.length >= 2) {
      if (table[0]?.code) advancing.push(table[0].code)
      if (table[1]?.code) advancing.push(table[1].code)
    }
  }

  return advancing
}

export { GROUPS }
