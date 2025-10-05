# Setting Up Automated Lead Sync

## Option 1: Supabase Cron (Recommended - Free tier compatible)

### Using Supabase Dashboard:

1. Go to [Database > Cron Jobs](https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/database/cron-jobs)

2. Create a new cron job with these settings:
   - **Name:** `hourly-lead-sync`
   - **Schedule:** `0 * * * *` (every hour at minute 0)
   - **SQL:**
   ```sql
   SELECT
     net.http_post(
       url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/scheduled-sync-leads',
       headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
       body := '{}'::jsonb
     );
   ```

### Alternative Schedule Options:
- **Every 30 minutes:** `0,30 * * * *`
- **Every 6 hours:** `0 */6 * * *`
- **Daily at 9 AM:** `0 9 * * *`

## Option 2: External Cron Service (If Supabase cron doesn't work)

### Using GitHub Actions (Free):

Create `.github/workflows/sync-leads.yml`:
```yaml
name: Sync Email Bison Leads

on:
  schedule:
    - cron: '0 * * * *'  # Every hour
  workflow_dispatch:  # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST \
            'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/scheduled-sync-leads' \
            -H 'Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}' \
            -H 'Content-Type: application/json'
```

Then add `SUPABASE_ANON_KEY` to GitHub secrets.

### Using Vercel Cron (If you deploy to Vercel):

Create `api/cron/sync-leads.ts`:
```typescript
export const config = {
  runtime: 'edge',
};

export default async function handler() {
  const response = await fetch(
    'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/scheduled-sync-leads',
    {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  return new Response(JSON.stringify(await response.json()), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
```

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/sync-leads",
    "schedule": "0 * * * *"
  }]
}
```

## Option 3: Manual Trigger Button

Add a "Sync Now" button to the portal that calls:
```bash
curl -X POST \
  'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/scheduled-sync-leads' \
  -H 'Authorization: Bearer [ANON_KEY]' \
  -H 'Content-Type: application/json'
```

## Monitoring Sync Jobs

Check sync logs in Supabase:
1. Go to [Edge Functions > scheduled-sync-leads > Logs](https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions/scheduled-sync-leads/logs)
2. View execution history and any errors

## Adding More Workspaces

Edit `supabase/functions/scheduled-sync-leads/index.ts`:
```typescript
const workspacesToSync = [
  'Kim Wallace',
  'John Roberts',      // Add new workspace
  'Danny Schwartz',    // Add new workspace
];
```

Then redeploy:
```bash
SUPABASE_ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015" \
  supabase functions deploy scheduled-sync-leads --project-ref gjqbbgrfhijescaouqkx
```
