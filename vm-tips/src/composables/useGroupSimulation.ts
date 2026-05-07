import { computed } from 'vue'
import type { SimulatedTeam } from '../types'
import { groupMatches, teamsByGroup } from '../data/groupMatches'

export function useGroupSimulation(
  predictions: () => Record<string, { homeScore: number | null; awayScore: number | null }>,
  group: string
) {
  const standings = computed<SimulatedTeam[]>(() => {
    const preds = predictions()
    const teams = teamsByGroup[group] ?? []
    const matches = groupMatches[group] ?? []

    const stats: Record<string, SimulatedTeam> = {}
    for (const code of teams) {
      stats[code] = {
        code,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDiff: 0,
        points: 0,
        position: 0,
      }
    }

    for (const match of matches) {
      const pred = preds[match.id]
      if (!pred || pred.homeScore === null || pred.awayScore === null) continue

      const home = stats[match.home]
      const away = stats[match.away]
      if (!home || !away) continue

      const hs = pred.homeScore
      const as = pred.awayScore

      home.played++
      away.played++
      home.goalsFor += hs
      home.goalsAgainst += as
      away.goalsFor += as
      away.goalsAgainst += hs

      if (hs > as) {
        home.won++
        home.points += 3
        away.lost++
      } else if (hs < as) {
        away.won++
        away.points += 3
        home.lost++
      } else {
        home.drawn++
        away.drawn++
        home.points += 1
        away.points += 1
      }
    }

    // Update goal diff
    for (const t of Object.values(stats)) {
      t.goalDiff = t.goalsFor - t.goalsAgainst
    }

    // Sort
    const sorted = Object.values(stats).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
      return b.goalsFor - a.goalsFor
    })

    sorted.forEach((t, i) => {
      t.position = i + 1
    })

    return sorted
  })

  return { standings }
}
