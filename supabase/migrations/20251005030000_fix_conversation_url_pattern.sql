-- Migration: Fix Email Bison conversation URL pattern
-- Purpose: Email Bison doesn't support direct conversation URLs, use inbox search instead

-- Create function to generate inbox search URLs based on lead email
CREATE OR REPLACE FUNCTION generate_bison_inbox_search_url(
  p_lead_email TEXT,
  p_base_url TEXT DEFAULT 'https://send.maverickmarketingllc.com'
) RETURNS TEXT AS $$
BEGIN
  IF p_lead_email IS NULL THEN
    RETURN NULL;
  END IF;
  -- Use inbox search pattern that actually works in Email Bison
  RETURN p_base_url || '/inbox?search=' || p_lead_email;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION generate_bison_inbox_search_url IS 'Generates Email Bison inbox search URL for a lead email address';
