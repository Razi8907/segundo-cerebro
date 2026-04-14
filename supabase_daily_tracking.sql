-- Daily tracking table for April data (ordenes ingresadas por día)
-- Run this ONCE in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS daily_tracking (
  id BIGSERIAL PRIMARY KEY,
  country TEXT NOT NULL,
  fecha INTEGER NOT NULL,
  ordenes INTEGER NOT NULL,
  dia_semana TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (country, fecha)
);

CREATE INDEX IF NOT EXISTS idx_daily_tracking_country ON daily_tracking(country);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE daily_tracking ENABLE ROW LEVEL SECURITY;

-- Allow read/write for authenticated users
CREATE POLICY "daily_tracking_read" ON daily_tracking FOR SELECT USING (true);
CREATE POLICY "daily_tracking_write" ON daily_tracking FOR ALL USING (true) WITH CHECK (true);
