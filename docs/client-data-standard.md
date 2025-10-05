# Client Data Standardization Guide

**Purpose**: Define the canonical client data model for the Performance Command Center

**Last Updated**: October 2, 2025

---

## Overview

This guide establishes the **single source of truth** for client data across all dashboards, ensuring consistency, accuracy, and maintainability.

---

## Canonical Client Data Model

Every client in the Performance Command Center has these standardized properties:

### TypeScript Interface

```typescript
interface ClientData {
  // Identity
  id: string;                    // Airtable record ID
  name: string;                  // Client company name
  workspaceName?: string;        // Email Bison workspace name

  // KPI Metrics (Primary - from Airtable)
  monthlyKPI: number;            // Target positive replies per month
  leadsGenerated: number;        // Current month positive replies (MTD)
  projectedReplies: number;      // Projected end-of-month positive replies
  currentProgress: number;       // MTD progress (0-1 decimal, 0.75 = 75%)
  repliesProgress: number;       // Projected progress (0-1 decimal)

  // Time Period Comparisons (from Airtable)
  positiveRepliesLast30Days: number;    // Rolling 30-day window
  positiveRepliesLast7Days: number;     // Last 7 days
  positiveRepliesLast14Days: number;    // Days 14-7 ago
  positiveRepliesCurrentMonth: number;  // Current calendar month (backup)
  positiveRepliesLastMonth: number;     // Previous calendar month
  lastWeekVsWeekBeforeProgress: number; // Week-over-week % change
  positiveRepliesLastVsThisMonth: number; // Month-over-month % change

  // Volume Metrics (Email Bison API + Airtable)
  emailsSent: number;            // Real-time from Email Bison
  target: number;                // Monthly sending target from Airtable
  projection: number;            // Projected end-of-month volume from Airtable
  targetPercentage: number;      // (emailsSent / target) * 100
  projectedPercentage: number;   // (projection / target) * 100
  variance: number;              // emailsSent - target
  projectedVariance: number;     // projection - target
  isAboveTarget: boolean;        // emailsSent >= target
  isProjectedAboveTarget: boolean; // projection >= target

  // Supplemental Email Bison Metrics
  bounced?: number;              // Bounced emails
  interested?: number;           // Interested replies from Email Bison

  // Revenue (Billing)
  retainer?: number;             // Monthly retainer amount
  payout?: number;               // Performance-based payout
  pricePerLead?: number;         // Revenue per positive reply

  // Metadata
  repliesTarget?: number;        // Same as monthlyKPI (for compatibility)
  leadsTarget?: number;          // Deprecated, use monthlyKPI
}
```

---

## Field Definitions

### Identity Fields

| Field | Source | Type | Required | Description |
|-------|--------|------|----------|-------------|
| `id` | Airtable `Airtable ID` | string | ✅ Yes | Unique identifier (Record ID) |
| `name` | Airtable `Client Company Name` | string | ✅ Yes | Client company name |
| `workspaceName` | Airtable `Workspace Name` | string | ⚠️ Conditional | Required for active clients with Email Bison |

### KPI Metrics (Positive Replies)

| Field | Source | Formula/Logic | Data Type | Description |
|-------|--------|---------------|-----------|-------------|
| `monthlyKPI` | Airtable `Monthly KPI` | Manual input | number | Target positive replies for the month |
| `leadsGenerated` | Airtable `Positive Replies MTD` | Count field | number | **PRIMARY** - Month-to-date positive replies |
| `projectedReplies` | Airtable `Projection: Positive Replies Received (by EOM)` | Formula | number | Projected total by end of month |
| `currentProgress` | Airtable `MTD - Leads Generated Progress` | `MTD / KPI` | number (decimal) | Progress toward target (0.75 = 75%) |
| `repliesProgress` | Airtable `Projection Positive Replies % Progress` | `(Projection - KPI) / KPI` | number (decimal) | Projected vs target |

**Important Notes**:
- ⚠️ Use `Positive Replies MTD`, NOT `Positive Replies Current Month`
- ⚠️ Progress fields return decimals (0-1), NOT percentages (0-100)
- ✅ MTD fields should reset to 0 on the 1st of each month

### Time Period Fields

| Field | Source | Time Window | Data Type |
|-------|--------|-------------|-----------|
| `positiveRepliesLast30Days` | Airtable | Rolling 30 days from today | number |
| `positiveRepliesLast7Days` | Airtable | Last 7 days (today - 7 days) | number |
| `positiveRepliesLast14Days` | Airtable `Positive Replies Last 14-7 Days` | Days 14-7 ago | number |
| `positiveRepliesCurrentMonth` | Airtable | Current calendar month | number |
| `positiveRepliesLastMonth` | Airtable | Previous calendar month | number |
| `lastWeekVsWeekBeforeProgress` | Airtable | Formula: (Last7 - Last14-7) / Last14-7 | number (decimal) |
| `positiveRepliesLastVsThisMonth` | Airtable | Formula: (Current - Last) / Last * 100 | number |

