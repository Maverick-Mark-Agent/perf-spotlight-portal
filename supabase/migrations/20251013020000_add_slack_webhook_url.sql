-- Add slack_webhook_url column to client_registry
ALTER TABLE client_registry
ADD COLUMN IF NOT EXISTS slack_webhook_url TEXT;

-- Add comment
COMMENT ON COLUMN client_registry.slack_webhook_url IS 'Slack webhook URL for sending interested lead notifications';

-- Update Tony Schmitz with the webhook URL
UPDATE client_registry
SET slack_webhook_url = 'https://hooks.slack.com/services/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'
WHERE workspace_name = 'Tony Schmitz';
