-- Fix R32 matchups in match_results
-- Generated 2026-06-28
--
-- Group results used (from tournament_progress):
--   A: winner=MX, runner=ZA   G: winner=BE, runner=EG
--   B: winner=CH, runner=CA   H: winner=ES, runner=CV
--   C: winner=BR, runner=MA   I: winner=FR, runner=NO
--   D: winner=US, runner=AU   J: winner=AR, runner=AT
--   E: winner=DE, runner=CI   K: winner=CO, runner=PT
--   F: winner=NL, runner=JP   L: winner=GB-ENG, runner=HR
--
-- Best third-place teams (from tournament_progress bestThird_1-8):
--   Groups qualifying: B(BA), D(PY), E(EC), F(SE), I(SN), J(DZ), K(CD), L(GH)
--
-- Corrected 3rd-place slot assignments (combo #429, FIFA actual bracket):
--   3rd_A ← group E → EC   (R32-7:  MX  vs EC       unchanged)
--   3rd_B ← group J → DZ   (R32-13: CH  vs DZ       CORRECTED was SE/Sweden)
--   3rd_D ← group B → BA   (R32-9:  US  vs BA       CORRECTED was SN/Senegal)
--   3rd_E ← group D → PY   (R32-2:  DE  vs PY       CORRECTED was BA/Bosnia)
--   3rd_G ← group I → SN   (R32-10: BE  vs SN       CORRECTED was DZ/Algeria)
--   3rd_I ← group F → SE   (R32-5:  FR  vs SE       CORRECTED was PY/Paraguay)
--   3rd_K ← group L → GH   (R32-15: CO  vs GH       unchanged)
--   3rd_L ← group K → CD   (R32-8:  GB-ENG vs CD    unchanged)

INSERT OR REPLACE INTO match_results (match_id, home_team, away_team, updated_at) VALUES
  -- R32-1:  2A vs 2B
  ('R32-1',  'ZA',     'CA',  datetime('now')),
  -- R32-2:  1E vs 3rd_E  → Germany vs Paraguay  ✓ CORRECTED
  ('R32-2',  'DE',     'PY',  datetime('now')),
  -- R32-3:  1F vs 2C
  ('R32-3',  'NL',     'MA',  datetime('now')),
  -- R32-4:  1C vs 2F
  ('R32-4',  'BR',     'JP',  datetime('now')),
  -- R32-5:  1I vs 3rd_I  → France vs Sweden  ✓ CORRECTED
  ('R32-5',  'FR',     'SE',  datetime('now')),
  -- R32-6:  2E vs 2I
  ('R32-6',  'CI',     'NO',  datetime('now')),
  -- R32-7:  1A vs 3rd_A  → Mexico vs Ecuador
  ('R32-7',  'MX',     'EC',  datetime('now')),
  -- R32-8:  1L vs 3rd_L  → England vs DR Congo
  ('R32-8',  'GB-ENG', 'CD',  datetime('now')),
  -- R32-9:  1D vs 3rd_D  → USA vs Bosnia  ✓ CORRECTED
  ('R32-9',  'US',     'BA',  datetime('now')),
  -- R32-10: 1G vs 3rd_G  → Belgium vs Senegal  ✓ CORRECTED
  ('R32-10', 'BE',     'SN',  datetime('now')),
  -- R32-11: 2K vs 2L
  ('R32-11', 'PT',     'HR',  datetime('now')),
  -- R32-12: 1H vs 2J
  ('R32-12', 'ES',     'AT',  datetime('now')),
  -- R32-13: 1B vs 3rd_B  → Switzerland vs Algeria  ✓ CORRECTED
  ('R32-13', 'CH',     'DZ',  datetime('now')),
  -- R32-14: 1J vs 2H
  ('R32-14', 'AR',     'CV',  datetime('now')),
  -- R32-15: 1K vs 3rd_K  → Colombia vs Ghana
  ('R32-15', 'CO',     'GH',  datetime('now')),
  -- R32-16: 2D vs 2G
  ('R32-16', 'AU',     'EG',  datetime('now'));
