# Slack Webhook Setup for Volume Dashboard

This guide explains how to set up Slack integration for the Volume Dashboard to send automated reports.

## Prerequisites

- Admin access to your Slack workspace
- Access to Supabase project dashboard

## Step 1: Create a Slack Incoming Webhook

1. Go to [Slack API: Incoming Webhooks](https://api.slack.com/messaging/webhooks)
2. Click **"Create your Slack app"** (or use an existing app)
3. Choose **"From scratch"**
4. Enter app name (e.g., "Volume Dashboard Bot")
5. Select your workspace
6. Click **"Create App"**

## Step 2: Enable Incoming Webhooks

1. In your Slack app settings, click **"Incoming Webhooks"** in the sidebar
2. Toggle **"Activate Incoming Webhooks"** to **ON**
3. Scroll down and click **"Add New Webhook to Workspace"**
4. Select the channel where you want to receive volume reports (or choose to send DMs)
5. Click **"Allow"**
6. **Copy the Webhook URL** (it looks like: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXX`)

## Step 3: Add Webhook URL to Supabase Secrets

### Option A: Using Supabase Dashboard (Recommended)

1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project (`gjqbbgrfhijescaouqkx`)
3. Navigate to **Settings** → **Edge Functions**
4. Scroll to **"Secrets"** section
5. Click **"Add new secret"**
6. Enter:
   - **Name:** `SLACK_VOLUME_WEBHOOK_URL`
   - **Value:** Your Slack webhook URL from Step 2
7. Click **"Save"**

### Option B: Using Supabase CLI

```bash
# Set the secret
supabase secrets set SLACK_VOLUME_WEBHOOK_URL="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
```

## Step 4: Deploy the Supabase Edge Function

```bash
# Deploy the new function
supabase functions deploy send-volume-slack-dm

# Verify deployment
supabase functions list
```

## Step 5: Test the Integration

1. Open the Volume Dashboard at `http://localhost:8080`
2. Navigate to the **Sending Volume Overview** page
3. Click the **"Send Volume Slack DM"** button
4. Check your Slack channel/DM for the volume report

## Slack Message Format

The Slack message includes:

- **Overall Progress**: MTD percentage and totals
- **Critical Clients**: Clients behind pace (projected < 80%)
- **Top Performers**: Clients on track to exceed target
- Each client shows:
  - Current volume and percentage
  - Projected end-of-month volume
  - Daily quota needed

## Troubleshooting

### Error: "SLACK_VOLUME_WEBHOOK_URL not found"

- Ensure you added the secret to Supabase (Step 3)
- Redeploy the function after adding the secret

### Message not appearing in Slack

- Verify the webhook URL is correct
- Check that the Slack app has permission to post to the channel
- Check Supabase function logs: `supabase functions logs send-volume-slack-dm`

### Function timeout

- The function processes all workspaces sequentially, which may take time
- Consider optimizing by filtering inactive clients

## Customization

To customize the message format, edit:
```
supabase/functions/send-volume-slack-dm/index.ts
```

The `generateSlackMessage()` function uses [Slack Block Kit](https://api.slack.com/block-kit) for formatting.

## Security Notes

- Never commit the webhook URL to version control
- The webhook URL should only be stored in Supabase secrets
- Rotate the webhook URL periodically for security
- Consider using Slack's OAuth flow for production apps instead of webhooks