**Comparison Logic**:
- **Last Week vs Week Before**: Compares last 7 days to days 14-7
- **This Month vs Last Month**: Compares current calendar month to previous

### Volume Metrics

| Field | Source | Calculation | Data Type |
|-------|--------|-------------|-----------|
| `emailsSent` | Email Bison API `emails_sent` | Real-time count | number |
| `target` | Airtable `Monthly Sending Target` | Manual input | number |
| `projection` | Airtable `Projection: Emails Sent by EOM` | Formula | number |
| `targetPercentage` | Calculated | `(emailsSent / target) * 100` | number |
| `projectedPercentage` | Calculated | `(projection / target) * 100` | number |
| `variance` | Calculated | `emailsSent - target` | number (can be negative) |
| `projectedVariance` | Calculated | `projection - target` | number (can be negative) |
| `isAboveTarget` | Calculated | `emailsSent >= target` | boolean |
| `isProjectedAboveTarget` | Calculated | `projection >= target` | boolean |

### Supplemental Metrics

| Field | Source | Description |
|-------|--------|-------------|
| `bounced` | Email Bison API `bounced` | Bounced email count |
| `interested` | Email Bison API `interested` | Interested reply count (Email Bison's metric) |

**Note**: `interested` from Email Bison may differ from `leadsGenerated` from Airtable due to filtering/classification differences.

### Revenue Fields

| Field | Source | Type | Description |
|-------|--------|------|-------------|
| `retainer` | Airtable `Retainer` | Currency | Monthly retainer amount |
| `payout` | Airtable `Payout` | Currency | Performance-based payout |
| `pricePerLead` | ⚠️ TODO: Add to Airtable | Currency | Revenue per positive reply |

**Calculated Revenue**:
```typescript
monthlyRevenue = retainer + (leadsGenerated * pricePerLead)
```

---

## Data Source Rules

### Primary vs Supplemental Sources

**Rule 1: KPI Metrics = Airtable Primary**
- Positive replies, targets, progress → Airtable is source of truth
- Email Bison API can supplement but Airtable wins in conflicts

**Rule 2: Volume Metrics = Email Bison Primary**
- Real-time email sends, bounces → Email Bison API is source of truth
- Airtable projections supplement but don't override actual Email Bison counts

**Rule 3: Cross-Validation**
- Monthly validation: Compare Airtable MTD counts to Email Bison interested counts
- If discrepancy > 10%, investigate and document reason

### Filter Rules

**Rule 4: Active Clients Only**
- Client must exist in BOTH Airtable AND Email Bison to appear in dashboards
- Workspace name in Airtable must match exactly with Email Bison workspace

**Rule 5: View Filtering**
- Use Airtable "Positive Replies" view to get only active KPI clients
- This filters out churned, paused, or infrastructure-only clients

---

## Naming Conventions

### Property Names (camelCase)

**Pattern**: `[metric][timePeriod]` or `[adjective][Metric]`

✅ **Good Examples**:
- `leadsGenerated` (clear, concise)
- `monthlyKPI` (includes time period)
- `projectedReplies` (descriptive adjective)
- `positiveRepliesLast7Days` (metric + specific time period)

❌ **Bad Examples**:
- `leads` (ambiguous - which time period?)
- `kpi` (not specific enough)
- `replies_last_week` (snake_case, not camelCase)
- `prPositiveLastVsThisMonth` (abbreviation "pr" unclear)

### Airtable Field Names (Title Case with Spaces)

**Pattern**: `[Metric] [Time Period]` or `[Calculation]: [Metric]`

✅ **Good Examples**:
- `Positive Replies MTD` (clear metric + time period)
- `Monthly KPI` (specific target)
- `Projection: Positive Replies Received (by EOM)` (calculation type + detail)

❌ **Bad Examples**:
- `PR MTD` (abbreviation)
- `Positive_Replies_MTD` (underscores in Airtable)
- `positive replies mtd` (inconsistent casing)

### Time Period Abbreviations

| Abbrev. | Full Name | Definition |
|---------|-----------|------------|
| MTD | Month-to-Date | From 1st of current month to today |
| EOM | End of Month | Last day of current month |
| Last X Days | Rolling Window | Today minus X days |
| Current Month | Calendar Month | 1st to last day of current month |
| Last Month | Previous Calendar Month | Full previous month |

---

## Edge Function Implementation

### Correct Pattern

```typescript
// supabase/functions/hybrid-workspace-analytics/index.ts

// Step 1: Fetch Airtable data
const airtableResponse = await fetch(
  `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}?view=Positive%20Replies`,
  { headers: { 'Authorization': `Bearer ${apiKey}` } }
);
const airtableData = await airtableResponse.json();

// Step 2: Fetch Email Bison workspace stats
const workspaceStats = await fetchAllWorkspaceStats(emailBisonApiKey);
const workspaceStatsMap = new Map(
  workspaceStats.map(ws => [ws.workspace_name, ws.stats])
);

// Step 3: Merge data - Airtable PRIMARY, Email Bison SUPPLEMENTAL
const clients = airtableData.records
  .filter(record => {
    const clientName = record.fields['Client Company Name'];
    // Only include clients with Email Bison workspaces
    return clientName && workspaceStatsMap.has(clientName);
  })
  .map(record => {
    const clientName = record.fields['Client Company Name'];
    const fields = record.fields;
    const bisonStats = workspaceStatsMap.get(clientName) || {};

    // Extract Airtable fields (use exact field names)
    const positiveRepliesMTD = fields['Positive Replies MTD'] || 0;
    const monthlyKPI = fields['Monthly KPI'] || 0;
    const projectedPositiveReplies = fields['Projection: Positive Replies Received (by EOM)'] || 0;
    const mtdProgress = fields['MTD - Leads Generated Progress'] || 0;
    const projectionProgress = fields['Projection Positive Replies % Progress'] || 0;

    // Time period fields
    const positiveRepliesLast30Days = fields['Positive Replies Last 30 Days'] || 0;
    const positiveRepliesLast7Days = fields['Positive Replies Last 7 Days'] || 0;
    const positiveRepliesLast14Days = fields['Positive Replies Last 14-7 Days'] || 0;
    const positiveRepliesCurrentMonth = fields['Positive Replies Current Month'] || 0;
    const positiveRepliesLastMonth = fields['Positive Replies Last Month'] || 0;

    // Comparison formulas
    const lastWeekVsWeekBeforeProgress = fields['Last Week VS Week Before Positive Replies % Progress'] || 0;
    const positiveRepliesLastVsThisMonth = parseFloat(fields['Positive Replies Last VS This Month']) || 0;

    // Volume fields
    const monthlyTarget = fields['Monthly Sending Target'] || 0;
    const projection = fields['Projection: Emails Sent by EOM'] || 0;

    // Revenue fields
    const retainer = fields['Retainer'] || 0;
    const payout = fields['Payout'] || 0;

    // Email Bison supplemental
    const emailsSent = bisonStats.emails_sent || 0;
    const bounced = bisonStats.bounced || 0;
    const interested = bisonStats.interested || 0;

    // Return standardized client data model
    return {
      id: record.id,
      name: clientName,

      // KPI Metrics (Airtable primary)
      monthlyKPI,
      leadsGenerated: positiveRepliesMTD,  // ⚠️ Use MTD, not Current Month
      projectedReplies: projectedPositiveReplies,
      currentProgress: mtdProgress,  // ⚠️ Already decimal, don't divide by 100
      repliesProgress: projectionProgress,  // ⚠️ Already decimal

      // Time periods
      positiveRepliesLast30Days,
      positiveRepliesLast7Days,
      positiveRepliesLast14Days,
      positiveRepliesCurrentMonth,
      positiveRepliesLastMonth,
      lastWeekVsWeekBeforeProgress,
      positiveRepliesLastVsThisMonth,

      // Volume (Email Bison primary for actual, Airtable for target/projection)
      emailsSent,
      target: monthlyTarget,
      projection,
      targetPercentage: monthlyTarget > 0 ? (emailsSent / monthlyTarget) * 100 : 0,
      projectedPercentage: monthlyTarget > 0 ? (projection / monthlyTarget) * 100 : 0,
      variance: emailsSent - monthlyTarget,
      projectedVariance: projection - monthlyTarget,
      isAboveTarget: emailsSent >= monthlyTarget,
      isProjectedAboveTarget: projection >= monthlyTarget,

      // Supplemental
      bounced,
      interested,

      // Revenue
      payout,

      // Compatibility
      repliesTarget: monthlyKPI,
      leadsTarget: 0,  // Deprecated
    };
  });

return { clients };
```

