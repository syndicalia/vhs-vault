-- Migration: Add condition and notes fields to user_collections table
-- Date: 2025-10-23
-- Description: Adds personal collection fields (condition and notes) to user_collections

-- Add condition column (optional field for item condition)
ALTER TABLE user_collections
ADD COLUMN IF NOT EXISTS condition TEXT;

-- Add notes column (optional field for personal notes)
ALTER TABLE user_collections
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add a comment to the table for documentation
COMMENT ON COLUMN user_collections.condition IS 'Physical condition of the item in user collection (e.g., Mint, Good, Fair)';
COMMENT ON COLUMN user_collections.notes IS 'Personal notes about the item in user collection';
