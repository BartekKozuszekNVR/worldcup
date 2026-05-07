export interface GroupMatch {
  id: string
  home: string
  away: string
}

export const groupMatches: Record<string, GroupMatch[]> = {
  A: [
    { id: 'A1', home: 'MX', away: 'ZA' },
    { id: 'A2', home: 'KR', away: 'CZ' },
    { id: 'A3', home: 'MX', away: 'KR' },
    { id: 'A4', home: 'ZA', away: 'CZ' },
    { id: 'A5', home: 'MX', away: 'CZ' },
    { id: 'A6', home: 'KR', away: 'ZA' }
  ],
  B: [
    { id: 'B1', home: 'CA', away: 'BA' },
    { id: 'B2', home: 'QA', away: 'CH' },
    { id: 'B3', home: 'CA', away: 'QA' },
    { id: 'B4', home: 'BA', away: 'CH' },
    { id: 'B5', home: 'CA', away: 'CH' },
    { id: 'B6', home: 'QA', away: 'BA' }
  ],
  C: [
    { id: 'C1', home: 'BR', away: 'MA' },
    { id: 'C2', home: 'HT', away: 'GB-SCT' },
    { id: 'C3', home: 'BR', away: 'HT' },
    { id: 'C4', home: 'MA', away: 'GB-SCT' },
    { id: 'C5', home: 'BR', away: 'GB-SCT' },
    { id: 'C6', home: 'MA', away: 'HT' }
  ],
  D: [
    { id: 'D1', home: 'US', away: 'PY' },
    { id: 'D2', home: 'AU', away: 'TR' },
    { id: 'D3', home: 'US', away: 'AU' },
    { id: 'D4', home: 'PY', away: 'TR' },
    { id: 'D5', home: 'US', away: 'TR' },
    { id: 'D6', home: 'AU', away: 'PY' }
  ],
  E: [
    { id: 'E1', home: 'DE', away: 'CW' },
    { id: 'E2', home: 'CI', away: 'EC' },
    { id: 'E3', home: 'DE', away: 'CI' },
    { id: 'E4', home: 'CW', away: 'EC' },
    { id: 'E5', home: 'DE', away: 'EC' },
    { id: 'E6', home: 'CW', away: 'CI' }
  ],
  F: [
    { id: 'F1', home: 'NL', away: 'JP' },
    { id: 'F2', home: 'SE', away: 'TN' },
    { id: 'F3', home: 'NL', away: 'SE' },
    { id: 'F4', home: 'JP', away: 'TN' },
    { id: 'F5', home: 'NL', away: 'TN' },
    { id: 'F6', home: 'JP', away: 'SE' }
  ],
  G: [
    { id: 'G1', home: 'BE', away: 'EG' },
    { id: 'G2', home: 'IR', away: 'NZ' },
    { id: 'G3', home: 'BE', away: 'IR' },
    { id: 'G4', home: 'EG', away: 'NZ' },
    { id: 'G5', home: 'BE', away: 'NZ' },
    { id: 'G6', home: 'EG', away: 'IR' }
  ],
  H: [
    { id: 'H1', home: 'ES', away: 'CV' },
    { id: 'H2', home: 'SA', away: 'UY' },
    { id: 'H3', home: 'ES', away: 'SA' },
    { id: 'H4', home: 'CV', away: 'UY' },
    { id: 'H5', home: 'ES', away: 'UY' },
    { id: 'H6', home: 'CV', away: 'SA' }
  ],
  I: [
    { id: 'I1', home: 'FR', away: 'SN' },
    { id: 'I2', home: 'IQ', away: 'NO' },
    { id: 'I3', home: 'FR', away: 'IQ' },
    { id: 'I4', home: 'SN', away: 'NO' },
    { id: 'I5', home: 'FR', away: 'NO' },
    { id: 'I6', home: 'SN', away: 'IQ' }
  ],
  J: [
    { id: 'J1', home: 'AR', away: 'DZ' },
    { id: 'J2', home: 'AT', away: 'JO' },
    { id: 'J3', home: 'AR', away: 'AT' },
    { id: 'J4', home: 'DZ', away: 'JO' },
    { id: 'J5', home: 'AR', away: 'JO' },
    { id: 'J6', home: 'DZ', away: 'AT' }
  ],
  K: [
    { id: 'K1', home: 'PT', away: 'CD' },
    { id: 'K2', home: 'UZ', away: 'CO' },
    { id: 'K3', home: 'PT', away: 'UZ' },
    { id: 'K4', home: 'CD', away: 'CO' },
    { id: 'K5', home: 'PT', away: 'CO' },
    { id: 'K6', home: 'CD', away: 'UZ' }
  ],
  L: [
    { id: 'L1', home: 'GB-ENG', away: 'HR' },
    { id: 'L2', home: 'GH', away: 'PA' },
    { id: 'L3', home: 'GB-ENG', away: 'GH' },
    { id: 'L4', home: 'HR', away: 'PA' },
    { id: 'L5', home: 'GB-ENG', away: 'PA' },
    { id: 'L6', home: 'HR', away: 'GH' }
  ]
}

export const teamsByGroup: Record<string, string[]> = {
  A: ['MX', 'ZA', 'KR', 'CZ'],
  B: ['CA', 'BA', 'QA', 'CH'],
  C: ['BR', 'MA', 'HT', 'GB-SCT'],
  D: ['US', 'PY', 'AU', 'TR'],
  E: ['DE', 'CW', 'CI', 'EC'],
  F: ['NL', 'JP', 'SE', 'TN'],
  G: ['BE', 'EG', 'IR', 'NZ'],
  H: ['ES', 'CV', 'SA', 'UY'],
  I: ['FR', 'SN', 'IQ', 'NO'],
  J: ['AR', 'DZ', 'AT', 'JO'],
  K: ['PT', 'CD', 'UZ', 'CO'],
  L: ['GB-ENG', 'HR', 'GH', 'PA']
}

export const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const
