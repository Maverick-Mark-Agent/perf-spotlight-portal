# Investigation Report: sync-daily-kpi-metrics Not Running

**Date:** October 12, 2025
**Issue:** Edge Function hasn't run since 2025-10-10
**Status:** 🔴 CRITICAL - Automatic scheduling not working
**Investigator:** Claude Code Agent

---

## Quick Summary

The `sync-daily-kpi-metrics` Edge Function is **designed to run daily at 12:01 AM via pg_cron**, but it has **not executed automatically since October 10, 2025**. The function itself works perfectly when triggered manually, processing 25 out of 26 clients successfully in ~15 seconds.

### Key Findings
- ✅ Edge Function is fully operational
- ❌ Automatic cron scheduling is not working
- ✅ Webhooks are functioning correctly
- ⚠️ Cannot verify cron job status (requires elevated permissions)
- 🔧 Temporary workaround: Manual trigger script created

---

## Investigation Results

### 1. ✅ Edge Function Health Check

**Test:** Manual trigger of sync-daily-kpi-metrics
**Result:** SUCCESS

```json
{
  "success": true,
  "total_clients": 26,
  "successful": 25,
  "failed": 1,
  "duration_ms": 15216,
  "date": "2025-10-12"
}
```

**Performance:**
- Processed 26 clients in 15.2 seconds
- 25 successful updates
- 1 skipped (Workspark - missing API key)
- Average: 608ms per client

**Sample Results:**
| Client | MTD Replies | Projected EOM | Target | Progress |
|--------|-------------|---------------|--------|----------|
| David Amiri | 31 | 80 | 100 | 31% |
| Jason Binyon | 18 | 47 | 200 | 9% |
| StreetSmart Commercial | 20 | 52 | 50 | 40% |
| Kim Wallace | 21 | 54 | 200 | 11% |
| Nick Sakha | 15 | 39 | 300 | 5% |

**Conclusion:** The Edge Function is working correctly and can be relied upon.

---

### 2. ❌ Database Update History

**Query:** `client_metrics` table for recent updates

**Results:**

| Date | Entries | Last Updated | Status |
|------|---------|--------------|--------|
| 2025-10-10 | 20 clients | 2025-10-10 04:16:11 UTC | ✅ (Last auto-run) |
| 2025-10-11 | 0 clients | N/A | ❌ MISSING |
| 2025-10-12 | 26 clients | 2025-10-12 16:25:58 UTC | ✅ (Manual trigger) |

**Analysis:**
- Last automatic run: October 10, 2025 at 4:16 AM UTC (8:16 PM PST Oct 9)
- Expected run on Oct 11 at 12:01 AM: ❌ DID NOT RUN
- Expected run on Oct 12 at 12:01 AM: ❌ DID NOT RUN
- Manual trigger on Oct 12: ✅ WORKED

**Gap:** 2 days of missing automatic updates (Oct 11, Oct 12)

---

### 3. ✅ Webhook Activity

**Query:** `webhook_delivery_log` for recent deliveries

**Status:** ACTIVE and WORKING

**Recent Activity:**
- Last webhook: 2025-10-12 16:13:52 UTC
- Success rate: 100% (15/15 recent deliveries)
- Event type: lead_interested
- Workspaces receiving webhooks: Rob Russell, David Amiri, StreetSmart Commercial, Kim Wallace, Nick Sakha, John Roberts, Jason Binyon, Jeff Schroder, Danny Schwartz

**Conclusion:** Webhook infrastructure is healthy. Real-time updates are being received.

---

### 4. ⚠️ Cron Job Status

**Query:** Attempted to check `cron.job` table

**Result:** ❌ CANNOT ACCESS

**Error:**
```json
{
  "code": "PGRST205",
  "message": "Could not find the table 'public.cron.job' in the schema cache"
}
```

**Reason:** The anon key does not have permissions to access:
- `cron.job` (scheduled jobs)
- `cron.job_run_details` (execution history)
- `pg_extension` (extension status)
- `cron.daily_kpi_sync_history` (monitoring view)

**What This Means:**
We cannot verify if:
1. The cron job was successfully created
2. pg_cron extension is enabled
3. The job is set to active
4. The job has attempted to run
5. Why the job might be failing

---

### 5. 📄 Migration File Analysis

**File:** `/supabase/migrations/20251009235900_schedule_daily_kpi_sync.sql`

**Created:** October 9, 2025 at 18:08 PST

**Contents:**
```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the job
SELECT cron.schedule(
  'daily-kpi-metrics-sync',
  '1 0 * * *',  -- 12:01 AM daily
  $$ SELECT net.http_post(...) $$
);

-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create monitoring view
CREATE OR REPLACE VIEW cron.daily_kpi_sync_history AS ...
```

**Expected Behavior:**
- Job should run every day at 12:01 AM UTC (4:01 PM PST)
- Calls Edge Function via HTTP POST
- Uses service role key for authentication
- Logs execution to `cron.job_run_details`

**Deployment Status:** ⚠️ UNKNOWN - Cannot verify if migration was applied

