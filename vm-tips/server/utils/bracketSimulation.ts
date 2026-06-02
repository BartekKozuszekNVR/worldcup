import { GROUPS } from '../data/groupMatches'
import { thirdPlaceCombinations } from '../../shared/thirdPlaceCombinations'
import {
  roundOf32Rules,
  roundOf16Rules,
  quarterFinalRules,
  semiFinalRules,
  thirdPlaceRule,
  finalRule,
} from '../../shared/bracketRules'
import type { SimulatedTeam } from './groupSimulation'

export interface KnockoutPrediction {
  homeScore: number | null
  awayScore: number | null
  penaltyWinner: string | null
}

export interface BracketMatch {
  id: string
  homeTeam: string | null
  awayTeam: string | null
}

export function simulateUserBracket(
  standings: Record<string, SimulatedTeam[]>,
  knockoutPredictions: Record<string, KnockoutPrediction>,
  thirdPlaceOverrides: Record<string, number> = {}
): Record<string, BracketMatch> {
  const resolved: Record<string, string | null> = {}
  const matches: Record<string, BracketMatch> = {}

  for (const group of GROUPS) {
    const s = standings[group]
    if (s && s.length >= 2) {
      resolved[`1${group}`] = s[0]?.code ?? null
      resolved[`2${group}`] = s[1]?.code ?? null
    }
  }

  const thirdPlaceTeams: { group: string; team: SimulatedTeam }[] = []
  for (const group of GROUPS) {
    const s = standings[group]
    if (s && s.length >= 3) {
      thirdPlaceTeams.push({ group, team: s[2] })
    }
  }

  const qualifyingGroups = thirdPlaceTeams
    .sort((a, b) => {
      if (b.team.points !== a.team.points) return b.team.points - a.team.points
      if (b.team.goalDiff !== a.team.goalDiff) return b.team.goalDiff - a.team.goalDiff
      if (b.team.goalsFor !== a.team.goalsFor) return b.team.goalsFor - a.team.goalsFor

      const oa = thirdPlaceOverrides[a.team.code]
      const ob = thirdPlaceOverrides[b.team.code]
      if (oa !== undefined && ob !== undefined) return oa - ob
      if (oa !== undefined) return -1
      if (ob !== undefined) return 1

      return a.team.code.localeCompare(b.team.code)
    })
    .slice(0, 8)
    .map(t => t.group)

  const sortedGroups = [...qualifyingGroups].sort()

  const combo = thirdPlaceCombinations.find(c =>
    c.groups.length === sortedGroups.length &&
    c.groups.every((g, i) => g === sortedGroups[i])
  )

  if (combo) {
    const assignmentKeys = ['A', 'B', 'D', 'E', 'G', 'I', 'K', 'L'] as const
    for (const key of assignmentKeys) {
      const fromGroup = combo.assignments[key]
      const thirdTeam = thirdPlaceTeams.find(t => t.group === fromGroup)
      resolved[`3rd_${key}`] = thirdTeam?.team.code ?? null
    }
  } else if (qualifyingGroups.length === 8) {
    const assignmentKeys = ['A', 'B', 'D', 'E', 'G', 'I', 'K', 'L'] as const
    const available = [...qualifyingGroups].sort()
    const used = new Set<string>()

    for (const key of assignmentKeys) {
      const pick = available.find(g => !used.has(g) && g !== key)
        ?? available.find(g => !used.has(g))
      if (pick) {
        const thirdTeam = thirdPlaceTeams.find(t => t.group === pick)
        resolved[`3rd_${key}`] = thirdTeam?.team.code ?? null
        used.add(pick)
      }
    }
  }

  for (const rule of roundOf32Rules) {
    const match: BracketMatch = {
      id: rule.id,
      homeTeam: resolved[rule.home] ?? null,
      awayTeam: resolved[rule.away] ?? null,
    }
    resolveMatchWinner(match, knockoutPredictions, resolved)
    matches[rule.id] = match
  }

  for (const rule of roundOf16Rules) {
    const match: BracketMatch = {
      id: rule.id,
      homeTeam: resolved[rule.home] ?? null,
      awayTeam: resolved[rule.away] ?? null,
    }
    resolveMatchWinner(match, knockoutPredictions, resolved)
    matches[rule.id] = match
  }

  for (const rule of quarterFinalRules) {
    const match: BracketMatch = {
      id: rule.id,
      homeTeam: resolved[rule.home] ?? null,
      awayTeam: resolved[rule.away] ?? null,
    }
    resolveMatchWinner(match, knockoutPredictions, resolved)
    matches[rule.id] = match
  }

  for (const rule of semiFinalRules) {
    const match: BracketMatch = {
      id: rule.id,
      homeTeam: resolved[rule.home] ?? null,
      awayTeam: resolved[rule.away] ?? null,
    }
    resolveMatchWinner(match, knockoutPredictions, resolved)
    matches[rule.id] = match
  }

  matches[thirdPlaceRule.id] = {
    id: thirdPlaceRule.id,
    homeTeam: resolved[thirdPlaceRule.home] ?? null,
    awayTeam: resolved[thirdPlaceRule.away] ?? null,
  }

  matches[finalRule.id] = {
    id: finalRule.id,
    homeTeam: resolved[finalRule.home] ?? null,
    awayTeam: resolved[finalRule.away] ?? null,
  }

  return matches
}

function resolveMatchWinner(
  match: BracketMatch,
  predictions: Record<string, KnockoutPrediction>,
  resolved: Record<string, string | null>
): void {
  const { id, homeTeam, awayTeam } = match
  if (!homeTeam || !awayTeam) return

  const pred = predictions[id]
  if (!pred || pred.homeScore === null || pred.awayScore === null) return

  let winner: string
  let loser: string

  if (pred.homeScore > pred.awayScore) {
    winner = homeTeam
    loser = awayTeam
  } else if (pred.awayScore > pred.homeScore) {
    winner = awayTeam
    loser = homeTeam
  } else {
    if (!pred.penaltyWinner) return
    winner = pred.penaltyWinner
    loser = pred.penaltyWinner === homeTeam ? awayTeam : homeTeam
  }

  resolved[`W-${id}`] = winner
  resolved[`L-${id}`] = loser
}
