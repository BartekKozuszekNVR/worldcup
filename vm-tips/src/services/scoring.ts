export const STAGE_MULTIPLIERS = {
  group: 1,
  r32: 1.5,
  r16: 2,
  qf: 2.5,
  sf: 3,
  third: 2,
  final: 4,
} as const

export const MATCH_POINTS = {
  exact: 5,
  correctResult: 3,
  halfScore: 1.5,
  outcome: 1,
} as const

export const BONUS_POINTS = {
  groupWinner: 5,
  groupRunner: 3,
  advancing: 2,
  r16Participant: 3,
  qfParticipant: 5,
  semifinalist: 10,
  finalist: 15,
  champion: 25,
  topScorer: 20,
  bronzeParticipant: 3,
  bronzeWinner: 8,
} as const
