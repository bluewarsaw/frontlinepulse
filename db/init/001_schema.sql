CREATE EXTENSION IF NOT EXISTS postgis;

-- Kategorie incydentów wojny hybrydowej
DO $$ BEGIN
  CREATE TYPE incident_category AS ENUM (
    'gps_jamming', 'cyber', 'drone', 'disinfo', 'border', 'infra'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS incidents (
  id BIGSERIAL PRIMARY KEY,
  category incident_category NOT NULL,
  severity SMALLINT NOT NULL CHECK (severity BETWEEN 1 AND 4),
  title TEXT NOT NULL,
  description TEXT,
  source TEXT NOT NULL,
  source_url TEXT,
  country CHAR(2) NOT NULL,
  geom GEOMETRY(Point, 4326) NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL,
  ingested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- klucz deduplikacji (np. URL artykułu GDELT albo id seedu)
  dedup_key TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS incidents_geom_idx ON incidents USING GIST (geom);
CREATE INDEX IF NOT EXISTS incidents_occurred_idx ON incidents (occurred_at DESC);
CREATE INDEX IF NOT EXISTS incidents_category_idx ON incidents (category);

CREATE TABLE IF NOT EXISTS gps_hexes (
  id BIGSERIAL PRIMARY KEY,
  h3_id TEXT NOT NULL,
  date DATE NOT NULL,
  bad_ratio REAL NOT NULL,
  aircraft_count INTEGER NOT NULL,
  geom GEOMETRY(Polygon, 4326) NOT NULL,
  UNIQUE (h3_id, date)
);

CREATE INDEX IF NOT EXISTS gps_hexes_geom_idx ON gps_hexes USING GIST (geom);
CREATE INDEX IF NOT EXISTS gps_hexes_date_idx ON gps_hexes (date DESC);
