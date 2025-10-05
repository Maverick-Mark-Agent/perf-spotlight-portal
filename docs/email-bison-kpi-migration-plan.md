# Email Bison KPI Migration Plan

## Overview
Migrate KPI Dashboard from using Airtable metrics to Email Bison API as the primary data source for all client performance metrics.

## Current Problem
- Airtable "Positive Replies MTD" field shows 0 for John Roberts
- Email Bison shows 2 "interested" replies for John Roberts in October
- Positive replies in Airtable aren't properly linked to client records
- Data is inconsistent and unreliable

## Proposed Solution
Use Email Bison API as the **single source of truth** for all KPI metrics, only using Airtable for:
- Client list (names, workspace mapping)
- Monthly KPI targets
- Static configuration data

## Email Bison Metrics Available

### Current Month Stats (MTD)
- `interested` - Positive replies (THIS is our "leads generated")
- `emails_sent` - Total emails sent
- `bounced` - Bounced emails
- `unique_replies_per_contact` - Total unique replies
- `interested_percentage` - Reply rate

### Time Periods We Can Query
- MTD: `start_date=2025-10-01&end_date=2025-10-03` (current month)
- Last 7 Days: Calculate dynamically
- Last 14 Days: Calculate dynamically
- Last 30 Days: Calculate dynamically
- Previous Month: `start_date=2025-09-01&end_date=2025-09-30`

## Migration Plan

### Phase 1: Test with John Roberts (Single Client)

#### Step 1.1: Create Test Function
Create `supabase/functions/email-bison-kpi-test/index.ts`:
- Fetch John Roberts workspace from Email Bison
- Switch to workspace context
- Get stats for multiple time periods:
  - Current month (MTD)
  - Last 7 days
  - Last 14 days (for week-over-week comparison)
  - Last 30 days
  - Previous month
- Calculate projections based on daily average
- Return formatted data matching current dashboard structure

#### Step 1.2: Test Endpoint
- Deploy test function
- Call from browser/Postman to verify data
- Compare results with Airtable
- Verify John Roberts shows 2 leads (not 0)

#### Step 1.3: Create Test UI Component
- Create temporary page or toggle in KPI Dashboard
- Show John Roberts data from both sources side-by-side:
  - Left: Current Airtable data (0 leads)
  - Right: New Email Bison data (2 leads)
- Verify all metrics populate correctly

### Phase 2: Expand to All Clients

#### Step 2.1: Update Main Function
Modify `supabase/functions/hybrid-workspace-analytics/index.ts`:
- Keep Airtable call for client list and targets
- Replace metric fetching logic with Email Bison API calls
- Use sequential workspace switching (already implemented)
- Fetch stats for all time periods per workspace

#### Step 2.2: Update Data Mapping
Map Email Bison fields to dashboard fields:

**Current → New**
```
leadsGenerated: airtable['Positive Replies MTD'] → emailBison.interested
positiveRepliesLast7Days: airtable[] → emailBison (7-day query)
positiveRepliesLast14Days: airtable[] → emailBison (14-day query)
positiveRepliesLast30Days: airtable[] → emailBison (30-day query)
positiveRepliesCurrentMonth: airtable[] → emailBison (MTD query)
positiveRepliesLastMonth: airtable[] → emailBison (prev month query)
projectedReplies: airtable formula → Calculate from MTD daily average
currentProgress: airtable formula → Calculate: MTD / target
```

**Keep from Airtable**
```
monthlyKPI: airtable['Monthly KPI'] (target, not metric)
name: airtable['Client Company Name']
workspaceName: airtable['Workspace Name']
```

#### Step 2.3: Add Date Range Calculations
```javascript
const getDateRanges = () => {
  const today = new Date();
  const currentMonth = {
    start: new Date(today.getFullYear(), today.getMonth(), 1),
    end: today
  };
  const lastMonth = {
    start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
    end: new Date(today.getFullYear(), today.getMonth(), 0)
  };
  const last7Days = {
    start: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
    end: today
  };
  // etc...
  return { currentMonth, lastMonth, last7Days, ... };
};
```

### Phase 3: Projections & Calculations