### Common Mistakes

❌ **Wrong field name**:
```typescript
const mtd = fields['Positive Replies - MTD']; // Dash instead of space
```

❌ **Double-dividing percentages**:
```typescript
const progress = fields['MTD - Leads Generated Progress'] / 100;
// Already a decimal! Would make 75% into 0.75%
```

❌ **Not filtering for workspaces**:
```typescript
// Missing filter - would show clients without workspaces
const clients = airtableData.records.map(...);
```

❌ **Using wrong time field**:
```typescript
leadsGenerated: fields['Positive Replies Current Month']
// Should use MTD!
```

---

## Dashboard Component Guidelines

### Display Formatting

**Progress Percentages**:
```typescript
// Value from Airtable: 0.7542 (75.42%)
const displayValue = `${Math.round(currentProgress * 100)}%`;
// Output: "75%"

// Or for more precision:
const displayValue = `${(currentProgress * 100).toFixed(1)}%`;
// Output: "75.4%"
```

**Currency**:
```typescript
const displayValue = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
}).format(retainer);
// Output: "$5,000"
```

**Large Numbers**:
```typescript
const displayValue = emailsSent.toLocaleString('en-US');
// Output: "127,543"
```

### Status Badge Logic

**KPI Performance Status**:
```typescript
function getPerformanceStatus(client: ClientData): 'above-target' | 'on-track' | 'below-target' {
  if (client.leadsGenerated >= client.monthlyKPI) {
    return 'above-target';  // Already met target
  }
  if (client.projectedReplies >= client.monthlyKPI) {
    return 'on-track';  // Projected to meet target
  }
  return 'below-target';  // Projected to miss target
}
```

