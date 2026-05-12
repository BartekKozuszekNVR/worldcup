import { computed } from 'vue'
import type { SimulatedTeam, KnockoutPrediction } from '../types'
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
  thirdPlaceOverrides?: () => Record<string, number>,
  knockoutPredictions?: () => Record<string, KnockoutPrediction>
) {
  const bracket = computed<BracketMatch[]>(() => {
    const standings = groupStandings()
    const predictions = knockoutPredictions?.() ?? {}
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

    // Sort third-place teams to find best 8, applying manual rank overrides
    const overrides = thirdPlaceOverrides?.() ?? {}
    const qualifyingGroups = thirdPlaceTeams
      .sort((a, b) => {
        // Natural stats first
        if (b.team.points !== a.team.points) return b.team.points - a.team.points
        if (b.team.goalDiff !== a.team.goalDiff) return b.team.goalDiff - a.team.goalDiff
        if (b.team.goalsFor !== a.team.goalsFor) return b.team.goalsFor - a.team.goalsFor

        // Stats equal — use manual overrides to break tie
        const oa = overrides[a.team.code]
        const ob = overrides[b.team.code]
        if (oa !== undefined && ob !== undefined) return oa - ob
        if (oa !== undefined) return -1
        if (ob !== undefined) return 1

        return a.team.code.localeCompare(b.team.code)
      })
      .slice(0, 8)
      .map(t => t.group)

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
    } else if (qualifyingGroups.length === 8) {
      // Fallback: assign qualifying thirds to slots in sorted order
      // avoiding own-group conflicts where possible
      const assignmentKeys = ['A', 'B', 'D', 'E', 'G', 'I', 'K', 'L'] as const
      const available = [...qualifyingGroups].sort()
      const used = new Set<string>()

      for (const key of assignmentKeys) {
        // Prefer a group that doesn't match the slot letter
        const pick = available.find(g => !used.has(g) && g !== key)
          ?? available.find(g => !used.has(g))
        if (pick) {
          const thirdTeam = thirdPlaceTeams.find(t => t.group === pick)
          resolved[`3rd_${key}`] = thirdTeam?.team.code ?? null
          used.add(pick)
        }
      }
    }

    // Resolve R32
    const r32Matches: BracketMatch[] = roundOf32Rules.map(rule => ({
      id: rule.id,
      homeTeam: resolved[rule.home] ?? null,
      awayTeam: resolved[rule.away] ?? null,
    }))

    // Write R32 teams into resolved map and determine winners from predictions
    for (const match of r32Matches) {
      resolveMatchWinner(match, predictions, resolved)
    }

    const allMatches: BracketMatch[] = [...r32Matches]

    // R16
    for (const rule of roundOf16Rules) {
      const match: BracketMatch = {
        id: rule.id,
        homeTeam: resolved[rule.home] ?? null,
        awayTeam: resolved[rule.away] ?? null,
      }
      resolveMatchWinner(match, predictions, resolved)
      allMatches.push(match)
    }

    // QF
    for (const rule of quarterFinalRules) {
      const match: BracketMatch = {
        id: rule.id,
        homeTeam: resolved[rule.home] ?? null,
        awayTeam: resolved[rule.away] ?? null,
      }
      resolveMatchWinner(match, predictions, resolved)
      allMatches.push(match)
    }

    // SF
    for (const rule of semiFinalRules) {
      const match: BracketMatch = {
        id: rule.id,
        homeTeam: resolved[rule.home] ?? null,
        awayTeam: resolved[rule.away] ?? null,
      }
      resolveMatchWinner(match, predictions, resolved)
      allMatches.push(match)
    }

    // Third place
    allMatches.push({
      id: thirdPlaceRule.id,
      homeTeam: resolved[thirdPlaceRule.home] ?? null,
      awayTeam: resolved[thirdPlaceRule.away] ?? null,
    })

    // Final
    allMatches.push({
      id: finalRule.id,
      homeTeam: resolved[finalRule.home] ?? null,
      awayTeam: resolved[finalRule.away] ?? null,
    })

    return allMatches
  })

  return { bracket }
}

/**
 * Given a resolved bracket match and the user's knockout predictions,
 * determine the winner and loser, then write them into the resolved map
 * as W-{matchId} and L-{matchId}.
 */
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
    // Draw — need penalty winner
    if (!pred.penaltyWinner) return
    winner = pred.penaltyWinner
    loser = pred.penaltyWinner === homeTeam ? awayTeam : homeTeam
  }

  resolved[`W-${id}`] = winner
  resolved[`L-${id}`] = loser
}
