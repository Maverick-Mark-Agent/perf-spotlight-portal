# Billable Charts Not Working - Troubleshooting

## Issue
The two new billable charts are showing empty/not rendering:
1. **Billable Lead Revenue Forecast**
2. **Billable Lead Revenue (MTD)**

## Root Cause
The dashboard is likely using **cached data** that doesn't include the new billable-only fields that were just added to the Edge Function.

## Solution

### Quick Fix (Recommended):
**Click the "Refresh" button** in the top-right corner of the Revenue Dashboard.

This will:
1. Force a fresh API call to the revenue-analytics Edge Function
2. Bypass the localStorage cache
3. Load the new fields: `daily_billable_revenue`, `billable_forecast`, `total_possible_billable_revenue`, etc.

### Alternative Fix (if Refresh doesn't work):
**Clear browser cache** for the dashboard:

1. Open browser DevTools (F12 or Cmd+Option+I)
2. Go to Application tab (Chrome) or Storage tab (Firefox)
3. Find "Local Storage" → `http://localhost:8080`
4. Delete the key: `revenue-dashboard-data`
5. Reload the page

### Verification Steps:

1. After refreshing, open browser console (F12)
2. Look for these console logs:
   ```
   📊 Billable Time-Series - daily_billable_revenue: Array(14)
   ✅ Billable Time-Series Data: 14 days
   🔮 Billable Forecast - billable_forecast: Object
   ✅ Billable Forecast Data: 31 days
   ```

3. If you still see warnings:
   ```
   ⚠️ No daily_billable_revenue data available
   ⚠️ No billable_forecast data available
   ```
   Then the Edge Function may not be returning the data correctly.

### What the Charts Should Show:

**Billable Lead Revenue Forecast:**
- Blue line: Actual MTD (billable) - should show 14 days of historical data
- Dashed lines: Conservative, Linear, Optimistic projections
- Red line: 100% KPI Target at $36,500
- End-of-month forecasts: Conservative ($9,289), Linear ($9,289), Optimistic ($24,211)

**Billable Lead Revenue (MTD):**
- Purple area: Cumulative billable revenue by day (currently $3,867.50 on day 14)
- Red dashed line: Target pace ($1,177/day × day number)
- Shows 14 data points, one for each day of October so far

### Edge Function Status:
✅ Deployed successfully
✅ Tested with API - returns correct data
✅ 18 per-lead clients tracked
✅ 14 days of time-series data available

## Technical Details

The Edge Function now returns these new fields in the `totals` object:

```typescript
{
  total_possible_billable_revenue: 36500,        // Per-lead only @ 100% KPI
  daily_billable_revenue_target: 1177.42,        // Daily target pace
  total_mtd_billable_revenue: 4195,              // Actual MTD (per-lead only)
  daily_billable_revenue: [                       // Time-series data
    { day: 1, date: "2025-10-01", cumulative_revenue: 500, ... },
    { day: 2, date: "2025-10-02", cumulative_revenue: 870, ... },
    // ... 14 days total
  ],
  billable_forecast: {
    conservative: 9288.93,
    linear: 9288.93,
    optimistic: 24211.13,
    confidence: "low",
    avg_kpi_progress: 8.24,
    daily_average: 299.64,
    days_elapsed: 14,
    days_remaining: 17
  }
}
```

If you don't see these fields after refreshing, there may be an issue with the data fetch logic.
