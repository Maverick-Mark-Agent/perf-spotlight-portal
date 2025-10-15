-- =====================================================
-- ADD CLEAN CONTACT TARGET TO CLIENT REGISTRY
-- =====================================================
-- This migration adds a new field for tracking cleaned/verified contact targets
-- separate from the raw contact upload targets.
--
-- Purpose: Track the goal for VERIFIED contacts per month, not just raw uploads
-- Initial Value: 0 (will be configured per client later via backend)
-- =====================================================

-- Add clean_contact_target column to client_registry
ALTER TABLE public.client_registry
ADD COLUMN IF NOT EXISTS clean_contact_target INTEGER DEFAULT 0;

COMMENT ON COLUMN public.client_registry.clean_contact_target
IS 'Target for cleaned/verified contacts per month (separate from raw upload target). Represents the goal for contacts that have passed email verification and are ready for campaigns.';

-- Initialize to 0 for all existing clients
UPDATE public.client_registry
SET clean_contact_target = 0
WHERE clean_contact_target IS NULL;

-- Ensure the column is not null
ALTER TABLE public.client_registry
ALTER COLUMN clean_contact_target SET NOT NULL;

-- Add check constraint to ensure reasonable values
ALTER TABLE public.client_registry
ADD CONSTRAINT check_clean_contact_target_positive
CHECK (clean_contact_target >= 0);

COMMENT ON TABLE public.client_registry IS 'Central registry of all clients with their configuration, targets, and API credentials. Now includes clean_contact_target for verified contact goals.';
