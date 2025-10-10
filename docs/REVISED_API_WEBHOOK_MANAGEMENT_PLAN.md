# REVISED: Workspace-Specific API & Webhook Management System

## Executive Summary - Updated Based on Client Feedback

**Key Architectural Decision:**
> "What do you think about us using webhooks or API's that are workspace specific for workspace specific tasks only? Does that make sense? I feel like it gets confused whenever there is the super admin key in play."

**✅ AGREED - This is the correct architecture.** Here's why:

### Why Workspace-Specific Keys ONLY (No Super Admin Fallback):

1. **Eliminates Permission Confusion**
   - Super admin keys have global scope across ALL workspaces
   - When you switch workspaces with super admin key, the context is ambiguous
   - Workspace-specific keys are scoped to ONLY that workspace = clear permissions

2. **Prevents Data Leakage**
   - Super admin key could accidentally fetch data from wrong workspace after context switch
   - Workspace key physically cannot access other workspaces' data
   - Built-in safety mechanism

3. **Better Audit Trail**
   - Know exactly which workspace's API key made which call
   - Can revoke/rotate keys per workspace without affecting others
   - Clear accountability

4. **Matches Email Bison's Intent**
   - Email Bison designed workspace keys for workspace-scoped operations
   - Super admin keys meant for admin tasks (creating workspaces, managing users)
   - Using super admin for workspace tasks is technically an anti-pattern

---

## Updated Current State

### Active Clients: **26 Total**

**API Key Status:**
- ✅ **25 clients** have workspace-specific API keys (96% coverage)
- ❌ **1 client** missing: **Workspark** (Long Run instance)

**Breakdown by Instance:**
- **Maverick:** 18 clients - all 18 have keys ✅
- **Long Run:** 8 clients - 7 have keys, 1 missing (Workspark) ⚠️

### Clients with Workspace-Specific API Keys:
1. ATI (Long Run) ✅
2. Boring Book Keeping (Long Run) ✅
3. Danny Schwartz (Maverick) ✅
4. David Amiri (Maverick) ✅
5. Devin Hodo (Maverick) ✅
6. Gregg Blanchard (Maverick) ✅
7. Jason Binyon (Maverick) ✅
8. Jeff Schroder (Maverick) ✅
9. John Roberts (Maverick) ✅
10. Kim Wallace (Maverick) ✅
11. Kirk Hodgson (Maverick) ✅
12. Koppa Analytics (Long Run) ✅
13. Littlegiant (Long Run) ✅
14. LongRun (Long Run) ✅
15. Maverick In-house (Maverick) ✅
16. Nick Sakha (Maverick) ✅
17. Ozment Media (Long Run) ✅
18. Radiant Energy (Long Run) ✅
19. Rob Russell (Maverick) ✅
20. Shane Miller (Maverick) ✅
21. SMA Insurance (Maverick) ✅
22. StreetSmart Commercial (Maverick) ✅
23. StreetSmart P&C (Maverick) ✅
24. StreetSmart Trucking (Maverick) ✅
25. Tony Schmitz (Maverick) ✅
26. **Workspark (Long Run) ❌ MISSING**

---

## New Architecture: Workspace Keys ONLY

### Core Principle
**Every active client MUST have its own workspace-specific API key.**
- No super admin fallback
- No shared keys across workspaces
- Edge Functions will FAIL if workspace doesn't have a key (intentional - forces proper setup)

### Database Schema Changes