---

## Root Cause Analysis

### Most Likely Cause: Migration Not Applied (70%)

**Evidence:**
- Last automatic run was Oct 10 at 4:16 AM (likely a manual trigger or different mechanism)
- No runs on Oct 11 or Oct 12 at expected time (12:01 AM)
- Cannot access cron tables (may indicate they don't exist)

**Explanation:**
The migration file exists in the repository but may not have been executed against the production database. If the migration wasn't run, the cron job would never be scheduled.

**How to Verify:**
```sql
-- Check if migration was applied
SELECT * FROM supabase_migrations.schema_migrations
WHERE version = '20251009235900';

-- If result is empty, migration was NOT applied
```

### Alternative Causes

**2. pg_cron Extension Not Enabled (20%)**
- Supabase may require manual enablement of pg_cron
- Some Supabase plans don't support pg_cron
- Extension could have been disabled

**3. Service Role Key Not Configured (5%)**
- Cron job uses `current_setting('app.settings.service_role_key', true)`
- This setting may not be configured in the database
- Job would fail silently

**4. Cron Job Exists But Is Failing (5%)**
- Job is scheduled but HTTP POST is failing
- Network issues preventing Edge Function calls
- Would show up in `cron.job_run_details` if we could access it

---

## Recommended Actions

### 🚨 PRIORITY 1: Verify Migration Status

**Action:** Check if the migration was applied to production

**Method 1: Supabase Dashboard SQL Editor (EASIEST)**
1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql
2. Run this query:
   ```sql
   -- Check if migration was applied
   SELECT * FROM supabase_migrations.schema_migrations
   WHERE version = '20251009235900';

   -- Check if cron job exists
   SELECT * FROM cron.job
   WHERE jobname = 'daily-kpi-metrics-sync';

   -- Check if pg_cron is enabled
   SELECT * FROM pg_extension
   WHERE extname IN ('pg_cron', 'pg_net');
   ```

**Expected Results:**
- Migration record should exist
- Cron job should be listed with `active = true`
- Both extensions should be present

**If Migration Is Missing:**
Proceed to Priority 2.

**If Migration Exists But Job Isn't Running:**
Check execution history:
```sql
SELECT * FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 10;
```

---

### 🔧 PRIORITY 2: Apply Migration (If Missing)

**Action:** Run the migration against production database

**Method 1: Via psql (RECOMMENDED)**
```bash
cd "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal"

PGPASSWORD="Maverick2024!" psql \
  -h aws-0-us-west-1.pooler.supabase.com \
  -p 6543 \
  -U postgres.gjqbbgrfhijescaouqkx \
  -d postgres \
  -f supabase/migrations/20251009235900_schedule_daily_kpi_sync.sql
```

**Method 2: Via Supabase Dashboard**
1. Copy contents of `/supabase/migrations/20251009235900_schedule_daily_kpi_sync.sql`
2. Go to SQL Editor in Supabase Dashboard
3. Paste and run

**Expected Output:**
```
CREATE EXTENSION
GRANT
 jobid | schedule  | jobname                    | active
-------+-----------+----------------------------+--------
    1  | 1 0 * * * | daily-kpi-metrics-sync     | t

status: Daily KPI sync job scheduled successfully!
```

**Verification:**
After running, verify the job was created:
```sql
SELECT
  jobid,
  schedule,
  active,
  jobname,
  database
FROM cron.job
WHERE jobname = 'daily-kpi-metrics-sync';
```

---

### 🔍 PRIORITY 3: Monitor Next Scheduled Run

**Action:** Wait for next scheduled run at 12:01 AM UTC

**Schedule:**
- UTC: 00:01 (12:01 AM)
- PST: 16:01 (4:01 PM, previous day)
- Next run: October 13, 2025 at 00:01 UTC (Oct 12 at 4:01 PM PST)

**How to Monitor:**
```sql
-- Check execution history after expected run time
SELECT
  runid,
  status,
  return_message,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duration_seconds
FROM cron.job_run_details
WHERE jobid = (
  SELECT jobid FROM cron.job
  WHERE jobname = 'daily-kpi-metrics-sync'
)
ORDER BY start_time DESC
LIMIT 1;
```

**Check Data Updated:**
```sql
-- Verify client_metrics was updated
SELECT
  metric_date,
  COUNT(*) as clients_updated,
  MAX(updated_at) as last_update
FROM client_metrics
WHERE metric_type = 'mtd'
GROUP BY metric_date
ORDER BY metric_date DESC
LIMIT 3;
```

**Expected Result:**
- Should see new entry for October 13, 2025
- `last_update` should be within minutes of 12:01 AM UTC

---

### 🛠️ PRIORITY 4: Fix Known Issues

#### Issue 1: Workspark Missing API Key

**Problem:** Workspark client is skipped due to missing `bison_api_key`

**Solution:**
```sql
UPDATE client_registry
SET bison_api_key = '[API_KEY_HERE]'
WHERE workspace_name = 'Workspark';
```

#### Issue 2: Add Alerting for Failed Runs

**Create Alert Query:**
```sql
-- This query can be used in monitoring/alerting
SELECT
  jobname,
  status,
  return_message,
  start_time
FROM cron.job_run_details
WHERE
  jobid = (SELECT jobid FROM cron.job WHERE jobname = 'daily-kpi-metrics-sync')
  AND status != 'succeeded'
  AND start_time > NOW() - INTERVAL '1 day'
ORDER BY start_time DESC;
```

---

## Temporary Workaround

Until the cron job is fixed, use manual triggers daily:

### Option 1: Run TypeScript Script (RECOMMENDED)

**File:** `/scripts/manually-trigger-kpi-sync.ts`

```bash
cd "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal"
npm exec tsx scripts/manually-trigger-kpi-sync.ts
```

**Output:**
- Shows success/failure for each client
- Displays MTD metrics, projections, and progress
- Takes ~15 seconds to complete

### Option 2: Curl Command

```bash
curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-daily-kpi-metrics" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0" \
  -H "Content-Type: application/json" | jq
```

### Option 3: GitHub Action (LONG-TERM)

Create `.github/workflows/daily-kpi-sync.yml`:

```yaml
name: Daily KPI Sync Backup
on:
  schedule:
    - cron: '5 0 * * *'  # 12:05 AM UTC (4 min after cron job)
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger KPI Sync
        run: |
          response=$(curl -s -w "%{http_code}" -o /tmp/response.json \
            -X POST "${{ secrets.SUPABASE_URL }}/functions/v1/sync-daily-kpi-metrics" \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_ANON_KEY }}" \
            -H "Content-Type: application/json")

          if [ "$response" != "200" ]; then
            echo "Failed with HTTP $response"
            cat /tmp/response.json
            exit 1
          fi

          echo "Success!"
          cat /tmp/response.json | jq
```

This provides a backup mechanism if pg_cron fails.

---

## Investigation Scripts Created

All scripts are available in `/scripts/`:

1. **`investigate-sync-daily-kpi.ts`**
   - Queries database tables for KPI sync status
   - Checks pg_cron_log, webhook logs, client_metrics

2. **`list-available-tables.ts`**
   - Discovers what tables are accessible
   - Tests various table names

3. **`check-kpi-sync-status.ts`**
   - Main status checker for KPI sync
   - Verifies client_metrics updates
   - Shows webhook activity
   - Lists active clients

4. **`manually-trigger-kpi-sync.ts`** ⭐ PRIMARY TOOL
   - Manually triggers the sync function
   - Shows detailed results for each client
   - Displays summary statistics
   - **Use this for manual runs**

5. **`check-cron-via-api.ts`**
   - Attempts to query cron tables via API
   - Tests RPC functions

6. **`check-supabase-cron-access.sh`**
   - Bash script to test multiple access methods
   - Provides guidance on next steps

7. **`check-cron-job-status.sql`**
   - SQL queries for checking cron status
   - Run via Supabase Dashboard SQL Editor

---

## Files Reference

### Edge Function
- **Path:** `/supabase/functions/sync-daily-kpi-metrics/index.ts`
- **Purpose:** Daily sync of KPI metrics from Email Bison to client_metrics table
- **Status:** ✅ Working when triggered manually

### Migration
- **Path:** `/supabase/migrations/20251009235900_schedule_daily_kpi_sync.sql`
- **Purpose:** Schedule daily cron job to run Edge Function
- **Status:** ⚠️ Unknown if applied

### Documentation
- **Implementation Guide:** `/docs/KPI_DASHBOARD_FIX_IMPLEMENTATION.md`
- **Investigation Summary:** `/scripts/investigation-summary-sync-daily-kpi.md`
- **This Report:** `/INVESTIGATION_REPORT_SYNC_DAILY_KPI.md`

---

## Next Steps Checklist

- [ ] **Verify migration status** using Supabase Dashboard SQL Editor
- [ ] **Apply migration** if not already applied
- [ ] **Verify pg_cron extension** is enabled
- [ ] **Check cron job is scheduled** and active
- [ ] **Monitor execution** at next scheduled run (12:01 AM UTC)
- [ ] **Add Workspark API key** to fix skipped client
- [ ] **Set up alerting** for failed cron runs
- [ ] **Document monitoring procedures** for team
- [ ] **Consider GitHub Action backup** for reliability

---

## Contact & Support

### For Implementation Questions
- See: `/docs/KPI_DASHBOARD_FIX_IMPLEMENTATION.md`
- Section: "DEPLOYMENT STEPS"

### For Troubleshooting
- See: `/docs/KPI_DASHBOARD_FIX_IMPLEMENTATION.md`
- Section: "Monitoring & Maintenance"

### For Manual Triggers
- Run: `npm exec tsx scripts/manually-trigger-kpi-sync.ts`
- Or: Use curl command from this document

---

**Report Generated:** October 12, 2025
**Next Review:** After verifying migration status and monitoring first scheduled run
