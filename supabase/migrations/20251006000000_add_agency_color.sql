-- Add agency_color field to client_zipcodes table
-- This stores the hex color code associated with each agency from the CSV upload

ALTER TABLE public.client_zipcodes
ADD COLUMN IF NOT EXISTS agency_color TEXT;

-- Create index for faster filtering by color/agency
CREATE INDEX IF NOT EXISTS idx_client_zipcodes_agency_color
  ON public.client_zipcodes(agency_color)
  WHERE agency_color IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.client_zipcodes.agency_color IS 'Hex color code for the agency (e.g., #FF5733)';
