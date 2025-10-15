# Tony Schmitz - Slack Webhook Setup Guide

## Overview
This document describes the setup for sending interested lead notifications from Tony Schmitz's Email Bison workspace to a Slack channel.

## Implementation Details

### 1. Database Schema
Added `slack_webhook_url` column to `client_registry` table to store client-specific Slack webhook URLs.

### 2. Webhook Handler
Updated `/supabase/functions/universal-bison-webhook/index.ts` to:
- Fetch the Slack webhook URL for each workspace from `client_registry`
- Send formatted Slack notifications when interested leads come in
- Extract custom variables (birthday, address, city, state, zip, renewal date, phone)
- Format messages to match your existing notification style

### 3. Slack Notification Format
```
🔥 New Lead!
Name: Brett Winston
Email: brett.m.winston@gmail.com
Birthday: 9/25/1982
Address: 144 Camelin Dr
City: Washington
State: IL
ZIP: 61571
Renewal Date: October 31st
Phone: (309) 657-1339

Reply Preview:
Happy to have a second opinion / review. Let me know what you need from me to kick this off.
```

## Setup Instructions

### Step 1: Run SQL Migration
1. Go to Supabase SQL Editor: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new
2. Copy contents from `RUN_THIS_TO_ADD_SLACK_WEBHOOK.sql`
3. Run the SQL
4. Verify Tony Schmitz has the webhook URL set

### Step 2: Test the Integration
Run the test script:
```bash
./scripts/test-tony-slack-webhook.sh
```

This will send a test interested lead webhook and you should see a notification in your Slack test channel.

### Step 3: Verify Webhook is Registered
Check that Tony Schmitz's workspace has the webhook registered in Email Bison:
```bash
curl -s "https://send.maverickmarketingllc.com/api/workspaces/v1.1/webhooks" \
  -H "Authorization: Bearer 95|LISJUmFyQwfsKNsYB0XgQPQkQ5JXDbuVWN9TPBMNf1575525" \
  -H "Accept: application/json"
```

Expected webhook URL: `https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/universal-bison-webhook`

## Configuration

### Tony Schmitz Details
- **Workspace Name:** Tony Schmitz
- **Bison Workspace ID:** 41
- **Bison Instance:** Maverick
- **Bison API Key:** `95|LISJUmFyQwfsKNsYB0XgQPQkQ5JXDbuVWN9TPBMNf1575525`
- **Slack Webhook URL (TEST):** `https://hooks.slack.com/services/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`

### Webhook Events
The system listens for the `lead_interested` event from Email Bison and automatically:
1. Records the lead in `client_leads` table
2. Increments the `interested_mtd` metric counter
3. Sends a Slack notification to the configured webhook URL

## Adding Slack Notifications for Other Clients

To enable Slack notifications for other clients:

1. Create a Slack webhook URL for that client (see "Create a Slack App" instructions in main docs)
2. Update the client's record in `client_registry`:
   ```sql
   UPDATE client_registry
   SET slack_webhook_url = 'https://hooks.slack.com/services/YOUR/WEBHOOK/URL'
   WHERE workspace_name = 'Client Name';
   ```
3. Test with the script (modify workspace name in the test payload)

## Troubleshooting

### No Slack notification received
1. Check webhook delivery logs:
   ```sql
   SELECT * FROM webhook_delivery_log
   WHERE workspace_name = 'Tony Schmitz'
   AND event_type = 'lead_interested'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

2. Check function logs:
   ```bash
   # View logs in Supabase Dashboard
   https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions
   ```

3. Verify Slack webhook URL is valid:
   ```bash
   curl -X POST "https://hooks.slack.com/services/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" \
     -H 'Content-Type: application/json' \
     -d '{"text":"Test message"}'
   ```

### Custom Variables Not Showing
The system looks for these custom variable names (case-insensitive):
- `birthday` or `Birthday`
- `address` or `Address`
- `city` or `City`
- `state` or `State`
- `zip` or `ZIP` or `Zip Code`
- `renewal_date` or `Renewal Date`
- `phone` or `Phone` or `Phone Number`

Make sure these custom variables are set up correctly in Email Bison for Tony Schmitz's workspace.

## Production Deployment

When you're ready to deploy to the client's actual Slack workspace:

1. Create a new Slack app in the client's workspace
2. Generate a new webhook URL for their production channel
3. Update the database:
   ```sql
   UPDATE client_registry
   SET slack_webhook_url = 'NEW_PRODUCTION_WEBHOOK_URL'
   WHERE workspace_name = 'Tony Schmitz';
   ```

No code changes needed - the webhook will automatically use the new URL!

## Files Modified/Created

### Modified:
- `/supabase/functions/universal-bison-webhook/index.ts` - Added Slack notification functionality

### Created:
- `/supabase/migrations/20251013020000_add_slack_webhook_url.sql` - Database migration
- `/scripts/test-tony-slack-webhook.sh` - Test script
- `RUN_THIS_TO_ADD_SLACK_WEBHOOK.sql` - SQL to run in dashboard
- `/docs/TONY_SCHMITZ_SLACK_WEBHOOK_SETUP.md` - This documentation

## Date Completed
October 13, 2025
