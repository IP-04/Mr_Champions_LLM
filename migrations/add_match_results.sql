-- Migration: Add match result tracking columns
-- Created: 2025-10-29
-- Purpose: Store actual match results for ML training

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN IF NOT EXISTS home_goals INTEGER,
ADD COLUMN IF NOT EXISTS away_goals INTEGER,
ADD COLUMN IF NOT EXISTS actual_home_xg REAL,
ADD COLUMN IF NOT EXISTS actual_away_xg REAL;

-- Create index on status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);

-- Add comment for documentation
COMMENT ON COLUMN matches.status IS 'Match status: SCHEDULED, IN_PLAY, FINISHED, POSTPONED, CANCELLED';
COMMENT ON COLUMN matches.home_goals IS 'Actual goals scored by home team (NULL if not finished)';
COMMENT ON COLUMN matches.away_goals IS 'Actual goals scored by away team (NULL if not finished)';
COMMENT ON COLUMN matches.actual_home_xg IS 'Actual expected goals for home team from match data';
COMMENT ON COLUMN matches.actual_away_xg IS 'Actual expected goals for away team from match data';