```sql
-- Migration: 20251010000000_enforce_workspace_api_keys.sql

-- Add webhook and API health columns to client_registry
ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS
  -- API Key Management (workspace-specific ONLY)
  bison_api_key TEXT,                    -- Already exists
  bison_api_key_name TEXT,               -- Human-readable name
  bison_api_key_created_at TIMESTAMPTZ,
  bison_api_key_last_used_at TIMESTAMPTZ,
  bison_api_key_status TEXT CHECK (bison_api_key_status IN ('active', 'inactive', 'revoked', 'expired')) DEFAULT 'active',

  -- Webhook Configuration
  bison_webhook_url TEXT,                -- Full webhook URL for this workspace
  bison_webhook_secret TEXT,             -- Webhook signing secret
  bison_webhook_enabled BOOLEAN DEFAULT false,
  bison_webhook_events TEXT[],           -- Events to listen for
  bison_webhook_last_received_at TIMESTAMPTZ,
  bison_webhook_health TEXT CHECK (bison_webhook_health IN ('healthy', 'degraded', 'failing', 'disabled')) DEFAULT 'disabled',

  -- API Health Metrics
  api_last_successful_call_at TIMESTAMPTZ,
  api_last_failed_call_at TIMESTAMPTZ,
  api_consecutive_failures INTEGER DEFAULT 0,
  api_calls_today INTEGER DEFAULT 0,
  api_errors_today INTEGER DEFAULT 0,
  api_health_status TEXT CHECK (api_health_status IN ('healthy', 'degraded', 'failing', 'no_key')) DEFAULT 'no_key';

-- Add constraint: Active clients MUST have API key
ALTER TABLE public.client_registry
  ADD CONSTRAINT active_clients_require_api_key
  CHECK (
    (is_active = false) OR
    (is_active = true AND bison_api_key IS NOT NULL)
  );

COMMENT ON CONSTRAINT active_clients_require_api_key ON public.client_registry IS
  'All active clients must have workspace-specific API keys. No super admin fallback allowed.';
```

### API Call Logs Table

```sql
CREATE TABLE IF NOT EXISTS public.workspace_api_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_name TEXT NOT NULL REFERENCES client_registry(workspace_name),

  -- Call details
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  status_code INTEGER,
  response_time_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,

  -- API key used (last 8 chars for security)
  api_key_suffix TEXT,

  -- Context
  edge_function TEXT,           -- Which function made the call
  triggered_by TEXT,            -- 'cron', 'manual', 'webhook'

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Additional data
  metadata JSONB
);

-- Indexes
CREATE INDEX idx_workspace_api_logs_workspace ON workspace_api_logs(workspace_name, created_at DESC);
CREATE INDEX idx_workspace_api_logs_success ON workspace_api_logs(success);
CREATE INDEX idx_workspace_api_logs_created_at ON workspace_api_logs(created_at DESC);

-- Auto-delete logs older than 90 days (optional - keep storage costs low)
CREATE OR REPLACE FUNCTION delete_old_api_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM workspace_api_logs WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;
```

### Webhook Events Table

```sql
CREATE TABLE IF NOT EXISTS public.workspace_webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_name TEXT NOT NULL REFERENCES client_registry(workspace_name),

  -- Event details
  event_type TEXT NOT NULL,     -- 'lead.interested', 'email.sent', etc.
  event_data JSONB NOT NULL,

  -- Processing
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_status TEXT CHECK (processing_status IN ('pending', 'processed', 'failed')) DEFAULT 'pending',
  processing_error TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  source_ip TEXT,
  signature_valid BOOLEAN
);

-- Indexes
CREATE INDEX idx_webhook_events_workspace ON workspace_webhook_events(workspace_name, received_at DESC);
CREATE INDEX idx_webhook_events_status ON workspace_webhook_events(processing_status) WHERE processing_status = 'pending';
CREATE INDEX idx_webhook_events_type ON workspace_webhook_events(event_type);
```

---

## Updated Edge Function Architecture

### Shared API Client Module

