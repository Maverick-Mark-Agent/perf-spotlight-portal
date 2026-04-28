# Daily Recap Table — KPI Dashboard

**Date:** 2026-04-28
**Status:** approved (localhost-first build)
**Author:** Kit (AI), Tommy

## Problem

The KPI/Volume dashboard shows aggregate "today" and "tomorrow" send volumes
but no per-workspace recap of yesterday's actual performance. Today's revenue
page is also unreliable because `client_leads.lead_value` is rarely populated
(see related session 2026-04-27 finding). Operators need a single end-of-day
view that confirms, per workspace:

- emails sent
- replies received
- interested leads received
- expected billable revenue

This view should sit immediately below the existing `DailyVolumeBanner`.

## Scope (locked)

| Decision | Choice |
|---|---|
| Default view | Yesterday (CST) |
| Date range | Last 30 days, via date picker |
| Layout | Two sortable tables: `per_lead` clients, then `retainer` |
| Workspaces shown | All `is_active = true` |
| Display format | Table (matches existing dashboard aesthetic) |
| Build approach | Local-first; client-side queries (no migration) |

## Architecture

```
KPIDashboard.tsx
  └─ <DailyVolumeBanner />          (existing, unchanged)
  └─ <DailyRecapTable />            (NEW)
        ├─ Date picker (default yesterday CST, 30-day max range)
        ├─ useDailyRecap(targetDate) (NEW hook)
        └─ Two sortable tables: per_lead, retainer + totals row each
```

### Data sources

All three metrics come from existing tables — no new tables, no migration
in v1.

| Metric | Source | Filter |
|---|---|---|
| `emails_sent` | `client_metrics.emails_sent_mtd` (target) − `client_metrics.emails_sent_mtd` (target − 1) | `metric_date` IN (target, target-1) |
| `replies_received` | `lead_replies` count | `(reply_date AT TIME ZONE 'America/Chicago')::date = target` |
| `interested_leads` | `client_leads` count | `interested = true AND deleted_at IS NULL AND (interested_at AT TIME ZONE 'America/Chicago')::date = target` |
| `expected_revenue` | `client_registry.price_per_lead × interested_leads` | derived client-side |

**Why MTD-diff for sends:** the `client_metrics.emails_sent_today` column is
permanently 0 across all workspaces (last 7+ days verified). The
`emails_sent_mtd` column increments correctly. Subtracting day-over-day MTD
gives mathematically correct per-day sends and is self-healing if
historical MTD numbers are backfilled or corrected.

### Hook: `useDailyRecap(targetDate)`

Three parallel queries through `supabase-js`:

1. `client_metrics` rows where `metric_date IN (targetDate, targetDate - 1)`
2. `lead_replies` aggregated by `workspace_name` for the target CST day
3. `client_leads` aggregated by `workspace_name` for the target CST day,
   filtered on `interested = true AND deleted_at IS NULL`

Plus a one-time `client_registry` fetch for active workspaces and prices
(can use existing `useClientRegistry` if it exists, otherwise inline).

Returns:

```ts
type DailyRecapRow = {
  workspaceName: string;
  displayName: string;
  billingType: 'per_lead' | 'retainer';
  pricePerLead: number;
  emailsSent: number;
  repliesReceived: number;
  interestedLeads: number;
  expectedRevenue: number; // pricePerLead × interestedLeads
};

type DailyRecapResult = {
  perLead: DailyRecapRow[];
  retainer: DailyRecapRow[];
  totals: {
    perLead: { emails: number; replies: number; leads: number; revenue: number };
    retainer: { emails: number; replies: number; leads: number; revenue: number };
  };
  freshnessUtc: string | null; // max(client_metrics.updated_at) for target
  loading: boolean;
  error: Error | null;
};
```

React Query key: `['daily-recap', targetDate]`. Stale time: 5 minutes
(matches the cadence at which `client_metrics` is synced).

### Component: `DailyRecapTable`

Lives at `src/components/dashboard/DailyRecapTable.tsx`.

Layout:

```
┌────────────────────────────────────────────────────────────────┐
│ Daily Recap          [< Yesterday  Apr 27, 2026  >]  [📅 Picker]│
│ Synced: 16:57 CST                                              │
├────────────────────────────────────────────────────────────────┤
│ Per-Lead Clients                                               │
│ ┌───────────┬────────┬─────────┬───────────┬──────────────┐    │
│ │ Workspace │ Sent ▼ │ Replies │ Interested│ Expected $   │    │
│ ├───────────┼────────┼─────────┼───────────┼──────────────┤    │
│ │ Gaudio    │ 10,111 │      19 │         5 │       $100   │    │
│ │ Nick Sakha│  7,922 │      23 │         7 │       $140   │    │
│ │ ...       │   ...  │     ... │       ... │        ...   │    │
│ ├───────────┼────────┼─────────┼───────────┼──────────────┤    │
│ │ TOTAL     │ 78,123 │     298 │        45 │      $1,040  │    │
│ └───────────┴────────┴─────────┴───────────┴──────────────┘    │
│                                                                │
│ Retainer Clients                                               │
│ (same shape, expected $ column hidden or shown as N/A)         │
└────────────────────────────────────────────────────────────────┘
```

### UX details

- Default sort: `emails_sent DESC`. Click any column to re-sort.
- Date picker: shadcn `<Popover>` + `<Calendar>` with `disabled` past 30
  days and `disabled` future dates.
- Quick "Yesterday" button always visible next to the picker.
- Loading state: skeleton matching the existing `KPICard` skeleton pattern.
- Empty state: if `targetDate` has no data (e.g., workspace was inactive),
  show a single zero-row.
- Freshness label: "Synced: HH:mm CST" using `max(client_metrics.updated_at)`.
- Retainer table hides the `Expected $` column (or shows "—") since
  retainers don't bill per lead.

## What's out of scope

- Fixing the broken `client_metrics.emails_sent_today` populator —
  workaround via MTD-diff is sufficient.
- Adding the `get_daily_workspace_recap` RPC — defer until the UI is
  validated. We may add it later for perf and Slack-DM reusability.
- End-of-day Slack DM with this data — possible future work, would reuse
  the same query/RPC.
- Backfilling `client_leads.lead_value` for historical leads — separate
  ticket.
- Click-row-to-drill-down behavior — out of v1; can be added once the
  table proves out.

## Validation gate

Before any production deploy:

1. Run spotlight portal locally (`bun dev` or `npm run dev`).
2. Open `http://localhost:5173/kpi-dashboard` (or whatever the local URL
   is for that page).
3. Verify yesterday's totals against the chat numbers from the
   2026-04-27 session (matched: 50 interested, ~$1,040 expected revenue).
4. Step backward in the date picker to a known day, confirm reasonable
   numbers.
5. Check both per_lead and retainer sections render correctly.
6. Check sort, totals row, freshness label.

If validation passes, the only remaining choice is whether to ship
client-side (current build) or upgrade to an RPC. Both are correct;
RPC is a perf/reusability optimization.

## Risk / rollback

- **No migration**, so no schema rollback risk.
- Component is additive; if it breaks the dashboard, comment out the
  `<DailyRecapTable />` line in `KPIDashboard.tsx` to revert.
- All queries are read-only.

## File touch list

- `src/hooks/useDailyRecap.ts` (NEW)
- `src/components/dashboard/DailyRecapTable.tsx` (NEW)
- `src/pages/KPIDashboard.tsx` (one-line addition)
