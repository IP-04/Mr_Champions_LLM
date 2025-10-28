-- Add new columns to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS radar_stats jsonb;
ALTER TABLE players ADD COLUMN IF NOT EXISTS sofifa_id text;
