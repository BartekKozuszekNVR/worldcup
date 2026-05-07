import { computed } from 'vue'
import type { SimulatedTeam } from '../types'
import {
  roundOf32Rules,
  roundOf16Rules,
  quarterFinalRules,
  semiFinalRules,
  thirdPlaceRule,
  finalRule,
} from '../data/bracketRules'
import { thirdPlaceCombinations } from '../data/thirdPlaceCombinations'
import { GROUPS } from '../data/groupMatches'

export interface BracketMatch {
  id: string
  homeTeam: string | null
  awayTeam: string | null
}

export function useBracketSimulation(
  groupStandings: () => Record<string, SimulatedTeam[]>,
  thirdPlaceOverrides?: () => Record<string, string[]>
) {
  const bracket = computed<BracketMatch[]>(() => {
    const standings = groupStandings()
    const resolved: Record<string, string | null> = {}

    // Resolve group positions: 1A, 2A, etc.
    for (const group of GROUPS) {
      const s = standings[group]
      if (s && s.length >= 2) {
        resolved[`1${group}`] = s[0]?.code ?? null
        resolved[`2${group}`] = s[1]?.code ?? null
      }
    }

    // Determine which 8 third-place teams qualify
    const thirdPlaceTeams: { group: string; team: SimulatedTeam }[] = []
    for (const group of GROUPS) {
      const s = standings[group]
      if (s && s.length >= 3) {
        thirdPlaceTeams.push({ group, team: s[2] })
      }
    }

    // Sort third-place teams to find best 8
    const overrides = thirdPlaceOverrides?.() ?? {}
    let qualifyingGroups: string[]

    if (Object.keys(overrides).length > 0) {
      // Use overrides to determine which groups qualify
      qualifyingGroups = Object.keys(overrides).length >= 8
        ? Object.keys(overrides).slice(0, 8)
        : thirdPlaceTeams
            .sort((a, b) => {
              if (b.team.points !== a.team.points) return b.team.points - a.team.points
              if (b.team.goalDiff !== a.team.goalDiff) return b.team.goalDiff - a.team.goalDiff
              return b.team.goalsFor - a.team.goalsFor
            })
            .slice(0, 8)
            .map(t => t.group)
    } else {
      qualifyingGroups = thirdPlaceTeams
        .sort((a, b) => {
          if (b.team.points !== a.team.points) return b.team.points - a.team.points
          if (b.team.goalDiff !== a.team.goalDiff) return b.team.goalDiff - a.team.goalDiff
          return b.team.goalsFor - a.team.goalsFor
        })
        .slice(0, 8)
        .map(t => t.group)
    }

    const sortedGroups = [...qualifyingGroups].sort()

    // Find the matching combination
    const combo = thirdPlaceCombinations.find(c =>
      c.groups.length === sortedGroups.length &&
      c.groups.every((g, i) => g === sortedGroups[i])
    )

    // Assign 3rd place teams using combination
    if (combo) {
      const assignmentKeys = ['A', 'B', 'D', 'E', 'G', 'I', 'K', 'L'] as const
      for (const key of assignmentKeys) {
        const fromGroup = combo.assignments[key]
        const thirdTeam = thirdPlaceTeams.find(t => t.group === fromGroup)
        resolved[`3rd_${key}`] = thirdTeam?.team.code ?? null
      }
    }

    // Resolve R32
    const r32Matches: BracketMatch[] = roundOf32Rules.map(rule => ({
      id: rule.id,
      homeTeam: resolved[rule.home] ?? null,
      awayTeam: resolved[rule.away] ?? null,
    }))

    // For knockout resolution we need predictions - return structure only
    const allMatches: BracketMatch[] = [...r32Matches]

    // R16
    for (const rule of roundOf16Rules) {
      allMatches.push({
        id: rule.id,
        homeTeam: resolveWinner(rule.home, resolved),
        awayTeam: resolveWinner(rule.away, resolved),
      })
    }

    // QF
    for (const rule of quarterFinalRules) {
      allMatches.push({
        id: rule.id,
        homeTeam: resolveWinner(rule.home, resolved),
        awayTeam: resolveWinner(rule.away, resolved),
      })
    }

    // SF
    for (const rule of semiFinalRules) {
      allMatches.push({
        id: rule.id,
        homeTeam: resolveWinner(rule.home, resolved),
        awayTeam: resolveWinner(rule.away, resolved),
      })
    }

    // Third place
    allMatches.push({
      id: thirdPlaceRule.id,
      homeTeam: resolveLoser(thirdPlaceRule.home, resolved),
      awayTeam: resolveLoser(thirdPlaceRule.away, resolved),
    })

    // Final
    allMatches.push({
      id: finalRule.id,
      homeTeam: resolveWinner(finalRule.home, resolved),
      awayTeam: resolveWinner(finalRule.away, resolved),
    })

    return allMatches
  })

  return { bracket }
}

function resolveWinner(ref: string, resolved: Record<string, string | null>): string | null {
  // ref like "W-R32-1" or "L-SF-1"
  if (ref.startsWith('W-') || ref.startsWith('L-')) {
    return null // Cannot resolve winners without match results in simulation
  }
  return resolved[ref] ?? null
}

function resolveLoser(ref: string, resolved: Record<string, string | null>): string | null {
  if (ref.startsWith('L-') || ref.startsWith('W-')) {
    return null
  }
  return resolved[ref] ?? null
}