#### Client-Side Calculations (in Edge Function)
```javascript
// Calculate projection
const daysElapsed = getCurrentDayOfMonth();
const daysInMonth = getDaysInMonth();
const dailyAverage = interested / daysElapsed;
const projectedReplies = Math.round(dailyAverage * daysInMonth);

// Calculate progress
const currentProgress = monthlyKPI > 0 ? interested / monthlyKPI : 0;
const projectionProgress = monthlyKPI > 0 ? projectedReplies / monthlyKPI : 0;

// Week over week
const last7DaysReplies = stats7Days.interested;
const last14To7DaysReplies = stats14Days.interested - stats7Days.interested;
const weekOverWeek = last14To7DaysReplies > 0
  ? (last7DaysReplies - last14To7DaysReplies) / last14To7DaysReplies
  : 0;

// Month over month
const lastMonthReplies = statsLastMonth.interested;
const currentMonthReplies = statsMTD.interested;
const monthOverMonth = lastMonthReplies > 0
  ? ((currentMonthReplies - lastMonthReplies) / lastMonthReplies) * 100
  : 0;
```

### Phase 4: Testing & Validation

#### Test Checklist
- [ ] John Roberts shows 2 leads (not 0)
- [ ] All clients display correct MTD leads
- [ ] Projections calculate correctly
- [ ] Week-over-week comparisons work
- [ ] Month-over-month comparisons work
- [ ] Progress percentages are accurate
- [ ] Charts and visualizations update
- [ ] Performance is acceptable (sequential API calls)

#### Validation Queries
For each client, verify:
1. MTD matches Email Bison dashboard
2. Last 30 days matches Email Bison
3. Projection makes mathematical sense

### Phase 5: Deployment

#### Step 5.1: Deploy Updated Function
```bash
supabase functions deploy hybrid-workspace-analytics --project-ref gjqbbgrfhijescaouqkx
```

#### Step 5.2: Clear Cache
- Clear localStorage in browser
- Force refresh on KPI Dashboard
- Verify all data updates

#### Step 5.3: Monitor
- Check Supabase function logs
- Monitor for errors
- Verify data accuracy for 24 hours

## Rollback Plan

If issues occur:
1. Revert `hybrid-workspace-analytics` function to previous version
2. Re-deploy old version
3. Clear cache
4. Debug issues in test environment

## Performance Considerations

### Current Implementation
- Sequential workspace switching (already done for volume dashboard)
- ~5-10 seconds for all clients with 5 API calls each

### Optimizations (if needed)
1. **Reduce API calls**: Batch time periods if Email Bison supports it
2. **Cache more aggressively**: 15-minute cache instead of 5-minute
3. **Parallel processing**: Investigate if Email Bison supports parallel workspace queries

## Migration Timeline

### Day 1: Phase 1 (Test with John Roberts)
- Create test function
- Verify data accuracy
- Build comparison UI

### Day 2: Phase 2 (Expand to All Clients)
- Update main function
- Test with 2-3 clients
- Verify calculations

### Day 3: Phase 3-4 (Calculations & Testing)
- Implement all calculations
- Full testing suite
- Fix any bugs

### Day 4: Phase 5 (Deploy to Production)
- Deploy updated function
- Monitor data
- Get user feedback

## Success Criteria

✅ **Primary Goal**: John Roberts shows 2 leads instead of 0
✅ **Secondary Goal**: All clients show accurate, real-time data from Email Bison
✅ **Tertiary Goal**: Dashboard performance remains acceptable (<10s load time)

## Questions to Answer Before Starting

1. ✅ Does Email Bison have all the metrics we need? **YES** - `interested` field provides positive replies
2. ✅ Can we query historical data? **YES** - Date range parameters work
3. ✅ Do we still need Airtable? **YES** - For client list, workspace mapping, and targets only
4. ⚠️ Performance impact? **To be tested** - Sequential calls take time but already doing this for volume dashboard

## Next Steps

**Ready to proceed?** Choose an option:

**Option A - Quick Test (Recommended)**
1. I'll create a test function for John Roberts only
2. You verify it shows 2 leads
3. We expand to all clients

**Option B - Full Migration**
1. Skip testing phase
2. Update main function directly
3. Deploy and monitor

Which approach would you prefer?
