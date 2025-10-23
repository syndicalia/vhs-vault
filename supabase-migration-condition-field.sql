-- Add condition field to variants table
-- Run this in your Supabase SQL Editor

ALTER TABLE variants
ADD COLUMN IF NOT EXISTS condition TEXT;

-- Add comment to document this field
COMMENT ON COLUMN variants.condition IS 'Physical condition: Mint, Near Mint, Very Good, Good, Fair, Poor';
