# Revenue Dashboard Deployment Guide

## Overview
This guide outlines the steps to deploy the Revenue Dashboard with MTD-focused metrics and real cost tracking.

**Status**: ✅ Code deployed, ⚠️ Requires database migration and pricing data population

---

## Prerequisites

- Supabase CLI access with project credentials
- Access to Supabase SQL Editor
- Client pricing data (price_per_lead and retainer_amount values)

---

## Deployment Steps

### 1. Deploy Database Migration (REQUIRED)

The `client_costs` table must be created before the Revenue Dashboard can function properly.

**Option A: Using Supabase SQL Editor** (RECOMMENDED):

1. Open Supabase Dashboard: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new
2. Copy the contents of `supabase/migrations/20251010130000_create_client_costs_table.sql`
3. Paste into SQL Editor and click "Run"
4. Verify success message: "Client costs table created successfully!"

**Option B: Using Supabase CLI**:

```bash
export SUPABASE_ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015"
npx supabase db push --project-ref gjqbbgrfhijescaouqkx
```

### 2. Verify Edge Function Deployment

The `revenue-analytics` Edge Function has already been deployed:

```bash
# Check deployment status
export SUPABASE_ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015"
npx supabase functions list --project-ref gjqbbgrfhijescaouqkx
```

Expected output: `revenue-analytics` should appear in the list.

### 3. Populate Client Pricing Data (REQUIRED FOR REVENUE CALCULATIONS)

**Current State**: Most clients in `client_registry` have `price_per_lead: 0.0` and `retainer_amount: 0.0`

**Required Action**: Update pricing for all active clients:

```sql
-- Example: Update pricing for a per-lead client
UPDATE public.client_registry
SET
  billing_type = 'per_lead',
  price_per_lead = 125.00,  -- Price per interested lead
  retainer_amount = 0
WHERE workspace_name = 'David Amiri';

-- Example: Update pricing for a retainer client
UPDATE public.client_registry
SET
  billing_type = 'retainer',
  price_per_lead = 0,
  retainer_amount = 5000.00  -- Monthly retainer fee
WHERE workspace_name = 'Example Retainer Client';
```

**Bulk Update Template**: Create a script with all client pricing:

```sql
-- Update all client pricing in one transaction
BEGIN;

UPDATE client_registry SET billing_type = 'per_lead', price_per_lead = 125.00 WHERE workspace_name = 'David Amiri';
UPDATE client_registry SET billing_type = 'per_lead', price_per_lead = 150.00 WHERE workspace_name = 'Devin Hodo';
UPDATE client_registry SET billing_type = 'per_lead', price_per_lead = 100.00 WHERE workspace_name = 'Jason Binyon';
-- ... add all other clients

COMMIT;
```

### 4. (Optional) Populate October 2025 Costs

If you want to track costs for profitability analysis:

```sql
-- Insert monthly costs for a client
INSERT INTO public.client_costs (workspace_name, month_year, email_account_costs, labor_costs, other_costs, notes)
VALUES
  ('David Amiri', '2025-10', 250.00, 500.00, 100.00, 'October 2025 costs'),
  ('Devin Hodo', '2025-10', 300.00, 600.00, 50.00, 'October 2025 costs')
ON CONFLICT (workspace_name, month_year)
DO UPDATE SET
  email_account_costs = EXCLUDED.email_account_costs,
  labor_costs = EXCLUDED.labor_costs,
  other_costs = EXCLUDED.other_costs,
  notes = EXCLUDED.notes;
```

**Note**: If no cost data is found, the dashboard will default to $0 costs (showing 100% profit margin).

---

## Verification

### Test Revenue Dashboard API

```bash
curl -s "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/revenue-analytics" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0" | jq
```

**Expected Response**:
```json
{
  "clients": [
    {
      "workspace_name": "David Amiri",
      "billing_type": "per_lead",
      "current_month_leads": 15,
      "current_month_revenue": 1875.00,
      "current_month_costs": 850.00,
      "current_month_profit": 1025.00,
      "profit_margin": 54.67,
      "price_per_lead": 125.00,
      "retainer_amount": 0
    }
  ],
  "totals": {
    "total_mtd_revenue": 25000.00,
    "total_mtd_costs": 5000.00,
    "total_mtd_profit": 20000.00,
    "total_mtd_leads": 150,
    "total_per_lead_revenue": 20000.00,
    "total_retainer_revenue": 5000.00,
    "per_lead_count": 12,
    "retainer_count": 2,
    "overall_profit_margin": 80.00
  },
  "meta": {
    "month_year": "2025-10",
    "snapshot_date": "2025-10-09"
  }
}
```

