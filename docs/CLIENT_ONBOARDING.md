# Automatic Client Onboarding

This document explains how new Email Bison clients are automatically added to the volume reporting system.

## How It Works

When a new workspace is created in Email Bison, it needs to be added to the `client_registry` table to appear in:
- Volume Dashboard
- Daily Slack notifications
- KPI tracking

## Automatic Sync Options

### Option 1: Manual Trigger (Current Setup)

**When to use:** When you want control over when new clients are added.

**How to run:**

```bash
# Via script (local)
node scripts/sync-new-clients.mjs

# Via Edge Function (deployed)
curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-new-clients" \
  -H "Authorization: Bearer YOUR_SUPABASE_KEY"
```

**What it does:**
1. Fetches all workspaces from Email Bison
2. Compares with `client_registry` table
3. Adds any new workspaces with default settings:
   - `workspace_id`: Email Bison workspace ID
   - `workspace_name`: Email Bison workspace name
   - `display_name`: Same as workspace name (can be updated later)
   - `monthly_sending_target`: 0 (⚠️ needs manual update)
   - `is_active`: true

### Option 2: Scheduled Sync (Recommended)

**Setup with GitHub Actions:**

Create `.github/workflows/sync-clients.yml`:

```yaml
name: Sync New Email Bison Clients

on:
  schedule:
    # Runs daily at 9 AM UTC
    - cron: '0 9 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Sync new clients
        run: |
          curl -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/sync-new-clients" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}"
```

**Setup with Supabase Cron (Database Trigger):**

```sql
-- Create pg_cron extension (if not exists)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily sync at 9 AM
SELECT cron.schedule(
  'sync-new-clients-daily',
  '0 9 * * *',
  $$
  SELECT net.http_post(
    url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-new-clients',
    headers := '{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  );
  $$
);
```

### Option 3: Webhook (Real-time)

**If Email Bison supports webhooks**, set up a webhook to call:
```
POST https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-new-clients
```

## After a New Client is Added

### Step 1: Set Monthly Sending Target

New clients default to `monthly_sending_target = 0`, which excludes them from reports.

**Update via SQL:**
```sql
UPDATE client_registry
SET monthly_sending_target = 45500
WHERE workspace_name = 'New Client Name';
```

**Or update via Dashboard UI** (if you add a settings page)

### Step 2: Verify in Reports

After setting the target > 0:
1. Check Volume Dashboard - client should appear
2. Test Slack notification - client should be included
3. Verify data is pulling from Email Bison correctly

## Client Registry Schema

```typescript
{
  workspace_id: number;           // Email Bison workspace ID
  workspace_name: string;         // Email Bison workspace name (unique)
  display_name: string;           // Friendly name for UI
  monthly_sending_target: number; // Target emails/month (0 = excluded)
  is_active: boolean;             // Include in reports
  airtable_workspace_name: string; // Legacy field
  airtable_record_id: string;     // Legacy field
  created_at: timestamp;
  updated_at: timestamp;
}
```

## Troubleshooting

### Client not appearing in reports?

1. Check `monthly_sending_target` > 0
2. Check `is_active = true`
3. Verify workspace exists in Email Bison
4. Check workspace name matches exactly

### Sync not working?

1. Test manually: `curl https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-new-clients`
2. Check function logs in Supabase dashboard
3. Verify EMAIL_BISON_API_KEY is set correctly

## Files

- **Sync Script:** [scripts/sync-new-clients.mjs](../scripts/sync-new-clients.mjs)
- **Edge Function:** [supabase/functions/sync-new-clients/index.ts](../supabase/functions/sync-new-clients/index.ts)
- **Volume Function:** [supabase/functions/send-volume-slack-dm/index.ts](../supabase/functions/send-volume-slack-dm/index.ts)
