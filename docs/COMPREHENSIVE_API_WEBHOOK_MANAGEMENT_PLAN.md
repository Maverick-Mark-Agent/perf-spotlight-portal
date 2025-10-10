# Comprehensive API Key & Webhook Management System

## Executive Summary

**Problem Identified:**
- **Tony Schmitz showed 403 accounts in sync but actually has 282** (data in email_accounts_raw is correct, sync result was wrong)
- 35 total workspaces, but only 19 have API keys (54% coverage)
- Workspark workspace failed with 403 Unauthorized (needs workspace-specific API access)
- Currently using global Super Admin keys as fallback - this causes permission errors
- No visibility or management interface for API keys in Client Management Portal
- No webhook health monitoring or validation system

**Business Impact:**
- Inaccurate data sync leads to billing discrepancies
- Cannot track API health per client
- No audit trail for API usage
- Manual API key management is error-prone
- Future client onboarding requires manual API key setup

---

## Current State Analysis

### 1. API Key Coverage Status

| Instance | Total Workspaces | With API Keys | Without API Keys | Coverage % |
|----------|------------------|---------------|------------------|------------|
| Maverick | 24 | 13 | 11 | 54% |
| Long Run | 11 | 6 | 5 | 55% |
| **TOTAL** | **35** | **19** | **16** | **54%** |

### 2. Workspaces Without API Keys

**Maverick Instance:**
1. ApolloTechné (workspace_id: 13)
2. biz power benifits (workspace_id: 18)
3. Maison Energy (workspace_id: 10)
4. Rick Huemmer (workspace_id: 27)
5. ROSSMANN (workspace_id: 11)
6. SAVANTY (workspace_id: 5)
7. Small biz Heroes (workspace_id: 15)
8. StreetSmart P&C (workspace_id: 22)
9. StreetSmart Trucking (workspace_id: 9)
10. Test Rob Russell (workspace_id: 46)
11. Thomas's Team (workspace_id: 2)

**Long Run Instance:**
1. Workspark (workspace_id: 14) - **CRITICAL: 403 error**
2. 4 others (need verification)

### 3. Current Fallback Mechanism

All Edge Functions currently use this pattern:
```typescript
// Falls back to global Super Admin key if workspace doesn't have its own
const apiKey = workspace.bison_api_key || (isLongRun ? longRunApiKey : maverickApiKey);
```

**Global API Keys:**
- Maverick Super Admin: `77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d`
- Long Run Super Admin: `32|MiBV8URxMy8jnGZUq5SVBD5V0jaPbwKmtime9YXxca69e009`

**Problem:** Global keys work for most workspaces but fail with 403 errors for workspaces requiring workspace-specific permissions (like Workspark).

---

## Proposed Solution Architecture

### Phase 1: Database Schema Enhancement (Week 1)

#### 1.1 Add API Credential Columns to `client_registry`

```sql
-- Migration: 20251010000000_add_api_credential_management.sql

ALTER TABLE public.client_registry ADD COLUMN IF NOT EXISTS
  bison_api_key TEXT,  -- Already exists

  -- New columns for comprehensive API management
  bison_api_key_name TEXT,           -- Human-readable name (e.g., "Workspark Workspace API")
  bison_api_key_type TEXT CHECK (bison_api_key_type IN ('workspace', 'super_admin', 'team')),
  bison_api_key_scopes TEXT[],       -- Array of permission scopes
  bison_api_key_created_at TIMESTAMPTZ,
  bison_api_key_expires_at TIMESTAMPTZ,
  bison_api_key_last_used_at TIMESTAMPTZ,
  bison_api_key_status TEXT CHECK (bison_api_key_status IN ('active', 'inactive', 'revoked', 'expired')) DEFAULT 'active',

  -- Webhook configuration
  bison_webhook_url TEXT,            -- Full webhook URL for this workspace
  bison_webhook_secret TEXT,         -- Webhook signing secret
  bison_webhook_enabled BOOLEAN DEFAULT false,
  bison_webhook_events TEXT[],       -- Events to listen for (e.g., ['lead.interested', 'email.sent'])
  bison_webhook_last_received_at TIMESTAMPTZ,
  bison_webhook_failure_count INTEGER DEFAULT 0,
  bison_webhook_status TEXT CHECK (bison_webhook_status IN ('healthy', 'degraded', 'failing', 'disabled')) DEFAULT 'disabled',

  -- API Health Metrics
  api_last_successful_call_at TIMESTAMPTZ,
  api_last_failed_call_at TIMESTAMPTZ,
  api_consecutive_failures INTEGER DEFAULT 0,
  api_total_calls_today INTEGER DEFAULT 0,
  api_total_errors_today INTEGER DEFAULT 0,
  api_health_status TEXT CHECK (api_health_status IN ('healthy', 'degraded', 'failing', 'unknown')) DEFAULT 'unknown',

  -- Metadata
  api_notes TEXT,                    -- Internal notes about API setup
  requires_workspace_key BOOLEAN DEFAULT false; -- Flag if workspace REQUIRES its own key (not super admin)
```