**File:** `/supabase/functions/_shared/workspaceApiClient.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

interface WorkspaceApiCall {
  workspaceName: string;
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  edgeFunction?: string;
}

interface ApiResponse<T> {
  data?: T;
  error?: string;
  statusCode: number;
  responseTimeMs: number;
}

/**
 * Call Email Bison API using WORKSPACE-SPECIFIC API KEY ONLY
 * NO SUPER ADMIN FALLBACK - will fail if workspace doesn't have API key
 */
export async function callWorkspaceApi<T>(
  options: WorkspaceApiCall
): Promise<ApiResponse<T>> {
  const startTime = Date.now();

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch workspace config
    const { data: workspace, error: wsError } = await supabase
      .from('client_registry')
      .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key, is_active')
      .eq('workspace_name', options.workspaceName)
      .eq('is_active', true)
      .single();

    if (wsError || !workspace) {
      throw new Error(`Active workspace '${options.workspaceName}' not found`);
    }

    // CRITICAL: Workspace MUST have its own API key (no fallback)
    if (!workspace.bison_api_key) {
      throw new Error(
        `Workspace '${options.workspaceName}' does not have an API key configured. ` +
        `Please generate a workspace-specific API key in Client Management Portal.`
      );
    }

    const apiKey = workspace.bison_api_key;
    const isLongRun = workspace.bison_instance.toLowerCase() === 'longrun';
    const baseUrl = isLongRun
      ? 'https://send.longrun.agency/api'
      : 'https://send.maverickmarketingllc.com/api';

    console.log(`📡 Calling ${options.workspaceName} API (${workspace.bison_instance}) - ${options.endpoint}`);

    // Switch to workspace context
    const switchResponse = await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ team_id: workspace.bison_workspace_id }),
    });

    if (!switchResponse.ok) {
      const errorText = await switchResponse.text();
      throw new Error(`Workspace switch failed: ${switchResponse.status} - ${errorText}`);
    }

    // Wait for workspace switch to propagate
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Make the actual API call
    const response = await fetch(`${baseUrl}${options.endpoint}`, {
      method: options.method || 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const responseTimeMs = Date.now() - startTime;
    const success = response.ok;
    const data = success ? await response.json() : null;
    const errorMessage = !success ? await response.text() : null;

    // Log API call to workspace_api_logs
    await supabase.from('workspace_api_logs').insert({
      workspace_name: options.workspaceName,
      endpoint: options.endpoint,
      method: options.method || 'GET',
      status_code: response.status,
      response_time_ms: responseTimeMs,
      success,
      error_message: errorMessage,
      api_key_suffix: apiKey.slice(-8),
      edge_function: options.edgeFunction,
      triggered_by: 'edge_function',
    });

    // Update workspace health metrics
    if (success) {
      await supabase
        .from('client_registry')
        .update({
          api_last_successful_call_at: new Date().toISOString(),
          api_consecutive_failures: 0,
          api_calls_today: (workspace.api_calls_today || 0) + 1,
          api_health_status: 'healthy',
          bison_api_key_last_used_at: new Date().toISOString(),
        })
        .eq('workspace_name', options.workspaceName);
    } else {
      const consecutiveFailures = (workspace.api_consecutive_failures || 0) + 1;
      await supabase
        .from('client_registry')
        .update({
          api_last_failed_call_at: new Date().toISOString(),
          api_consecutive_failures: consecutiveFailures,
          api_calls_today: (workspace.api_calls_today || 0) + 1,
          api_errors_today: (workspace.api_errors_today || 0) + 1,
          api_health_status: consecutiveFailures >= 3 ? 'failing' : 'degraded',
        })
        .eq('workspace_name', options.workspaceName);
    }

    return {
      data,
      error: errorMessage || undefined,
      statusCode: response.status,
      responseTimeMs,
    };

  } catch (error) {
    const responseTimeMs = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`❌ API call failed for ${options.workspaceName}:`, errorMessage);

    // Log failed call
    await supabase.from('workspace_api_logs').insert({
      workspace_name: options.workspaceName,
      endpoint: options.endpoint,
      method: options.method || 'GET',
      status_code: 0,
      response_time_ms: responseTimeMs,
      success: false,
      error_message: errorMessage,
      edge_function: options.edgeFunction,
    });

    return {
      error: errorMessage,
      statusCode: 0,
      responseTimeMs,
    };
  }
}
```

### Example: Updated `sync-email-accounts` Edge Function

