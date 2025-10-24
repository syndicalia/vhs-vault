-- Migration: Add database indexes for performance optimization
-- Date: 2025-10-24
-- Description: Adds indexes on frequently queried columns to improve query performance

-- Index on master_releases.title for faster search queries
CREATE INDEX IF NOT EXISTS idx_master_releases_title ON master_releases(title);

-- Index on master_releases.director for search functionality
CREATE INDEX IF NOT EXISTS idx_master_releases_director ON master_releases(director);

-- Index on master_releases.year for filtering
CREATE INDEX IF NOT EXISTS idx_master_releases_year ON master_releases(year);

-- Index on variants.master_id for faster joins
CREATE INDEX IF NOT EXISTS idx_variants_master_id ON variants(master_id);

-- Index on variants.approved for filtering approved variants
CREATE INDEX IF NOT EXISTS idx_variants_approved ON variants(approved);

-- Composite index on user_collections for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_collections_user_variant ON user_collections(user_id, variant_id);

-- Index on user_collections.master_id for collection queries
CREATE INDEX IF NOT EXISTS idx_user_collections_master_id ON user_collections(master_id);

-- Composite index on user_wishlists for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_wishlists_user_variant ON user_wishlists(user_id, variant_id);

-- Index on user_wishlists.master_id for wishlist queries
CREATE INDEX IF NOT EXISTS idx_user_wishlists_master_id ON user_wishlists(master_id);

-- Index on user_ratings for faster rating lookups
CREATE INDEX IF NOT EXISTS idx_user_ratings_user_master ON user_ratings(user_id, master_id);

-- Index on variant_images.variant_id for faster image loading
CREATE INDEX IF NOT EXISTS idx_variant_images_variant_id ON variant_images(variant_id);

-- Index on variant_images.image_order for ordered image retrieval
CREATE INDEX IF NOT EXISTS idx_variant_images_variant_order ON variant_images(variant_id, image_order);

-- Index on marketplace_listings.active for filtering active listings
CREATE INDEX IF NOT EXISTS idx_marketplace_active ON marketplace_listings(active);

-- Index on submission_votes for vote lookups
CREATE INDEX IF NOT EXISTS idx_submission_votes_user_variant ON submission_votes(user_id, variant_id);

-- Add comments for documentation
COMMENT ON INDEX idx_master_releases_title IS 'Optimizes search queries on master release titles';
COMMENT ON INDEX idx_variants_master_id IS 'Optimizes variant joins with master releases';
COMMENT ON INDEX idx_user_collections_user_variant IS 'Optimizes collection membership checks';
COMMENT ON INDEX idx_variant_images_variant_id IS 'Optimizes image loading for variants';