### Verify Database Tables

```sql
-- Check client_costs table exists
SELECT COUNT(*) FROM public.client_costs;

-- Check client_registry pricing data
SELECT
  workspace_name,
  billing_type,
  price_per_lead,
  retainer_amount,
  is_active
FROM public.client_registry
WHERE is_active = true
ORDER BY workspace_name;

-- Check client_metrics has MTD data
SELECT
  workspace_name,
  interested_replies_mtd,
  metric_date
FROM public.client_metrics
WHERE metric_date = CURRENT_DATE
  AND metric_type = 'mtd'
ORDER BY workspace_name;
```

### Test Frontend Dashboard

1. Open localhost or production URL
2. Navigate to Revenue Dashboard
3. Verify metrics display:
   - **MTD Revenue**: Should show total revenue across all clients
   - **Per-Lead Revenue**: Sum of all per-lead clients
   - **Retainer Revenue**: Sum of all retainer clients
   - **MTD Profit**: Revenue - Costs

---

## Architecture

### Data Flow

```
┌─────────────────────┐
│  Client Registry    │  ← Pricing (billing_type, price_per_lead, retainer_amount)
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Client Metrics     │  ← MTD Leads (interested_replies_mtd)
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Client Costs       │  ← MTD Costs (email_account_costs, labor_costs, other_costs)
└──────────┬──────────┘
           │
           ↓
┌─────────────────────────────────┐
│  revenue-analytics              │  ← Calculates MTD Revenue & Profit
│  Edge Function                  │
└──────────┬──────────────────────┘
           │
           ↓
┌─────────────────────────────────┐
│  Revenue Dashboard UI           │  ← Displays MTD metrics
└─────────────────────────────────┘
```

### Revenue Calculation Logic

**Per-Lead Clients**:
```
MTD Revenue = interested_replies_mtd × price_per_lead
```

**Retainer Clients**:
```
MTD Revenue = retainer_amount (fixed monthly fee)
```

**Profit Calculation**:
```
MTD Profit = MTD Revenue - MTD Costs
Profit Margin = (MTD Profit / MTD Revenue) × 100
```

---

## Troubleshooting

### Issue: "Could not find the table 'public.client_costs' in the schema cache"

**Cause**: Migration not deployed
**Fix**: Run Step 1 (Deploy Database Migration)

### Issue: All revenue shows $0

**Cause**: No pricing data in client_registry
**Fix**: Run Step 3 (Populate Client Pricing Data)

### Issue: All profit margins show 100%

**Cause**: No cost data in client_costs table (defaults to $0)
**Fix**: Run Step 4 (Populate October 2025 Costs) or accept that costs are $0

### Issue: Revenue Dashboard not loading

**Cause**: Missing client_metrics data
**Fix**: Ensure sync-daily-kpi-metrics has run successfully (check logs)

```bash
export SUPABASE_ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015"
npx supabase functions logs sync-daily-kpi-metrics --project-ref gjqbbgrfhijescaouqkx
```

---

## Next Steps

1. **Deploy migration**: Create client_costs table
2. **Populate pricing**: Update all client_registry records with real pricing
3. **Optional: Add costs**: Populate client_costs for accurate profit tracking
4. **Test dashboard**: Verify metrics display correctly
5. **Monitor**: Check Edge Function logs for any errors

---

## Summary

### What's Deployed
✅ revenue-analytics Edge Function
✅ RevenueDashboard.tsx UI updates
✅ Migration file created

### What's Pending
⚠️ Database migration (create client_costs table)
⚠️ Client pricing data population (required for revenue calculations)
⚠️ Cost data population (optional, defaults to $0)

### Performance
- **Response Time**: <500ms (direct database queries)
- **Cache**: 5-minute cache on frontend
- **Data Freshness**: Real-time from client_metrics table

---

**Last Updated**: 2025-10-09
**Author**: Claude Code Assistant