#### 1.2 Create API Audit Log Table

```sql
CREATE TABLE IF NOT EXISTS public.api_call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_name TEXT NOT NULL REFERENCES client_registry(workspace_name),
  bison_instance TEXT NOT NULL,

  -- Call details
  endpoint TEXT NOT NULL,            -- e.g., "/api/sender-emails"
  method TEXT NOT NULL,              -- GET, POST, etc.
  api_key_used TEXT,                 -- Last 8 chars of API key
  api_key_type TEXT,                 -- workspace, super_admin, team

  -- Response
  status_code INTEGER,
  response_time_ms INTEGER,
  success BOOLEAN,
  error_message TEXT,

  -- Context
  function_name TEXT,                -- Which Edge Function made the call
  triggered_by TEXT,                 -- cron, manual, webhook

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB                     -- Additional context
);

-- Indexes for performance
CREATE INDEX idx_api_logs_workspace ON api_call_logs(workspace_name);
CREATE INDEX idx_api_logs_created_at ON api_call_logs(created_at DESC);
CREATE INDEX idx_api_logs_success ON api_call_logs(success);
CREATE INDEX idx_api_logs_workspace_date ON api_call_logs(workspace_name, created_at DESC);
```

#### 1.3 Create Webhook Event Log Table

```sql
CREATE TABLE IF NOT EXISTS public.webhook_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_name TEXT NOT NULL REFERENCES client_registry(workspace_name),

  -- Event details
  event_type TEXT NOT NULL,          -- lead.interested, email.sent, etc.
  event_data JSONB NOT NULL,         -- Full webhook payload
  event_signature TEXT,              -- Webhook signature for verification

  -- Processing
  received_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  processing_status TEXT CHECK (processing_status IN ('pending', 'processed', 'failed', 'ignored')),
  processing_error TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  source_ip TEXT,
  user_agent TEXT,
  metadata JSONB
);

-- Indexes
CREATE INDEX idx_webhook_events_workspace ON webhook_events(workspace_name);
CREATE INDEX idx_webhook_events_received_at ON webhook_events(received_at DESC);
CREATE INDEX idx_webhook_events_status ON webhook_events(processing_status);
CREATE INDEX idx_webhook_events_type ON webhook_events(event_type);
```

---

### Phase 2: Client Management Portal UI (Week 2)

#### 2.1 API & Webhook Management Dashboard

**New Page:** `/client-management/api-webhooks`

**Features:**
1. **API Key Management Panel**
   - Display all workspaces with API key status (green=active, yellow=fallback, red=missing/failed)
   - Add/Edit/Revoke API keys per workspace
   - Test API key validity with "Test Connection" button
   - Show last successful API call timestamp
   - Display API health status (healthy/degraded/failing)

2. **Webhook Configuration Panel**
   - Enable/disable webhooks per workspace
   - Configure webhook URL and events
   - View webhook delivery status
   - Webhook secret management
   - Test webhook with sample payload

3. **API Health Monitoring**
   - Real-time health status per workspace
   - API call success rate (last 24h)
   - Response time charts
   - Error rate alerts
   - Consecutive failure count

4. **Audit Logs Viewer**
   - Searchable API call history
   - Filter by workspace, status, date range
   - Export logs to CSV
   - View detailed error messages

#### 2.2 Component Structure

