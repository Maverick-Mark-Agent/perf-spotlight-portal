# Phase 1: Resolve Schema Conflicts & Run Migrations

**Milestone:** Foundation
**Estimated Effort:** 2-3 hours
**Dependencies:** None
**Blocks:** All phases (2-20)

---

## Overview

Fix duplicate table definitions for `client_zipcodes` and `monthly_cleaned_leads` that exist in both the agent tables migration and standalone migrations. Merge into single source of truth and ensure all migrations run successfully.

---

## Current Issues

### Issue 1: Duplicate `client_zipcodes` Schema
- **File 1:** `supabase/migrations/20251005200000_create_agent_tables.sql` (lines 149-166)
  - Has: `state`, `agent_run_id`, unique constraint on `(workspace_name, month, zip)`
- **File 2:** `supabase/migrations/20251005203000_create_client_zipcodes.sql`
  - Has: `source`, `pulled_at`, different indexes
  - Missing: `state`, `agent_run_id`

### Issue 2: Duplicate `monthly_cleaned_leads` Schema
- **File 1:** `supabase/migrations/20251005200000_create_agent_tables.sql` (lines 171-187)
  - Has: `target_count`, `gap` (generated column)
- **File 2:** `supabase/migrations/20251005203100_create_monthly_cleaned_leads.sql`
  - Missing: `target_count`, `gap`

---

## Scope

### In Scope
- Merge duplicate `client_zipcodes` schema into single migration
- Merge duplicate `monthly_cleaned_leads` schema into single migration
- Run all migrations in correct order
- Verify tables exist and match ZipDashboard expectations
- Test dashboard can query both tables

### Out of Scope
- Creating new migrations (focus on fixing existing)
- Modifying other agent tables
- Data migration (no existing data to migrate yet)

---

## Tasks

### Task 1: Merge `client_zipcodes` Schema
**Files to modify:**
- `supabase/migrations/20251005203000_create_client_zipcodes.sql` (primary)
- `supabase/migrations/20251005200000_create_agent_tables.sql` (remove duplicate)

**Actions:**
1. Update `20251005203000_create_client_zipcodes.sql` to include all fields:
   ```sql
   create table if not exists public.client_zipcodes (
     id bigserial primary key,
     client_name text not null,
     workspace_name text,
     month text not null,
     zip text not null,
     state text,
     source text default 'csv',
     pulled_at timestamptz default now(),
     agent_run_id uuid references public.agent_runs(run_id) on delete set null,
     inserted_at timestamptz default now()
   );
   ```

2. Add indexes:
   ```sql
   create index if not exists client_zipcodes_client_month_idx on public.client_zipcodes (client_name, month);
   create index if not exists client_zipcodes_ws_month_idx on public.client_zipcodes (workspace_name, month);
   create index if not exists client_zipcodes_zip_idx on public.client_zipcodes (zip);
   create index if not exists client_zipcodes_state_idx on public.client_zipcodes (state);
   create unique index if not exists client_zipcodes_unique on public.client_zipcodes (coalesce(workspace_name, client_name), month, zip);
   ```

3. Remove `client_zipcodes` section from `20251005200000_create_agent_tables.sql` (lines 146-167)

**Acceptance:**
- [ ] Single `client_zipcodes` definition exists
- [ ] Includes all fields: `state`, `source`, `agent_run_id`, `pulled_at`
- [ ] Has unique constraint on `(workspace_name/client_name, month, zip)`

---

### Task 2: Merge `monthly_cleaned_leads` Schema
**Files to modify:**
- `supabase/migrations/20251005203100_create_monthly_cleaned_leads.sql` (primary)
- `supabase/migrations/20251005200000_create_agent_tables.sql` (remove duplicate)

**Actions:**
1. Update `20251005203100_create_monthly_cleaned_leads.sql`:
   ```sql
   create table if not exists public.monthly_cleaned_leads (
     id bigserial primary key,
     client_name text not null,
     workspace_name text,
     month text not null,
     cleaned_count integer not null default 0,
     target_count integer,
     gap integer generated always as (coalesce(target_count, 0) - cleaned_count) stored,
     source text default 'clay',
     noted_at timestamptz default now(),
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );
   ```