**Volume Performance Status**:
```typescript
function getVolumeStatus(client: ClientData): 'above-target' | 'on-track' | 'below-target' {
  if (client.isAboveTarget) {
    return 'above-target';
  }
  if (client.isProjectedAboveTarget) {
    return 'on-track';
  }
  return 'below-target';
}
```

### Sorting Clients

**By Performance (Best to Worst)**:
```typescript
clients.sort((a, b) => {
  // Clients meeting target first
  const aMeetsTarget = a.leadsGenerated >= a.monthlyKPI;
  const bMeetsTarget = b.leadsGenerated >= b.monthlyKPI;

  if (aMeetsTarget && !bMeetsTarget) return -1;
  if (!aMeetsTarget && bMeetsTarget) return 1;

  // Then by progress percentage
  return b.currentProgress - a.currentProgress;
});
```

---

## Validation & Testing

### Data Quality Checks

**1. MTD Reset Validation** (Run on 1st of month):
```typescript
// All clients should have MTD = 0 on the 1st
const today = new Date();
if (today.getDate() === 1) {
  clients.forEach(client => {
    if (client.leadsGenerated !== 0) {
      console.error(`MTD not reset for ${client.name}: ${client.leadsGenerated}`);
    }
  });
}
```

**2. Cross-Reference Airtable vs Email Bison**:
```typescript
clients.forEach(client => {
  const discrepancy = Math.abs(client.leadsGenerated - (client.interested || 0));
  if (discrepancy > 5) {
    console.warn(`Large discrepancy for ${client.name}: Airtable=${client.leadsGenerated}, Bison=${client.interested}`);
  }
});
```

**3. Progress Percentage Sanity Check**:
```typescript
clients.forEach(client => {
  if (client.currentProgress < 0 || client.currentProgress > 2) {
    console.error(`Invalid progress for ${client.name}: ${client.currentProgress}`);
  }
});
```

---

## Migration Checklist

When adding a new dashboard or updating existing ones:

- [ ] Use `ClientData` TypeScript interface from this guide
- [ ] Extract all fields using standardized property names
- [ ] Use `Positive Replies MTD` (NOT `Current Month`)
- [ ] Do NOT divide progress percentages by 100
- [ ] Filter clients to those with Email Bison workspaces
- [ ] Use Airtable "Positive Replies" view
- [ ] Add debug logging showing field values
- [ ] Validate data on 1st of month
- [ ] Cross-reference with Email Bison API
- [ ] Add error handling for missing fields
- [ ] Document any field formula dependencies

---

## Summary

**Key Rules**:
1. ✅ Airtable is PRIMARY for KPIs, Email Bison is PRIMARY for volume
2. ✅ Use `Positive Replies MTD`, not `Positive Replies Current Month`
3. ✅ Progress fields are decimals (0-1), not percentages (0-100)
4. ✅ Only show clients with BOTH Airtable record AND Email Bison workspace
5. ✅ Use exact Airtable field names (case-sensitive, emoji-sensitive)
6. ✅ Filter using "Positive Replies" view
7. ✅ Validate MTD reset on 1st of each month

**Anti-Patterns**:
- ❌ Dividing Airtable progress by 100
- ❌ Using `Positive Replies Current Month` as primary source
- ❌ Showing clients without Email Bison workspaces
- ❌ Hardcoding field names without standardization
- ❌ Missing error handling for null/undefined fields

---

**Status**: ✅ Standardization complete, ready for implementation
