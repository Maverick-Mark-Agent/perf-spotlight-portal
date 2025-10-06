# Airtable Elimination Plan - Complete Migration to Supabase

## 🎯 Goal
Store ALL data in Supabase and completely eliminate Airtable dependency.

## ✅ What's Been Created

### 1. Database Tables

#### `client_registry` (Enhanced)
**Purpose:** Master table for all clients (single source of truth)

**Fields:**
- `workspace_id` - Email Bison ID (PK)
- `workspace_name` - Email Bison name (unique)
- `display_name` - Pretty name for display
- `is_active` - Active/inactive status
- `billing_type` - per_lead or retainer
- `price_per_lead` - Per-lead pricing
- `retainer_amount` - Monthly retainer
- `monthly_kpi_target` - Monthly lead target
- `monthly_sending_target` - Email volume target ✨ NEW
- `payout` - Monthly payout amount ✨ NEW
- `airtable_record_id` - For migration reference

**Replaces Airtable Fields:**
- Client Company Name → `display_name`
- Workspace Name → `workspace_name`
- Monthly KPI → `monthly_kpi_target`
- Monthly Sending Target → `monthly_sending_target`
- Payout → `payout`

---

#### `client_metrics` ✨ NEW
**Purpose:** Time-series KPI data (daily/monthly snapshots)

**Fields:**
- `workspace_name` - Links to client_registry
- `metric_date` - Date of snapshot
- `metric_type` - daily, monthly, or mtd
- `emails_sent_mtd` - Emails sent month-to-date
- `projection_emails_eom` - Projected emails by end of month
- `positive_replies_mtd` - Replies month-to-date
- `positive_replies_last_7_days` - Last 7 days
- `positive_replies_last_30_days` - Last 30 days
- `projection_positive_replies_eom` - Projected replies EOM
- `mtd_leads_progress` - % of target (MTD)
- `projection_replies_progress` - % of target (projected)

**Replaces Airtable Calculated Fields:**
- Positive Replies MTD → `positive_replies_mtd`
- Projection: Positive Replies Received (by EOM) → `projection_positive_replies_eom`
- MTD - Leads Generated Progress → `mtd_leads_progress`
- Projection Positive Replies % Progress → `projection_replies_progress`
- Positive Replies Last 30 Days → `positive_replies_last_30_days`
- Positive Replies Last 7 Days → `positive_replies_last_7_days`
- Emails Sent - MTD → `emails_sent_mtd`
- Projection: Emails Sent by EOM → `projection_emails_eom`

---

#### `campaigns` ✨ NEW
**Purpose:** Campaign scheduling and tracking

**Fields:**
- `workspace_name` - Links to client_registry
- `campaign_name` - Campaign name
- `emails_scheduled_today` - Scheduled for today
- `emails_scheduled_tomorrow` - Scheduled for tomorrow
- `is_active` - Active status
- `airtable_record_id` - For migration

**Replaces Airtable Campaigns Table:**
- Campaign name fields
- Email scheduling fields

---

#### `client_settings` (Already exists)
**Purpose:** Per-client ROI settings

**Fields:**
- `workspace_name`
- `cost_per_lead` - Fixed cost (backend only)
- `default_commission_rate` - Default commission %

---

#### `client_leads` (Already exists)
**Purpose:** Lead pipeline management

All positive reply leads with premium amounts, policy types, etc.

---

### 2. Views & Functions

#### Views:
- `client_latest_metrics` - Latest MTD metrics per client
- `client_dashboard_data` - Complete combined view for dashboards

#### Functions:
- `upsert_client_daily_metrics()` - Update daily metrics
- `calculate_mtd_metrics()` - Calculate month-to-date with projections

---

### 3. Edge Functions

#### `sync-all-metrics` ✨ NEW
**Purpose:** Fetch data from Email Bison and populate Supabase

**What it does:**
1. Fetches all workspaces from Email Bison
2. For each client in `client_registry`:
   - Switches to their workspace
   - Fetches MTD stats
   - Fetches last 7/30 day stats
   - Calculates projections
   - Upserts to `client_metrics` table

**Schedule:** Run daily via cron

---

#### `send-volume-slack-dm-v2` ✨ NEW
**Purpose:** Send volume report to Slack (using Supabase only!)

**What it does:**
1. Reads from `client_registry` for targets
2. Fetches Email Bison stats
3. Sends Slack notification
4. **NO AIRTABLE** 🎉

---

## 📋 Migration Steps

