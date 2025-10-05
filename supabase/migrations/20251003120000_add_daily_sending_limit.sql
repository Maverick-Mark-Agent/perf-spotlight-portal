-- Add daily_sending_limit column to email_account_metadata table
-- This stores calculated or manual override sending limits per email account

ALTER TABLE public.email_account_metadata
ADD COLUMN IF NOT EXISTS daily_sending_limit integer DEFAULT NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_email_account_metadata_sending_limit
  ON public.email_account_metadata(daily_sending_limit);

-- Add comment for documentation
COMMENT ON COLUMN public.email_account_metadata.daily_sending_limit IS
  'Daily sending limit for this email account. If NULL, uses calculated limit based on provider rules. Manual overrides stored here.';

-- Verify column was added
SELECT 'daily_sending_limit column added successfully!' as status;