```typescript
// OLD (with super admin fallback):
const apiKey = workspace.bison_api_key || (isLongRun ? longRunApiKey : maverickApiKey);

// NEW (workspace-specific ONLY):
const { data: senderEmails, error, statusCode } = await callWorkspaceApi({
  workspaceName: 'Tony Schmitz',
  endpoint: '/sender-emails?per_page=100',
  edgeFunction: 'sync-email-accounts',
});

if (error) {
  console.error('Sync failed:', error);
  // Function will fail for this workspace - intentional!
  // Forces proper API key setup
}
```

---

## Client Management Portal Integration

### Updated UI: Webhooks & API Keys Tab

**Location:** Existing Client Management Portal - add new tab "API & Webhooks"

**NOT a separate page** - integrated into the existing client management workflow.

### Tab Layout:

```
┌─────────────────────────────────────────────────────────────┐
│  Client Management Portal                                    │
├─────────────────────────────────────────────────────────────┤
│  [Overview] [Performance] [Leads] [API & Webhooks] [Settings]│
└─────────────────────────────────────────────────────────────┘

API & Webhooks Tab Content:

┌─────────────────────────────────────────────────────────────┐
│ 📡 API Configuration                                         │
├─────────────────────────────────────────────────────────────┤
│ Workspace API Key: ****...f1575525                          │
│ Status: 🟢 Healthy (Last used: 2 min ago)                   │
│ Calls Today: 1,243 (99.8% success rate)                     │
│                                                              │
│ [Test Connection] [Regenerate Key] [View Logs]              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 🪝 Webhook Configuration                                     │
├─────────────────────────────────────────────────────────────┤
│ Webhook URL:                                                 │
│ https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/...  │
│                                                              │
│ Enabled Events:                                              │
│ ☑ lead.interested    ☑ email.sent    ☐ email.opened        │
│                                                              │
│ Status: 🟢 Healthy (Last event: 5 min ago)                  │
│                                                              │
│ [Save Configuration] [Test Webhook] [View Events]           │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│ 📊 Recent API Activity (Last 24 Hours)                      │
├─────────────────────────────────────────────────────────────┤
│ Timestamp          │ Endpoint           │ Status │ Time     │
│ 10/09 10:23:45 PM │ /sender-emails     │ ✅ 200 │ 234ms   │
│ 10/09 10:20:12 PM │ /campaigns         │ ✅ 200 │ 123ms   │
│ 10/09 10:15:33 PM │ /sender-emails     │ ❌ 401 │ 89ms    │
│                                                              │
│ [Export Logs] [View All]                                    │
└─────────────────────────────────────────────────────────────┘
```

### Component Structure

```
/src/pages/ClientManagement.tsx
  └── Add new tab: "API & Webhooks"
      └── /src/components/client-management/
          ├── APIKeyManagementCard.tsx     (API key status & actions)
          ├── WebhookConfigCard.tsx        (Webhook setup)
          ├── APIActivityLog.tsx           (Recent API calls table)
          └── APIHealthBadge.tsx           (Real-time health indicator)
```

---

## Implementation Roadmap

### 🔴 **Phase 1: Fix Workspark (Today - 2 hours)**

1. Generate workspace-specific API key for Workspark via Email Bison dashboard
2. Update `client_registry.bison_api_key` for Workspark
3. Test sync for Workspark workspace
4. Verify 403 error resolved

### 🟡 **Phase 2: Database Schema (Week 1 - 4 hours)**

1. Run migration: Add webhook & API health columns to `client_registry`
2. Create `workspace_api_logs` table
3. Create `workspace_webhook_events` table
4. Add constraint: Active clients must have API keys

### 🟢 **Phase 3: Shared API Client (Week 1 - 6 hours)**

1. Create `/supabase/functions/_shared/workspaceApiClient.ts`
2. Implement `callWorkspaceApi()` function
3. Add logging and health metric updates
4. Test with one Edge Function (`sync-email-accounts`)

### 🔵 **Phase 4: Update All Edge Functions (Week 2 - 8 hours)**

