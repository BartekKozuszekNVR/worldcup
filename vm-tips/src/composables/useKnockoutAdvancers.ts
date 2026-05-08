import { computed } from 'vue'
import type { SimulatedTeam, TieGroup } from '../types'
import { GROUPS } from '../data/groupMatches'

export interface KnockoutAdvancersResult {
  groupAdvancers: Record<string, SimulatedTeam[]>
  thirdPlaceRanked: SimulatedTeam[]
  qualifyingThirds: SimulatedTeam[]
  tieGroups: TieGroup[]
}

export function useKnockoutAdvancers(
  groupStandings: () => Record<string, SimulatedTeam[]>,
  tiebreakerOverrides?: () => Record<string, number>
) {
  const result = computed<KnockoutAdvancersResult>(() => {
    const standings = groupStandings()
    const overrides = tiebreakerOverrides?.() ?? {}

    // Top 2 per group advance
    const groupAdvancers: Record<string, SimulatedTeam[]> = {}
    const thirdPlaceTeams: SimulatedTeam[] = []

    for (const group of GROUPS) {
      const s = standings[group]
      if (!s || s.length < 3) continue
      groupAdvancers[group] = s.slice(0, 2)
      thirdPlaceTeams.push(s[2])
    }

    // Rank third-place teams
    const ranked = [...thirdPlaceTeams].sort((a, b) => {
      // Natural stats first
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor

      // Stats equal — use manual overrides to break tie
      const oa = overrides[a.code]
      const ob = overrides[b.code]
      if (oa !== undefined && ob !== undefined) return oa - ob
      if (oa !== undefined) return -1
      if (ob !== undefined) return 1

      return a.code.localeCompare(b.code)
    })

    // Detect ties among positions 7-10 (the cutoff for 8 qualifying)
    const tieGroups: TieGroup[] = []
    let i = 0
    while (i < ranked.length) {
      let j = i + 1
      while (
        j < ranked.length &&
        ranked[j].points === ranked[i].points &&
        ranked[j].goalDiff === ranked[i].goalDiff &&
        ranked[j].goalsFor === ranked[i].goalsFor
      ) {
        j++
      }
      // If tie spans the cutoff (position 8)
      if (j - i > 1 && i < 8 && j > 8) {
        tieGroups.push({
          teams: ranked.slice(i, j),
          startRank: i + 1,
          endRank: j,
        })
      }
      i = j
    }

    const qualifyingThirds = ranked.slice(0, 8)

    return {
      groupAdvancers,
      thirdPlaceRanked: ranked,
      qualifyingThirds,
      tieGroups,
    }
  })

  return result
}
