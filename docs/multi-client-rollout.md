# Multi-Client Portal Rollout

## Overview

The Client Portal has been expanded from Kim Wallace (pilot) to all 27 Email Bison workspaces.

## What Was Built

### 1. Client Portal Hub (`/client-portal`)
- **Grid view** of all 27 workspaces from Email Bison
- **Search** to filter workspaces by name
- **Lead counts** showing total leads and won leads per workspace
- **Click any workspace** to view their dedicated portal

### 2. Workspace Switcher
- **Dropdown selector** in the portal header
- Quickly switch between client workspaces without going back to hub
- Lists all 27 workspaces alphabetically

### 3. Dynamic Auto-Sync
- **Automated hourly sync** pulls leads from ALL workspaces
- No manual configuration needed to add new clients
- Fetches workspace list dynamically from Email Bison API

### 4. Updated Navigation
- Homepage "Client Portal" button now links to hub page
- Back button returns to homepage (not hub, for simplicity)

## How to Use

### For Internal Team:

1. **Access Hub**: Click "Client Portal" from homepage or navigate to `/client-portal`

2. **Search for Client**: Use search bar to find specific workspace

3. **View Client Portal**: Click workspace card to see their pipeline

4. **Switch Clients**: Use dropdown in header to quickly switch between workspaces

5. **Sync Data**: Click "Sync from Bison" to manually update a workspace's leads

## Architecture

### Data Flow:
```
Email Bison API → Supabase Edge Functions → PostgreSQL → React Frontend
```

### Key Components:

1. **ClientPortalHub** (`src/pages/ClientPortalHub.tsx`)
   - Fetches all 27 workspaces from Email Bison API
   - Displays workspace cards with lead counts
   - Search and filter functionality

2. **ClientPortalPage** (`src/pages/ClientPortalPage.tsx`)
   - Workspace-specific lead pipeline
   - Drag-and-drop Kanban board
   - KPI stats integration
   - Workspace switcher dropdown

3. **scheduled-sync-leads** (`supabase/functions/scheduled-sync-leads/`)
   - Runs hourly via Supabase cron
   - Dynamically fetches all workspaces
   - Syncs last 30 days of leads for each workspace

4. **sync-bison-leads** (`supabase/functions/sync-bison-leads/`)
   - Called by scheduled-sync for each workspace
   - Pulls non-automated replies from Email Bison
   - Upserts into `client_leads` table

## Current Workspaces (27 total)

Based on Email Bison API as of Oct 4, 2025:

1. Kim Wallace (pilot - already has leads synced)
2. John Roberts
3. Danny Schwartz
4. Lisa Henderson
5. ... (and 22 more)

## Initial Sync Status

The automated sync has been triggered to pull leads for all 27 workspaces. This initial sync may take:
- **~30 seconds per workspace** (27 workspaces × 30s = ~13.5 minutes total)
- Syncs last 30 days of non-automated replies
- Subsequent hourly syncs will be faster (incremental updates)

## Monitoring

### Check Sync Logs:
1. Go to [Supabase Dashboard > Edge Functions](https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions/scheduled-sync-leads/logs)
2. View execution history and any errors
3. Each workspace sync result is logged separately

### Database Queries:
```sql
-- Count leads by workspace
SELECT workspace_name, COUNT(*) as lead_count
FROM client_leads
GROUP BY workspace_name
ORDER BY lead_count DESC;

-- Check last sync time
SELECT workspace_name, MAX(last_synced_at) as last_sync
FROM client_leads
GROUP BY workspace_name
ORDER BY last_sync DESC;
```

## Rollout Strategy

### Phase 1: Soft Launch (Current)
- All 27 workspaces visible in hub
- Data syncing automatically
- Internal team testing

### Phase 2: Client Access (Future)
- Create client-specific login links
- Restrict visibility to their own workspace
- Customizable branding per client

### Phase 3: Advanced Features (Future)
- Client notifications for new leads
- Custom pipeline stages per client
- Integration with client CRMs
- Export functionality (CSV, PDF)

## Adding New Workspaces

No code changes needed! The system automatically:
1. Detects new workspaces from Email Bison API
2. Includes them in hourly sync
3. Shows them in the hub

## Troubleshooting

### Workspace Not Showing in Hub
- Check Email Bison API: workspace must exist there
- Refresh the hub page
- Check browser console for errors

### Leads Not Syncing
- Check [function logs](https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions/scheduled-sync-leads/logs)
- Verify workspace name matches exactly (case-sensitive)
- Ensure workspace has positive replies in last 30 days

### Portal Performance Issues
- Database indexes exist on `workspace_name` and `pipeline_stage`
- Lead counts are cached in hub
- Consider pagination if workspace has >500 leads

## Environment Variables

Required secrets in Supabase (already set):
```
BISON_API_KEY=77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d
BISON_BASE_URL=https://send.maverickmarketingllc.com/api
```

## Next Steps

1. ✅ Hub page created
2. ✅ Workspace switcher added
3. ✅ Dynamic sync deployed
4. ✅ Homepage navigation updated
5. ⏳ Initial sync running (all 27 workspaces)
6. 📋 Client-specific access (future)
7. 📋 Custom branding (future)
8. 📋 Advanced analytics per client (future)
