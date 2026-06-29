/**
 * Maps internal bracket match IDs to official FIFA World Cup 2026 match numbers.
 * Verified against: https://www.fifa.com/en/tournaments/mens/worldcup/canadamexicousa2026/articles/knockout-stage-match-schedule-bracket
 *
 * Round of 32 (73–88), Round of 16 (89–96), Quarter-finals (97–100),
 * Semi-finals (101–102), Third place (103), Final (104)
 */
export const matchNumbers: Record<string, number> = {
  // Round of 32
  'R32-1': 73,
  'R32-2': 74,
  'R32-3': 75,
  'R32-4': 76,
  'R32-5': 77,
  'R32-6': 78,
  'R32-7': 79,
  'R32-8': 80,
  'R32-9': 81,
  'R32-10': 82,
  'R32-11': 83,
  'R32-12': 84,
  'R32-13': 85,
  'R32-14': 86,
  'R32-15': 87,
  'R32-16': 88,
  // Round of 16
  'R16-2': 89,
  'R16-1': 90,
  'R16-3': 91,
  'R16-4': 92,
  'R16-5': 93,
  'R16-6': 94,
  'R16-7': 95,
  'R16-8': 96,
  // Quarter-finals
  'QF-1': 97,
  'QF-2': 98,
  'QF-3': 99,
  'QF-4': 100,
  // Semi-finals
  'SF-1': 101,
  'SF-2': 102,
  // Third place
  'THIRD': 103,
  // Final
  'FINAL': 104,
}
