export interface BracketMatchRule {
  id: string
  home: string
  away: string
}

export const roundOf32Rules: BracketMatchRule[] = [
  { id: 'R32-1', home: '2A', away: '2B' },
  { id: 'R32-2', home: '1E', away: '3rd_E' },
  { id: 'R32-3', home: '1F', away: '2C' },
  { id: 'R32-4', home: '1C', away: '2F' },
  { id: 'R32-5', home: '1I', away: '3rd_I' },
  { id: 'R32-6', home: '2E', away: '2I' },
  { id: 'R32-7', home: '1A', away: '3rd_A' },
  { id: 'R32-8', home: '1L', away: '3rd_L' },
  { id: 'R32-9', home: '1D', away: '3rd_D' },
  { id: 'R32-10', home: '1G', away: '3rd_G' },
  { id: 'R32-11', home: '2K', away: '2L' },
  { id: 'R32-12', home: '1H', away: '2J' },
  { id: 'R32-13', home: '1B', away: '3rd_B' },
  { id: 'R32-14', home: '1J', away: '2H' },
  { id: 'R32-15', home: '1K', away: '3rd_K' },
  { id: 'R32-16', home: '2D', away: '2G' },
]

export const roundOf16Rules: BracketMatchRule[] = [
  { id: 'R16-1', home: 'W-R32-1', away: 'W-R32-3' },
  { id: 'R16-2', home: 'W-R32-2', away: 'W-R32-5' },
  { id: 'R16-3', home: 'W-R32-4', away: 'W-R32-6' },
  { id: 'R16-4', home: 'W-R32-7', away: 'W-R32-8' },
  { id: 'R16-5', home: 'W-R32-11', away: 'W-R32-12' },
  { id: 'R16-6', home: 'W-R32-9', away: 'W-R32-10' },
  { id: 'R16-7', home: 'W-R32-14', away: 'W-R32-16' },
  { id: 'R16-8', home: 'W-R32-13', away: 'W-R32-15' },
]

export const quarterFinalRules: BracketMatchRule[] = [
  { id: 'QF-1', home: 'W-R16-1', away: 'W-R16-2' },
  { id: 'QF-2', home: 'W-R16-5', away: 'W-R16-6' },
  { id: 'QF-3', home: 'W-R16-3', away: 'W-R16-4' },
  { id: 'QF-4', home: 'W-R16-7', away: 'W-R16-8' },
]

export const semiFinalRules: BracketMatchRule[] = [
  { id: 'SF-1', home: 'W-QF-1', away: 'W-QF-2' },
  { id: 'SF-2', home: 'W-QF-3', away: 'W-QF-4' },
]

export const thirdPlaceRule: BracketMatchRule = { id: 'THIRD', home: 'L-SF-1', away: 'L-SF-2' }

export const finalRule: BracketMatchRule = { id: 'FINAL', home: 'W-SF-1', away: 'W-SF-2' }
