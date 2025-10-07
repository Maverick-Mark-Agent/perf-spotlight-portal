# Slack Integration Setup

This guide explains how to set up the Slack integration for automatic new client notifications and target updates.

## Overview

When new Email Bison clients are added, the team receives a Slack notification and can set monthly sending targets directly from Slack using a slash command.

## Setup Steps

### 1. Create Slack App

1. Go to https://api.slack.com/apps
2. Click **Create New App** → **From scratch**
3. Name: `Email Bison Client Manager`
4. Select your workspace

### 2. Webhook Already Configured! ✅

**Good news:** The system uses the same Slack webhook that's already configured for volume notifications (`SLACK_VOLUME_WEBHOOK_URL`), so new client notifications will appear in the same channel automatically.

No additional webhook setup needed!

### 3. Create Slash Command (for updating targets)

1. In your Slack app, go to **Slash Commands**
2. Click **Create New Command**
3. Fill in:
   - **Command:** `/set-target`
   - **Request URL:** `https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/slack-set-target`
   - **Short Description:** `Set monthly sending target for a client`
   - **Usage Hint:** `<workspace_name> <target>`
4. Click **Save**

### 4. Install App to Workspace

1. Go to **Install App** in your Slack app settings
2. Click **Install to Workspace**
3. Authorize the app

### 5. Test the Integration

#### Test New Client Notification:

```bash
# This will trigger a notification if there are new clients
curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-new-clients" \
  -H "Authorization: Bearer YOUR_SUPABASE_KEY"
```

#### Test Slash Command in Slack:

```
/set-target "John Roberts" 45500
```

You should see a confirmation message visible to everyone in the channel.

## How It Works

### New Client Workflow

1. **Sync runs** (daily scheduled or manual trigger)
2. **New clients detected** from Email Bison
3. **Added to database** with `monthly_sending_target = 0`
4. **Slack notification sent** to configured channel with:
   - List of new clients
   - Current status (excluded from reports)
   - Example commands to set targets

### Setting Targets via Slack

1. Team member replies with `/set-target <workspace_name> <target>`
2. Slash command validates and updates `client_registry`
3. Confirmation message posted to channel
4. Client immediately appears in volume reports

## Slash Command Examples

```bash
# Set target for client with simple name
/set-target Danny 45500

# Set target for client with spaces (use quotes)
/set-target "John Roberts" 45500

# Set target for client with special characters
/set-target "StreetSmart P&C" 45500

# Common targets:
# - Small accounts: 22750
# - Medium accounts: 45500
# - Large accounts: 91000
# - Extra large: 136500
```

## Error Handling

### Client not found?

The slash command will suggest similar names:

```
❌ Client not found: "John"

Did you mean one of these?
• John Roberts
• Johnny's Team
```

### Invalid format?

The slash command will show usage:

```
❌ Invalid format. Usage: /set-target <workspace_name> <target>

Examples:
• /set-target "John Roberts" 45500
• /set-target Danny 45500
```

## Notification Example

When new clients are added, the Slack notification looks like:

```
🆕 2 New Email Bison Clients Added

Please set monthly sending targets for the following clients to include them in volume reports:

━━━━━━━━━━━━━━━━━

New Client Name
• Workspace: New Client Name
• Current Target: 0 (excluded from reports)
• To set target, reply: /set-target "New Client Name" 45500

Another New Client
• Workspace: Another New Client
• Current Target: 0 (excluded from reports)
• To set target, reply: /set-target "Another New Client" 45500

━━━━━━━━━━━━━━━━━

📝 How to set targets:
Reply to this message with: /set-target <workspace_name> <target>

Example: /set-target "John Roberts" 45500
```

## Troubleshooting

### Slash command not working?

1. Verify Request URL in Slack app settings
2. Check Supabase function logs
3. Ensure function is deployed: `npx supabase functions deploy slack-set-target`

### No notifications appearing?

1. Verify `SLACK_NEW_CLIENT_WEBHOOK_URL` is set in Supabase secrets
2. Check webhook URL is correct
3. Verify channel permissions

### Updates not saving?

1. Check workspace name matches exactly (case-sensitive)
2. Use quotes for names with spaces
3. Check Supabase logs for errors

## Files

- **Sync Function:** [supabase/functions/sync-new-clients/index.ts](../supabase/functions/sync-new-clients/index.ts)
- **Slash Command Handler:** [supabase/functions/slack-set-target/index.ts](../supabase/functions/slack-set-target/index.ts)
- **Client Onboarding Guide:** [CLIENT_ONBOARDING.md](CLIENT_ONBOARDING.md)