### Step 1: Run Migrations in Supabase
```sql
-- Run in Supabase SQL Editor
-- File: 20251006020000_add_monthly_sending_target.sql
-- File: 20251006030000_complete_airtable_replacement.sql
```

### Step 2: Populate `client_registry`

**Option A: One-time manual population**
```sql
-- Add missing clients to client_registry
INSERT INTO public.client_registry (
  workspace_id, workspace_name, display_name,
  is_active, billing_type, monthly_kpi_target, monthly_sending_target
) VALUES
  (123, 'Danny Schwartz', 'Danny Schwartz', true, 'per_lead', 100, 50000),
  (124, 'Devin Hodo', 'Devin Hodo', true, 'per_lead', 100, 50000),
  (125, 'David Amiri', 'David Amiri', true, 'per_lead', 100, 50000),
  (126, 'Kim Wallace', 'Kim Wallace', true, 'per_lead', 100, 50000),
  (127, 'Rob Russell', 'Rob Russell', true, 'per_lead', 100, 50000)
ON CONFLICT (workspace_id) DO UPDATE SET
  monthly_kpi_target = EXCLUDED.monthly_kpi_target,
  monthly_sending_target = EXCLUDED.monthly_sending_target;
```

**Option B: Run sync from Airtable (one-time)**
Use the existing `seed-client-registry` function to pull from Airtable, then update with sending targets.

### Step 3: Initial Metrics Sync
```bash
# Call the sync function via Supabase CLI or dashboard
supabase functions invoke sync-all-metrics
```

This will populate `client_metrics` with current data from Email Bison.

### Step 4: Set Up Daily Cron Job
```sql
-- Add to your cron jobs
SELECT cron.schedule(
  'sync-all-metrics-daily',
  '0 3 * * *', -- 3 AM daily
  $$
  SELECT net.http_post(
    url := '<your-supabase-url>/functions/v1/sync-all-metrics',
    headers := jsonb_build_object(
      'Authorization', 'Bearer <your-anon-key>',
      'Content-Type', 'application/json'
    )
  );
  $$
);
```

### Step 5: Update Volume Dashboard
Modify `volume-dashboard-data` Edge Function to use `client_dashboard_data` view instead of Airtable.

### Step 6: Switch Slack DM to v2
Update cron job to use `send-volume-slack-dm-v2` instead of old function.

### Step 7: Update All Other Dashboards
Replace all Airtable function calls with Supabase queries:
- KPI Dashboard → Use `client_dashboard_data` view
- Revenue Dashboard → Already using Supabase
- Volume Dashboard → Use `client_metrics` table

---

## 🔄 Data Flow (After Migration)

```
Email Bison API
      ↓
sync-all-metrics (runs daily at 3 AM)
      ↓
Supabase Tables:
  - client_registry (static client data)
  - client_metrics (daily snapshots)
  - client_leads (pipeline data)
      ↓
Dashboards & Slack Notifications
  (100% Supabase, 0% Airtable)
```

---

## ✅ Verification Checklist

After migration, verify:
- [ ] All clients visible in Volume Dashboard
- [ ] Slack DM includes all clients (Danny, Devin, David, Kim, Rob)
- [ ] Metrics update daily
- [ ] KPI Dashboard shows correct data
- [ ] No Airtable API calls in browser Network tab
- [ ] All Edge Functions use Supabase only

---

## 🗑️ Airtable Cleanup (After Verification)

Once everything works:
1. Archive Airtable base (don't delete immediately)
2. Remove Airtable API keys from Supabase secrets
3. Delete old Airtable-dependent Edge Functions:
   - `airtable-clients`
   - `airtable-sending-volume`
   - `airtable-email-accounts`
   - `airtable-campaigns`
4. Update documentation

---

## 🎉 Benefits of This Migration

- ✅ **Single source of truth** - All data in Supabase
- ✅ **No Airtable costs** - Eliminate monthly subscription
- ✅ **Faster queries** - Direct SQL vs API calls
- ✅ **Better control** - Own your data completely
- ✅ **Easier debugging** - Query directly in Supabase
- ✅ **Scalable** - PostgreSQL handles growth better
- ✅ **Time-series data** - Historical metrics stored properly

---

## 📞 Next Steps

1. Run migrations (Step 1)
2. Populate client_registry (Step 2)
3. Test sync-all-metrics function (Step 3)
4. Verify data in Supabase dashboard
5. Update Volume Dashboard to use Supabase
6. Test everything thoroughly
7. Remove Airtable dependency 🎉
