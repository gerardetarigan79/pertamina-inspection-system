-- US-01: Unified asset register and source-record relationships.
-- Safe to run repeatedly. Existing sample rows are preserved.
-- asset_id is the canonical key shared by all source datasets.

CREATE TABLE IF NOT EXISTS assets (
  asset_id TEXT PRIMARY KEY,
  asset_name TEXT NOT NULL,
  asset_type TEXT NOT NULL,
  area TEXT NOT NULL,
  department TEXT NOT NULL CHECK (department IN ('Pipeline', 'Surface Facility')),
  nominal_thickness NUMERIC,
  latest_thickness NUMERIC,
  operating_pressure NUMERIC,
  condition TEXT,
  last_inspection_date DATE,
  is_sample BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Source records must always resolve to a registered asset.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'production_readings_asset_id_fkey'
  ) THEN
    ALTER TABLE production_readings
      ADD CONSTRAINT production_readings_asset_id_fkey
      FOREIGN KEY (asset_id) REFERENCES assets(asset_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inspection_records_asset_id_fkey'
  ) THEN
    ALTER TABLE inspection_records
      ADD CONSTRAINT inspection_records_asset_id_fkey
      FOREIGN KEY (asset_id) REFERENCES assets(asset_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'pipeline_inspections_asset_id_fkey'
  ) THEN
    ALTER TABLE pipeline_inspections
      ADD CONSTRAINT pipeline_inspections_asset_id_fkey
      FOREIGN KEY (asset_id) REFERENCES assets(asset_id);
  END IF;
END $$;

-- Uniqueness is already enforced by these table constraints:
-- production_readings: UNIQUE (asset_id, reading_date)
-- inspection_records: UNIQUE (asset_id, inspection_date, tml_id)
-- pipeline_inspections: UNIQUE (asset_id, inspection_date, method, measured_thickness_mm)
-- Do not add duplicate indexes for these constraints.
