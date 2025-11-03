# SMA Insurance Commission Tracking - Local Setup Guide

This guide will help you set up and test the new SMA Insurance commission tracking features in your local development environment.

## Overview

The SMA Insurance commission tracking system adds:
1. Multiple policies per lead with individual commission tracking
2. Total Premium Closed KPI card
3. Total Commission to SMA KPI card
4. Total Commission to Maverick KPI card (auto-calculated as 20% of SMA commission)

These features **only appear for the "SMA Insurance" workspace** and do not affect other clients.

---

## Prerequisites

- Node.js installed (v18 or higher)
- Supabase CLI installed (`brew install supabase/tap/supabase` on macOS)
- Access to the project repository
- `.env` file configured with Supabase credentials

---

## Setup Steps

### Step 1: Install Dependencies

```bash
npm install
```

### Step 2: Start Local Supabase Instance

```bash
# Start local Supabase (this includes PostgreSQL, Auth, Storage, etc.)
supabase start
```

This will output something like:
```
API URL: http://127.0.0.1:54321
GraphQL URL: http://127.0.0.1:54321/graphql/v1
DB URL: postgresql://postgres:postgres@127.0.0.1:54322/postgres
Studio URL: http://127.0.0.1:54323
Anon key: eyJhbGc...
Service role key: eyJhbGc...
```

### Step 3: Configure Environment Variables

Create or update `.env.local`:

```bash
# Copy from .env.example if needed
cp .env.example .env.local
```

Update with your **local Supabase** credentials:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<your-local-anon-key-from-supabase-start>
```

### Step 4: Run Database Migrations

```bash
# This applies all migrations including the new sma_policies table
supabase db push
```

You should see output confirming the migration was applied:
```
✔ All migrations have been applied
```

### Step 5: Seed Test Data

Run the seed script to create sample SMA Insurance leads and policies:

```bash
npx tsx scripts/seed-sma-test-data.ts
```

Expected output:
```
🌱 Starting SMA Insurance data seeding...

📋 Checking for SMA Insurance in client_registry...
✅ SMA Insurance created in client_registry

👥 Creating test leads...
✅ Created 4 test leads

📄 Creating test policies...
✅ Created 4 test policies

📊 Summary:
────────────────────────────────────────────────────────────
Policy: Auto
Lead: John Doe
Premium: $2,500
Agency Commission: $375
Maverick Commission: $75.00 (20%)
────────────────────────────────────────────────────────────
...

📈 TOTALS:
   Total Premium: $23,200
   Total Agency Commission: $3,480
   Total Maverick Commission: $696.00

✅ SMA Insurance test data seeded successfully!
```

### Step 6: Start Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or the port shown in terminal).

---

## Testing the Features

### 1. Navigate to SMA Insurance Portal

1. Open browser to `http://localhost:5173`
2. Log in (if authentication is enabled)
3. Go to **Client Portal**
4. Select **SMA Insurance** workspace

### 2. Verify KPI Cards

You should see **3 commission-specific KPI cards** instead of the standard 4:

- **Total Premium Closed**: Shows total of all policy premiums
- **Total Commission to SMA**: Shows total agency commissions
- **Total Commission to Maverick**: Shows 20% of SMA commission

Expected values (from seed data):
- Total Premium: $23,200
- Total Commission to SMA: $3,480
- Total Commission to Maverick: $696.00

### 3. Test Kanban Board with Policies

#### View Existing Won Deals:
1. Look for "Won" column
2. Click on **John Doe** or **Robert Johnson** leads
3. Modal should show:
   - **Policies section** (instead of standard Premium/Policy Type fields)
   - Table of all policies with commissions
   - Summary cards showing totals for that lead

#### Add a New Won Deal:
1. Drag any lead from "Interested" or "Quoting" to **"Won"** column
2. **SMA Policies Dialog** should appear (not standard Premium dialog)
3. Test adding multiple policies:
   - Policy #1: Auto Insurance, $3,000 premium, $450 commission
   - Click "Add Another Policy"
   - Policy #2: Home Insurance, $5,000 premium, $750 commission
4. Verify:
   - Maverick commission auto-calculates (20% of each)
   - Deal Summary shows totals
5. Click "Save 2 Policies"
6. Lead should move to Won column
7. KPI cards should update with new totals

### 4. Test Policy Management in Lead Detail Modal

1. Click on a won lead
2. In the modal, find the **Policies** section
3. Test:
   - **Add Policy**: Click "Add Policy" button (if implemented)
   - **Delete Policy**: Click trash icon on any policy
   - **View Totals**: Verify summary cards update

### 5. Compare with Other Workspaces

