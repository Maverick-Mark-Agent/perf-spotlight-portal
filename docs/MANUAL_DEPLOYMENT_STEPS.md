# Manual Deployment Steps for API & Webhook Management

## Step 1: Deploy Database Migration

**Go to:** Supabase Dashboard → SQL Editor → New Query

**Copy and paste the entire SQL file:**
`/supabase/migrations/20251010000000_add_api_webhook_management.sql`

**Click:** Run

**Expected output:**
```
=== API & Webhook Management Migration Complete ===
Total active clients: 26
Active clients with API keys: 25
Active clients WITHOUT API keys: 1
⚠️  WARNING: 1 active client(s) missing API keys
   Please generate workspace-specific API keys for these clients:
   - Workspark (Long Run)
=== Tables Created ===
✓ workspace_api_logs (audit trail)
✓ workspace_webhook_events (event processing)
=== Helper Functions Created ===
✓ delete_old_api_logs() - cleanup after 90 days
✓ delete_old_webhook_events() - cleanup after 90 days
✓ reset_daily_api_counters() - run daily at midnight
✓ update_api_health_status() - run every 15 minutes
```

---

## Step 2: Generate Workspark API Key (Manual)

**Go to:** https://send.longrun.agency/dashboard

1. Login with Long Run credentials
2. Switch to **Workspark** workspace (workspace_id: 14)
3. Navigate to: **Settings** → **API Keys**
4. Click: **Generate New API Key**
   - Name: "Workspark Workspace API"
   - Type: "Workspace"
   - Scopes: Select all workspace-level permissions
5. **Copy the generated API key** (format: `##|[long string]`)

---

## Step 3: Add Workspark API Key to Database

**Go to:** Supabase Dashboard → SQL Editor → New Query

**Run this SQL** (replace `YOUR_API_KEY_HERE` with the actual key):

```sql
UPDATE client_registry
SET
  bison_api_key = 'YOUR_API_KEY_HERE',
  bison_api_key_name = 'Workspark Workspace API',
  bison_api_key_created_at = NOW(),
  bison_api_key_status = 'active',
  api_health_status = 'healthy'
WHERE workspace_name = 'Workspark';

-- Verify update
SELECT workspace_name, bison_api_key_name, api_health_status
FROM client_registry
WHERE workspace_name = 'Workspark';
```

**Expected output:**
```
workspace_name | bison_api_key_name       | api_health_status
---------------|--------------------------|------------------
Workspark      | Workspark Workspace API  | healthy
```

---

## Step 4: Enable Active Clients API Key Constraint (Optional)

**ONLY run this after Workspark API key is added!**

**Go to:** Supabase Dashboard → SQL Editor → New Query

```sql
-- Enforce constraint: All active clients MUST have API keys
ALTER TABLE public.client_registry
  DROP CONSTRAINT IF EXISTS active_clients_require_api_key;

ALTER TABLE public.client_registry
  ADD CONSTRAINT active_clients_require_api_key
  CHECK (
    (is_active = false) OR
    (is_active = true AND bison_api_key IS NOT NULL)
  );

-- Verify all active clients have keys
SELECT
  COUNT(*) FILTER (WHERE is_active = true) AS total_active,
  COUNT(*) FILTER (WHERE is_active = true AND bison_api_key IS NOT NULL) AS with_keys,
  COUNT(*) FILTER (WHERE is_active = true AND bison_api_key IS NULL) AS missing_keys
FROM client_registry;
```

**Expected output:**
```
total_active | with_keys | missing_keys
-------------|-----------|-------------
26           | 26        | 0
```

---

## Step 5: Test Workspark Sync

**Test via curl:**

```bash
curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-email-accounts" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0" \
  -H "Content-Type: application/json" \
  -d '{"workspace_name": "Workspark"}' | jq
```

**Expected success:**
```json
{
  "success": true,
  "summary": {
    "workspaces_synced": 1,
    "workspaces_failed": 0,
    "total_accounts": 140,  // Or whatever the correct count is
    "duration_ms": 5000
  }
}
```

---

## Step 6: Verify API Logs Are Being Created

**Go to:** Supabase Dashboard → SQL Editor → New Query

```sql
-- Check recent API logs
SELECT
  workspace_name,
  endpoint,
  status_code,
  success,
  response_time_ms,
  created_at
FROM workspace_api_logs
WHERE workspace_name = 'Workspark'
ORDER BY created_at DESC
LIMIT 10;
```

**Expected:** Should see logs from the test sync above

---

## Deployment Checklist

- [ ] Step 1: Database migration deployed ✓
- [ ] Step 2: Workspark API key generated
- [ ] Step 3: Workspark API key added to database
- [ ] Step 4: API key constraint enabled (optional)
- [ ] Step 5: Workspark sync test passed (no 403 error)
- [ ] Step 6: API logs verified

---

## Troubleshooting

### Issue: Migration fails with "column already exists"
**Solution:** Some columns may already exist (like `bison_api_key`). The migration uses `ADD COLUMN IF NOT EXISTS`, so this shouldn't happen. If it does, check which column is causing the issue and manually remove that line from the migration.

### Issue: Workspark API key generation fails
**Solution:** Contact Long Run admin to generate the key manually, or use the Long Run super admin key temporarily until a workspace key can be generated.

### Issue: Constraint violation when enabling active_clients_require_api_key
**Solution:** Run this query to find which clients are missing keys:
```sql
SELECT workspace_name, bison_instance, is_active
FROM client_registry
WHERE is_active = true AND bison_api_key IS NULL;
```

Generate keys for any missing clients before enabling the constraint.

---

**Next Steps After Deployment:**
1. Create shared `workspaceApiClient` module (Phase 3)
2. Update Edge Functions to use workspace-specific keys only
3. Build Client Management Portal "API & Webhooks" tab UI