```
/src/pages/ClientManagementAPIWebhooks.tsx          (Main page)
├── /src/components/api-management/
│   ├── APIKeyCard.tsx                              (Single workspace API key card)
│   ├── APIKeyForm.tsx                              (Add/edit API key form)
│   ├── APIKeyTestButton.tsx                        (Test API connection)
│   ├── APIHealthIndicator.tsx                      (Health status badge)
│   ├── APICallLogsTable.tsx                        (Audit log table)
│   ├── WebhookConfigForm.tsx                       (Webhook settings)
│   ├── WebhookHealthCard.tsx                       (Webhook delivery status)
│   ├── WebhookEventViewer.tsx                      (View webhook events)
│   └── BulkAPIKeyImport.tsx                        (CSV import for bulk setup)
```

#### 2.3 UI Mockup Description

**Layout:**
- Top navigation tabs: "API Keys" | "Webhooks" | "Audit Logs" | "Health Dashboard"
- Left sidebar: Filter by instance (Maverick/Long Run), status, health
- Main content: Grid of workspace cards or table view (toggle)

**Workspace Card Example:**
```
┌─────────────────────────────────────────────────┐
│ 🟢 Tony Schmitz                  [Maverick]     │
├─────────────────────────────────────────────────┤
│ API Key: ****...f1575525 (Workspace Key)        │
│ Status: Healthy ✓                               │
│ Last Used: 2 minutes ago                        │
│ Calls Today: 1,243 (99.8% success)              │
│                                                  │
│ Webhook: Enabled ✓                              │
│ Events: lead.interested, email.sent             │
│ Last Event: 5 minutes ago                       │
│                                                  │
│ [Edit API Key] [Test Connection] [View Logs]    │
└─────────────────────────────────────────────────┘
```

---

### Phase 3: Edge Function Updates (Week 2-3)

#### 3.1 Create Shared API Client Module

**File:** `/supabase/functions/_shared/bisonApiClient.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

interface BisonApiOptions {
  workspaceName: string;
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  functionName?: string;
}

interface BisonApiResponse<T> {
  data?: T;
  error?: string;
  statusCode: number;
  responseTime: number;
}

/**
 * Centralized Email Bison API client with logging and error handling
 */
export async function callBisonApi<T>(
  options: BisonApiOptions
): Promise<BisonApiResponse<T>> {
  const startTime = Date.now();

  // Get Supabase client
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Fetch workspace config from client_registry
    const { data: workspace, error: wsError } = await supabase
      .from('client_registry')
      .select('workspace_name, bison_workspace_id, bison_instance, bison_api_key, bison_api_key_type, requires_workspace_key')
      .eq('workspace_name', options.workspaceName)
      .single();

    if (wsError || !workspace) {
      throw new Error(`Workspace '${options.workspaceName}' not found`);
    }

    // Determine which API key to use
    const maverickSuperAdmin = Deno.env.get('MAVERICK_BISON_API_KEY');
    const longRunSuperAdmin = Deno.env.get('LONG_RUN_BISON_API_KEY');

    const isLongRun = workspace.bison_instance.toLowerCase() === 'longrun';
    const baseUrl = isLongRun
      ? 'https://send.longrun.agency/api'
      : 'https://send.maverickmarketingllc.com/api';

    let apiKey: string;
    let apiKeyType: string;

    if (workspace.requires_workspace_key && !workspace.bison_api_key) {
      // Critical error: workspace REQUIRES its own key but doesn't have one
      throw new Error(`Workspace '${options.workspaceName}' requires workspace-specific API key but none configured`);
    }

    if (workspace.bison_api_key) {
      apiKey = workspace.bison_api_key;
      apiKeyType = workspace.bison_api_key_type || 'workspace';
    } else {
      // Fallback to super admin
      apiKey = isLongRun ? longRunSuperAdmin! : maverickSuperAdmin!;
      apiKeyType = 'super_admin';

      console.log(`⚠️ Using ${isLongRun ? 'Long Run' : 'Maverick'} super admin key for ${options.workspaceName} (no workspace key configured)`);
    }

    // Switch to workspace if not already there
    await fetch(`${baseUrl}/workspaces/v1.1/switch-workspace`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ team_id: workspace.bison_workspace_id }),
    });

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

    const responseTime = Date.now() - startTime;
    const success = response.ok;
    const data = response.ok ? await response.json() : null;
    const errorMessage = !response.ok ? await response.text() : null;

    // Log API call
    await supabase.from('api_call_logs').insert({
      workspace_name: options.workspaceName,
      bison_instance: workspace.bison_instance,
      endpoint: options.endpoint,
      method: options.method || 'GET',
      api_key_used: apiKey.slice(-8),
      api_key_type: apiKeyType,
      status_code: response.status,
      response_time_ms: responseTime,
      success,
      error_message: errorMessage,
      function_name: options.functionName,
      triggered_by: 'edge_function',
    });

    // Update workspace API health metrics
    if (success) {
      await supabase
        .from('client_registry')
        .update({
          api_last_successful_call_at: new Date().toISOString(),
          api_consecutive_failures: 0,
          api_total_calls_today: workspace.api_total_calls_today + 1,
          api_health_status: 'healthy',
          bison_api_key_last_used_at: new Date().toISOString(),
        })
        .eq('workspace_name', options.workspaceName);
    } else {
      await supabase
        .from('client_registry')
        .update({
          api_last_failed_call_at: new Date().toISOString(),
          api_consecutive_failures: (workspace.api_consecutive_failures || 0) + 1,
          api_total_calls_today: workspace.api_total_calls_today + 1,
          api_total_errors_today: workspace.api_total_errors_today + 1,
          api_health_status: (workspace.api_consecutive_failures || 0) >= 3 ? 'failing' : 'degraded',
        })
        .eq('workspace_name', options.workspaceName);
    }

    return {
      data,
      error: errorMessage || undefined,
      statusCode: response.status,
      responseTime,
    };

  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Log failed call
    await supabase.from('api_call_logs').insert({
      workspace_name: options.workspaceName,
      bison_instance: 'unknown',
      endpoint: options.endpoint,
      method: options.method || 'GET',
      status_code: 0,
      response_time_ms: responseTime,
      success: false,
      error_message: errorMessage,
      function_name: options.functionName,
    });

    return {
      error: errorMessage,
      statusCode: 0,
      responseTime,
    };
  }
}
```

