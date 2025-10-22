-- Add poster_url column to master_releases table
-- Run this in Supabase SQL Editor

-- Check if the column already exists and add it if not
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 'master_releases'
        AND column_name = 'poster_url'
    ) THEN
        ALTER TABLE master_releases
        ADD COLUMN poster_url TEXT;

        RAISE NOTICE 'Column poster_url added to master_releases table';
    ELSE
        RAISE NOTICE 'Column poster_url already exists in master_releases table';
    END IF;
END $$;

-- Add comment to the column
COMMENT ON COLUMN master_releases.poster_url IS 'URL to TMDB movie poster image';
