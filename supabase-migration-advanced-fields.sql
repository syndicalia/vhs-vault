-- Add advanced optional fields to variants table
-- Run this in your Supabase SQL Editor

ALTER TABLE variants
ADD COLUMN IF NOT EXISTS edition_type TEXT,
ADD COLUMN IF NOT EXISTS audio_language TEXT,
ADD COLUMN IF NOT EXISTS subtitles TEXT,
ADD COLUMN IF NOT EXISTS rating TEXT,
ADD COLUMN IF NOT EXISTS aspect_ratio TEXT,
ADD COLUMN IF NOT EXISTS shell_color TEXT;

-- Add comments to document these fields
COMMENT ON COLUMN variants.edition_type IS 'Type of edition: Retail, Promotional, Screener, Bootleg';
COMMENT ON COLUMN variants.audio_language IS 'Primary audio language: English, Spanish, French, Japanese, Chinese, German';
COMMENT ON COLUMN variants.subtitles IS 'Subtitles available: Yes or No';
COMMENT ON COLUMN variants.rating IS 'Original rating: G, PG, PG-13, R, NC-17, 18+, Not Rated, Unrated';
COMMENT ON COLUMN variants.aspect_ratio IS 'Video aspect ratio: 4:3 (Fullscreen), 1.85:1 (Widescreen), etc.';
COMMENT ON COLUMN variants.shell_color IS 'Physical VHS shell color: Black, White, Clear, Gray, Red, Blue, Green, Yellow, Orange';