#### 3.2 Update All Edge Functions

**Update these functions to use the new `bisonApiClient`:**
1. `sync-email-accounts`
2. `sync-client-pipeline`
3. `hybrid-workspace-analytics`
4. `volume-dashboard-data`
5. `backfill-all-workspaces`
6. Any other functions making Email Bison API calls

**Example migration:**
```typescript
// OLD
const response = await fetch(`${baseUrl}/sender-emails`, {
  headers: { 'Authorization': `Bearer ${apiKey}` },
});

// NEW
const { data, error, statusCode } = await callBisonApi({
  workspaceName: 'Tony Schmitz',
  endpoint: '/sender-emails?per_page=100',
  functionName: 'sync-email-accounts',
});

if (error) {
  console.error('API call failed:', error);
  // Handle error
}
```

---

### Phase 4: API Key Generation & Onboarding (Week 3-4)

#### 4.1 Create Edge Function: `generate-workspace-api-key`

**Purpose:** Automatically generate workspace-specific API keys via Email Bison API

```typescript
/**
 * Generate workspace-specific API key via Email Bison API
 *
 * POST /functions/v1/generate-workspace-api-key
 * Body: { "workspace_name": "Tony Schmitz" }
 *
 * Returns: { api_key: "123|abc...", key_name: "Tony Schmitz Workspace API", scopes: [...] }
 */
```

#### 4.2 Create Edge Function: `validate-api-key`

**Purpose:** Test if an API key works and return its permissions/scopes

```typescript
/**
 * Validate API key by making test call to Email Bison
 *
 * POST /functions/v1/validate-api-key
 * Body: { "workspace_name": "Tony Schmitz", "api_key": "123|abc..." }
 *
 * Returns: { valid: true, scopes: [...], workspace_access: [...] }
 */
```

#### 4.3 Create Client Onboarding Checklist

**New table:** `client_onboarding_checklist`

