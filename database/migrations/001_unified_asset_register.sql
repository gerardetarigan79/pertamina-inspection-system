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

-- Prevent duplicate source records when the same import is submitted again.
CREATE UNIQUE INDEX IF NOT EXISTS production_readings_asset_date_uidx
  ON production_readings (asset_id, reading_date);

CREATE UNIQUE INDEX IF NOT EXISTS inspection_records_asset_date_tml_uidx
  ON inspection_records (asset_id, inspection_date, tml_id);

CREATE UNIQUE INDEX IF NOT EXISTS pipeline_inspections_asset_date_method_thickness_uidx
  ON pipeline_inspections (asset_id, inspection_date, method, measured_thickness_mm);

CREATE INDEX IF NOT EXISTS production_readings_asset_date_idx
  ON production_readings (asset_id, reading_date DESC);

CREATE INDEX IF NOT EXISTS inspection_records_asset_date_idx
  ON inspection_records (asset_id, inspection_date DESC);

CREATE INDEX IF NOT EXISTS pipeline_inspections_asset_date_idx
  ON pipeline_inspections (asset_id, inspection_date DESC);
