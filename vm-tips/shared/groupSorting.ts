/**
 * FIFA-compliant group standings sort with head-to-head tiebreaker.
 *
 * Official FIFA tiebreaker order (within a group):
 *   1. Points (3 win / 1 draw / 0 loss)
 *   2. Goal difference
 *   3. Goals scored
 *   4. Head-to-head: points in matches among tied teams
 *   5. Head-to-head: goal difference in matches among tied teams
 *   6. Head-to-head: goals scored in matches among tied teams
 *   7. Fair play (cards) — N/A for a prediction app
 *   8. Drawing of lots — alphabetical fallback in our implementation
 */

// ─────────────────────────────────────────────────────────────────
// Minimal interfaces so this module has zero framework dependencies
// ─────────────────────────────────────────────────────────────────

export interface TeamStats {
  code: string
  points: number
  goalDiff: number
  goalsFor: number
  goalsAgainst: number
}

export interface MatchDef {
  id: string
  home: string
  away: string
}

export interface MatchScore {
  homeScore: number | null
  awayScore: number | null
}

// ─────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────

/** Basic 3-criteria compare: points → GD → GS (descending) */
function compareBasic(a: TeamStats, b: TeamStats): number {
  if (b.points !== a.points) return b.points - a.points
  if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
  if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
  return 0
}

/**
 * Build a mini-table for a subset of teams using only their mutual matches.
 * Returns a new TeamStats[] with points/GD/GF computed from h2h matches only.
 */
function buildMiniTable(
  teamCodes: Set<string>,
  matches: MatchDef[],
  predictions: Record<string, MatchScore>
): TeamStats[] {
  const stats: Record<string, { points: number; goalsFor: number; goalsAgainst: number }> = {}
  for (const code of teamCodes) {
    stats[code] = { points: 0, goalsFor: 0, goalsAgainst: 0 }
  }

  for (const match of matches) {
    if (!teamCodes.has(match.home) || !teamCodes.has(match.away)) continue
    const pred = predictions[match.id]
    if (!pred || pred.homeScore === null || pred.awayScore === null) continue

    const hs = pred.homeScore
    const as = pred.awayScore

    stats[match.home].goalsFor += hs
    stats[match.home].goalsAgainst += as
    stats[match.away].goalsFor += as
    stats[match.away].goalsAgainst += hs

    if (hs > as) {
      stats[match.home].points += 3
    } else if (hs < as) {
      stats[match.away].points += 3
    } else {
      stats[match.home].points += 1
      stats[match.away].points += 1
    }
  }

  return Array.from(teamCodes).map((code) => ({
    code,
    points: stats[code].points,
    goalsFor: stats[code].goalsFor,
    goalsAgainst: stats[code].goalsAgainst,
    goalDiff: stats[code].goalsFor - stats[code].goalsAgainst,
  }))
}

/**
 * Resolve a group of tied teams using head-to-head criteria.
 *
 * For N tied teams (N >= 2), build a mini-table from mutual matches
 * and sort by points → GD → GS. If sub-groups remain tied after h2h,
 * recurse once (FIFA allows recursive h2h reduction). Final fallback
 * is alphabetical by team code.
 *
 * @param tiedCodes  - team codes that are tied on overall pts/GD/GS
 * @param matches    - all group matches (we filter to mutual ones)
 * @param predictions - score predictions keyed by match ID
 * @param depth      - recursion depth (max 1 to prevent infinite loops)
 * @returns ordered array of team codes, best first
 */
function resolveHeadToHead(
  tiedCodes: string[],
  matches: MatchDef[],
  predictions: Record<string, MatchScore>,
  depth: number = 0
): string[] {
  if (tiedCodes.length <= 1) return tiedCodes

  const codeSet = new Set(tiedCodes)
  const miniTable = buildMiniTable(codeSet, matches, predictions)

  // Sort mini-table by h2h points → GD → GS
  miniTable.sort((a, b) => {
    const cmp = compareBasic(a, b)
    if (cmp !== 0) return cmp
    return a.code.localeCompare(b.code)
  })

  // Check if h2h actually separated teams
  // Group the mini-table into sub-ties
  const result: string[] = []
  let i = 0
  while (i < miniTable.length) {
    let j = i + 1
    while (j < miniTable.length && compareBasic(miniTable[i], miniTable[j]) === 0) {
      j++
    }

    if (j - i === 1) {
      // Single team — resolved
      result.push(miniTable[i].code)
    } else {
      // Sub-group still tied on h2h
      const subTied = miniTable.slice(i, j).map((t) => t.code)

      if (depth < 1 && subTied.length < tiedCodes.length) {
        // Recurse: build a smaller mini-table from just these teams
        const resolved = resolveHeadToHead(subTied, matches, predictions, depth + 1)
        result.push(...resolved)
      } else {
        // Max recursion or no progress — alphabetical fallback
        result.push(...subTied.sort((a, b) => a.localeCompare(b)))
      }
    }
    i = j
  }

  return result
}

// ─────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────

/**
 * Sort group standings using FIFA-compliant tiebreaker rules.
 *
 * @param teams       - array of team stats (overall standings, pre-computed)
 * @param matches     - all match definitions for this group
 * @param predictions - user's score predictions keyed by match ID
 * @returns new sorted array (does not mutate input)
 */
export function sortGroupStandings<T extends TeamStats>(
  teams: T[],
  matches: MatchDef[],
  predictions: Record<string, MatchScore>
): T[] {
  // Step 1: initial sort by overall pts → GD → GS
  const sorted = [...teams].sort((a, b) => {
    const cmp = compareBasic(a, b)
    if (cmp !== 0) return cmp
    return a.code.localeCompare(b.code)
  })

  // Step 2: identify contiguous groups tied on pts + GD + GS
  const result: T[] = []
  let i = 0
  while (i < sorted.length) {
    let j = i + 1
    while (j < sorted.length && compareBasic(sorted[i], sorted[j]) === 0) {
      j++
    }

    if (j - i === 1) {
      // No tie — keep as-is
      result.push(sorted[i])
    } else {
      // Tied group — resolve with head-to-head
      const tiedTeams = sorted.slice(i, j)
      const tiedCodes = tiedTeams.map((t) => t.code)
      const h2hOrder = resolveHeadToHead(tiedCodes, matches, predictions)

      // Re-order the original team objects according to h2h resolution
      const codeToTeam = new Map(tiedTeams.map((t) => [t.code, t]))
      for (const code of h2hOrder) {
        const team = codeToTeam.get(code)
        if (team) result.push(team)
      }
    }
    i = j
  }

  return result
}