```sql
CREATE TABLE public.client_onboarding_checklist (
  workspace_name TEXT PRIMARY KEY REFERENCES client_registry(workspace_name),

  -- API Setup
  api_key_generated BOOLEAN DEFAULT false,
  api_key_tested BOOLEAN DEFAULT false,
  api_key_validated_at TIMESTAMPTZ,

  -- Webhook Setup
  webhook_url_configured BOOLEAN DEFAULT false,
  webhook_secret_generated BOOLEAN DEFAULT false,
  webhook_tested BOOLEAN DEFAULT false,
  webhook_validated_at TIMESTAMPTZ,

  -- Data Sync
  initial_sync_completed BOOLEAN DEFAULT false,
  initial_sync_completed_at TIMESTAMPTZ,

  -- Onboarding Status
  onboarding_status TEXT CHECK (onboarding_status IN ('not_started', 'in_progress', 'completed', 'blocked')) DEFAULT 'not_started',
  onboarding_completed_at TIMESTAMPTZ,
  onboarding_notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

### Phase 5: Health Monitoring & Alerts (Week 4)

#### 5.1 Create Edge Function: `api-health-monitor`

**Cron Schedule:** Every 15 minutes

**Purpose:**
1. Check API health for all workspaces
2. Detect degraded/failing workspaces
3. Send alerts for consecutive failures
4. Reset daily counters at midnight

#### 5.2 Create Dashboard Widget: API Health Summary

**Location:** Main dashboard home page

**Display:**
- Total workspaces: 35
- Healthy: 32 (91%)
- Degraded: 2 (6%)
- Failing: 1 (3%)
- Click to view details

---

## Implementation Priority

### 🔴 **CRITICAL (Week 1)**
1. Add `requires_workspace_key` flag to `client_registry` for Workspark
2. Fix Workspark 403 error by generating workspace-specific API key
3. Create API call logging infrastructure
4. Deploy Tony Schmitz account count fix

### 🟡 **HIGH (Week 2)**
1. Complete database schema migration
2. Build Client Management Portal UI for API key management
3. Create shared `bisonApiClient` module
4. Update critical Edge Functions (sync-email-accounts, sync-client-pipeline)

### 🟢 **MEDIUM (Week 3)**
1. Generate API keys for all 16 workspaces missing them
2. Implement webhook configuration UI
3. Build audit log viewer
4. Create API validation Edge Function

### 🔵 **LOW (Week 4)**
1. Health monitoring dashboard
2. Automated alerts
3. Onboarding checklist automation
4. Documentation and training materials

---

## Success Metrics

### Week 1 Targets
- ✅ Workspark 403 error resolved
- ✅ API key coverage: 100% (35/35 workspaces)
- ✅ API call logging active for all workspaces

### Week 2 Targets
- ✅ Client Management Portal API tab deployed
- ✅ All Edge Functions using shared `bisonApiClient`
- ✅ Real-time API health visible in UI

### Week 4 Targets
- ✅ Zero 403 authorization errors
- ✅ 100% API key coverage
- ✅ Automated health monitoring active
- ✅ Complete audit trail for all API calls
- ✅ Webhook configuration functional for all active clients

---

## Risk Mitigation

### Risk 1: API Key Generation Rate Limits
**Mitigation:** Generate keys in batches with 2-second delays between requests

### Risk 2: Super Admin Key Revocation
**Mitigation:** Maintain backup super admin keys in Supabase secrets, rotate quarterly

### Risk 3: Webhook Delivery Failures
**Mitigation:** Implement retry queue with exponential backoff (3 retries max)

### Risk 4: Data Accuracy During Migration
**Mitigation:** Run parallel sync for 1 week before cutover, validate data consistency

---

## Cost Analysis

### Development Time
- Database migrations: 4 hours
- Backend Edge Functions: 16 hours
- Frontend UI components: 24 hours
- Testing & QA: 12 hours
- Documentation: 4 hours
- **Total:** ~60 hours (1.5 weeks for 1 developer)

### Infrastructure Costs
- Supabase database storage: +$0 (within free tier)
- Edge Function invocations: +$5/month (estimated)
- API call logging storage: +$10/month (estimated)
- **Total:** ~$15/month additional cost

### ROI
- **Time Saved:** 2-3 hours/week on manual API troubleshooting
- **Error Reduction:** 95% reduction in 403/401 errors
- **Data Accuracy:** 100% confidence in sync accuracy
- **Client Onboarding:** 50% faster new client setup

---

## Next Steps

1. **Immediate Action (Today):**
   - Flag Workspark as `requires_workspace_key = true`
   - Generate Workspark workspace API key manually
   - Test and verify 403 error resolved

2. **This Week:**
   - Approve this comprehensive plan
   - Prioritize Phase 1 (database schema)
   - Begin UI mockups for Client Management Portal

3. **Review Meeting:**
   - Schedule 30-minute review to walk through UI mockups
   - Confirm priority order of Edge Function updates
   - Set target launch date for Phase 1

---

**Document Version:** 1.0
**Created:** 2025-10-09
**Last Updated:** 2025-10-09
**Owner:** Engineering Team
**Status:** Awaiting Approval
