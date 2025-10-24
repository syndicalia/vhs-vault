-- Migration: Add advanced variant fields and rename packaging to case_type
-- Date: 2025-10-24
-- Description: Adds optional advanced metadata fields for variants and updates case type options

-- Rename packaging column to case_type (if using PostgreSQL 9.6+)
ALTER TABLE variants RENAME COLUMN packaging TO case_type;

-- Add new optional advanced fields
ALTER TABLE variants
ADD COLUMN IF NOT EXISTS edition_type TEXT,
ADD COLUMN IF NOT EXISTS audio_language TEXT,
ADD COLUMN IF NOT EXISTS subtitles BOOLEAN,
ADD COLUMN IF NOT EXISTS original_rating TEXT,
ADD COLUMN IF NOT EXISTS aspect_ratio TEXT,
ADD COLUMN IF NOT EXISTS shell_color TEXT;

-- Add comments for documentation
COMMENT ON COLUMN variants.case_type IS 'Type of VHS case: Slipcase, Clamshell, Big Box, Other';
COMMENT ON COLUMN variants.edition_type IS 'Edition type: Retail, Promotional, Screener, Bootleg';
COMMENT ON COLUMN variants.audio_language IS 'Primary audio language';
COMMENT ON COLUMN variants.subtitles IS 'Whether the tape includes subtitles';
COMMENT ON COLUMN variants.original_rating IS 'Original content rating (R, PG-13, etc)';
COMMENT ON COLUMN variants.aspect_ratio IS 'Video aspect ratio (4:3, 1.85:1, etc)';
COMMENT ON COLUMN variants.shell_color IS 'Physical shell/cassette color';