2. Add unique index:
   ```sql
   create unique index if not exists monthly_cleaned_leads_ws_month_uidx
     on public.monthly_cleaned_leads (coalesce(workspace_name, client_name), month);
   ```

3. Remove `monthly_cleaned_leads` section from `20251005200000_create_agent_tables.sql` (lines 170-188)

**Acceptance:**
- [ ] Single `monthly_cleaned_leads` definition exists
- [ ] Includes `target_count` and `gap` generated column
- [ ] Has unique constraint on `(workspace_name/client_name, month)`

---

### Task 3: Update `agent_run_id` Reference
**Files to modify:**
- `supabase/migrations/20251005203000_create_client_zipcodes.sql`

**Actions:**
1. Ensure `client_zipcodes` is created AFTER `agent_runs` table
2. Update migration order if needed (rename file to `20251005203500_create_client_zipcodes.sql` to run after agent tables)

**Acceptance:**
- [ ] Foreign key constraint works (agent_runs table exists when client_zipcodes is created)
- [ ] No migration errors related to missing tables

---

### Task 4: Run All Migrations
**Commands:**
```bash
# Reset local database (WARNING: deletes all data)
npx supabase db reset

# Or push migrations to remote
npx supabase db push
```

**Actions:**
1. Test locally first with `db reset`
2. Verify all migrations run without errors
3. Check migration order in Supabase dashboard
4. Confirm tables exist with correct schemas

**Acceptance:**
- [ ] All migrations run successfully
- [ ] No duplicate table errors
- [ ] `client_zipcodes` and `monthly_cleaned_leads` tables exist
- [ ] All indexes created

---

### Task 5: Verify Dashboard Compatibility
**Files to test:**
- `src/pages/ZipDashboard.tsx`

**Actions:**
1. Start dev server: `npm run dev`
2. Navigate to `/zip-dashboard`
3. Select a month (e.g., 2025-11)
4. Verify no errors in console
5. Test with empty data (should show "No data" message)
6. Import test data using `import-zip-codes.mjs`
7. Verify data displays correctly

**Acceptance:**
- [ ] Dashboard loads without errors
- [ ] Queries `client_zipcodes` and `monthly_cleaned_leads` successfully
- [ ] Shows message when no data exists
- [ ] Displays data correctly after import

---

## Definition of Done

- [ ] `client_zipcodes` schema merged into single migration file
- [ ] `monthly_cleaned_leads` schema merged into single migration file
- [ ] Duplicate sections removed from `20251005200000_create_agent_tables.sql`
- [ ] All migrations run successfully (no errors)
- [ ] Tables exist in Supabase with correct schemas
- [ ] All indexes and constraints created
- [ ] ZipDashboard queries both tables without errors
- [ ] Foreign key constraint on `agent_run_id` works

---

## Validation Commands

```bash
# Check migration status
npx supabase migration list

# Run migrations
npx supabase db reset  # Local only
npx supabase db push   # Remote

# Verify tables exist
npx supabase db diff   # Should show no differences

# Query tables directly
psql $DATABASE_URL -c "SELECT COUNT(*) FROM client_zipcodes;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM monthly_cleaned_leads;"

# Check indexes
psql $DATABASE_URL -c "\d client_zipcodes"
psql $DATABASE_URL -c "\d monthly_cleaned_leads"

# Test dashboard
npm run dev
# Navigate to http://localhost:5173/zip-dashboard
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Migration order causes FK constraint failures | Rename migration files to ensure `agent_runs` created before `client_zipcodes` |
| Existing data lost during schema merge | Backup data first, test with `db reset` locally |
| Dashboard queries fail after schema changes | Test ZipDashboard thoroughly, update queries if needed |
| Other migrations depend on old schema | Review all migrations for dependencies, update references |

---

## Files Modified

- `supabase/migrations/20251005200000_create_agent_tables.sql` (remove duplicates)
- `supabase/migrations/20251005203000_create_client_zipcodes.sql` (merge schema)
- `supabase/migrations/20251005203100_create_monthly_cleaned_leads.sql` (merge schema)

---

## Next Phase

**Phase 2:** Install Dependencies & Configure TypeScript
- Requires Phase 1 complete (schema stable)
- Will generate TypeScript types from merged schema