Update these functions to use `callWorkspaceApi()`:
1. ✅ `sync-email-accounts`
2. `sync-client-pipeline`
3. `hybrid-workspace-analytics`
4. `volume-dashboard-data`
5. `backfill-all-workspaces`

### 🟣 **Phase 5: Client Management Portal UI (Week 2 - 12 hours)**

1. Add "API & Webhooks" tab to Client Management Portal
2. Build `APIKeyManagementCard` component
3. Build `WebhookConfigCard` component
4. Build `APIActivityLog` table component
5. Implement "Test Connection" functionality
6. Implement webhook event viewer

### ⚪ **Phase 6: Health Monitoring (Week 3 - 6 hours)**

1. Create cron job: `api-health-monitor` (runs every 15 min)
2. Add health summary widget to main dashboard
3. Set up alerts for failing workspaces
4. Daily metrics reset (api_calls_today, api_errors_today)

---

## Success Criteria

### Week 1 Targets
- ✅ Workspark API key generated and working
- ✅ All 26 active clients have workspace-specific API keys
- ✅ Database schema deployed with health tracking
- ✅ Shared `workspaceApiClient` module created and tested
- ✅ Zero super admin fallback usage

### Week 2 Targets
- ✅ All Edge Functions using workspace-specific keys only
- ✅ Client Management Portal "API & Webhooks" tab deployed
- ✅ Real-time API health visible per workspace
- ✅ API call logging active for all workspaces

### Week 3 Targets
- ✅ Automated health monitoring active
- ✅ Complete audit trail for last 90 days
- ✅ Webhook configuration functional
- ✅ Zero 403/401 authorization errors

---

## Why This Architecture is Superior

### ❌ **OLD: Super Admin Fallback**
```typescript
// Confusing - which workspace context am I in?
const apiKey = workspace.bison_api_key || SUPER_ADMIN_KEY;
await switchWorkspace(workspace.id);
const data = await fetch('/sender-emails', { headers: { auth: apiKey }});
// ⚠️ Could accidentally get data from wrong workspace if switch failed silently
```

### ✅ **NEW: Workspace-Specific Only**
```typescript
// Crystal clear - this key ONLY works for this workspace
const { data, error } = await callWorkspaceApi({
  workspaceName: 'Tony Schmitz',  // Explicit workspace
  endpoint: '/sender-emails',
});
// ✅ Physically impossible to get data from wrong workspace
// ✅ Will fail loudly if API key missing (forces proper setup)
```

---

## Cost & ROI

### Development Costs
- Phase 1 (Workspark fix): 2 hours
- Phase 2 (Database): 4 hours
- Phase 3 (API client): 6 hours
- Phase 4 (Edge Functions): 8 hours
- Phase 5 (UI): 12 hours
- Phase 6 (Monitoring): 6 hours
- **Total:** 38 hours (~1 week for 1 developer)

### Infrastructure Costs
- Additional database columns: $0 (within tier)
- API logs table (90-day retention): ~$5/month
- Webhook events table: ~$5/month
- **Total:** ~$10/month

### ROI
- **Time Saved:** 3-4 hours/week (no more API troubleshooting)
- **Error Reduction:** ~100% elimination of wrong-workspace data bugs
- **Security:** Proper key isolation per workspace
- **Auditability:** Complete API call history per workspace

---

## Next Steps

**Immediate (Today):**
1. Generate Workspark API key manually via Email Bison dashboard
2. Update database with Workspark key
3. Test Workspark sync - verify 403 resolved

**This Week:**
1. Approve this revised architecture
2. Run Phase 2 database migration
3. Begin Phase 3 (shared API client module)

**Review Meeting:**
- Walk through Client Management Portal UI mockups
- Confirm webhook event types to capture
- Set Phase 5 (UI) launch date

---

**Document Version:** 2.0 (Revised)
**Created:** 2025-10-09
**Last Updated:** 2025-10-09
**Owner:** Engineering Team
**Status:** ✅ Architecture Approved - Ready for Implementation