1. Switch to a different workspace (e.g., "Kim Wallace")
2. Verify:
   - Standard 4 KPI cards appear
   - Standard Premium Input Dialog (not SMA policies dialog)
   - No policies section in lead detail modal

---

## Database Inspection

### Using Supabase Studio

1. Open `http://127.0.0.1:54323` in browser
2. Navigate to **Table Editor**
3. Inspect tables:
   - `client_leads`: See SMA Insurance leads
   - `sma_policies`: See all policies with auto-calculated maverick_commission
   - `client_registry`: Verify SMA Insurance entry

### Using SQL Queries

Open SQL Editor in Supabase Studio or use `psql`:

```sql
-- View all SMA policies with lead names
SELECT
  cl.first_name || ' ' || cl.last_name as lead_name,
  sp.policy_type,
  sp.premium_amount,
  sp.agency_commission,
  sp.maverick_commission
FROM sma_policies sp
JOIN client_leads cl ON sp.lead_id = cl.id
ORDER BY cl.last_name;

-- Get commission summary
SELECT
  COUNT(*) as policy_count,
  SUM(premium_amount) as total_premium,
  SUM(agency_commission) as total_agency_commission,
  SUM(maverick_commission) as total_maverick_commission
FROM sma_policies
WHERE workspace_name = 'SMA Insurance';
```

---

## Troubleshooting

### Issue: Migration fails with "relation already exists"

**Solution**: Reset local database
```bash
supabase db reset
```
This will drop all tables and reapply migrations from scratch.

### Issue: Seed script fails with authentication error

**Solution**: Check environment variables
```bash
# Verify .env.local has correct local Supabase credentials
cat .env.local
```

### Issue: KPI cards show $0

**Solution**:
1. Check if policies were created: Open Supabase Studio → `sma_policies` table
2. Re-run seed script: `npx tsx scripts/seed-sma-test-data.ts`
3. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+F5)

### Issue: Policies don't appear in lead detail modal

**Solution**:
1. Verify lead has `workspace_name = "SMA Insurance"`
2. Check browser console for errors
3. Verify policies exist for that lead_id in database

### Issue: TypeScript errors in IDE

**Solution**:
```bash
# Regenerate Supabase types
npm run types:generate
```

---

## File Structure

New files created for SMA features:

```
src/
├── components/sma/
│   ├── SMACommissionKPICards.tsx      # 3 KPI cards for commission tracking
│   ├── SMAPoliciesInputDialog.tsx     # Multi-policy input form
│   └── SMAPoliciesList.tsx            # Policies table in lead modal
├── services/
│   └── smaPoliciesService.ts          # CRUD operations for policies
├── types/
│   └── sma.ts                         # TypeScript interfaces
supabase/migrations/
└── 20251031000000_create_sma_policies.sql  # Database schema
scripts/
└── seed-sma-test-data.ts              # Test data seeding
```

Modified files:
- `src/pages/ClientPortalPage.tsx` - Conditional SMA features
- `src/components/client-portal/LeadDetailModal.tsx` - Policies section

---

## Testing Checklist

Before deploying to production, verify:

- [ ] SMA Insurance KPI cards display correct totals
- [ ] Dragging lead to Won opens SMA Policies Dialog
- [ ] Can add multiple policies with different types
- [ ] Maverick commission auto-calculates as 20%
- [ ] Policies appear in lead detail modal
- [ ] Can delete policies from modal
- [ ] KPI cards update after adding/deleting policies
- [ ] Other workspaces show standard features (not SMA)
- [ ] No TypeScript errors in console
- [ ] Database migration runs successfully

---

## Next Steps

### Deploying to Production

1. **Push Migration**:
   ```bash
   # This applies migration to remote Supabase instance
   supabase db push --linked
   ```

2. **Deploy Code**:
   ```bash
   # Commit all changes
   git add .
   git commit -m "feat: Add SMA Insurance commission tracking"
   git push origin main
   ```

3. **Verify in Production**:
   - Navigate to production SMA Insurance portal
   - Confirm KPI cards show correct data
   - Test adding new won deals with policies

### Optional Enhancements

Future improvements you might consider:
- Add date range filter to KPI cards (all-time vs. monthly)
- Export policies to CSV
- Commission history tracking
- Policy edit functionality (currently create/delete only)
- Bulk policy import
- Commission percentage configuration per workspace

---

## Support

If you encounter issues:
1. Check browser console for errors
2. Review Supabase logs in Studio
3. Verify database schema matches migration
4. Ensure `.env.local` has correct credentials
5. Try resetting local database: `supabase db reset`

---

**Happy Testing! 🎉**
