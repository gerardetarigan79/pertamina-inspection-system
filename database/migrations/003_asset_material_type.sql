-- US-09: optional material classification for multi-criteria asset filtering.
-- Additive and non-destructive. Existing records remain NULL until verified
-- material information is supplied from an authoritative source.
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS material_type TEXT;

COMMENT ON COLUMN assets.material_type IS
  'Material classification from an authoritative asset register/source; NULL means not supplied or not verified.';
