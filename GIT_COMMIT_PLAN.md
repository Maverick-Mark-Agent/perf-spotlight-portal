# Git Commit Plan - KPI Dashboard Fix

## Overview
This commit fixes the KPI Dashboard data pipeline by creating the missing cron job and adding comprehensive monitoring tools.

---

## Files to Commit

### 1. Core Fix - Monitoring & Operational Scripts ⭐

**Essential operational tools** (MUST commit):
```
scripts/manually-trigger-kpi-sync.ts        # Manual sync trigger (primary tool)
scripts/check-kpi-sync-status.ts            # Health check script
scripts/verify-client-metrics-today.ts      # Data verification
scripts/verify-client-metrics-recent.ts     # Historical data check
```

**Investigation tools** (commit for future debugging):
```
scripts/check-pg-cron-simple.ts             # Cron job status checker
scripts/investigate-sync-daily-kpi.ts       # Database investigation
scripts/create-cron-job-direct.ts           # SQL generator for cron setup
scripts/list-available-tables.ts            # Database discovery tool
```

**SQL & Bash utilities**:
```
scripts/check-cron-job-status.sql           # SQL queries for monitoring
scripts/check-supabase-cron-access.sh       # Permission checker
```

### 2. Edge Functions (Deployed)

**New monitoring functions**:
```
supabase/functions/check-cron-status/       # Cron status API (deployed)
supabase/functions/setup-cron-job/          # Cron setup helper (optional)
```

### 3. Documentation

**Primary documentation**:
```
docs/KPI_DASHBOARD_FIX_COMPLETE.md          # Complete fix documentation
INVESTIGATION_REPORT_SYNC_DAILY_KPI.md      # Detailed investigation report
```

---

## Files to EXCLUDE

### Other Work in Progress (separate commits)

**Webhook-related scripts** (separate commit):
```
scripts/add-devin-missing-lead.ts
scripts/check-missing-contacts.ts
scripts/check-webhook-logs.ts
scripts/check-webhook-status.ts
scripts/create-workspace-webhooks.ts
scripts/fetch-complete-lead-data.ts
scripts/fix-workspace-name-mismatches.ts
scripts/investigate-devin-lead.ts
scripts/show-where-contacts-appear.ts
scripts/test-webhook-delivery.ts
scripts/verify-contacts-in-db.ts
scripts/verify-dashboard-data-sources.ts
scripts/verify-final-contact-data.ts
```

**Webhook documentation** (separate commit):
```
docs/API_KEY_USAGE_GUIDE.md
docs/WEBHOOK_IMPLEMENTATION_COMPLETE.md
```

**Zip pipeline** (separate commit):
```
supabase/functions/deploy-zip-pipeline/
supabase/functions/initialize-zip-batches/
supabase/functions/setup-zip-pipeline/
src/components/ZipBatchUploadModal.tsx
```

**Revenue billing** (separate commit):
```
supabase/functions/revenue-billing-unified/
docs/CORRECTED_REVENUE_BILLING_PLAN.md
docs/REVENUE_BILLING_DASHBOARD_ANALYSIS.md
```

### Modified Files (need review)

**Modified source files** (check if related to KPI fix):
```
src/App.tsx                                 # Review changes
src/components/AppSidebar.tsx               # Review changes
src/components/StateLeadsAnalytics.tsx      # Review changes
src/contexts/DashboardContext.tsx           # Review changes
src/lib/dataValidation.ts                   # Review changes
src/pages/ContactPipelineDashboard.tsx      # Review changes
src/pages/RevenueDashboard.tsx              # Review changes
src/services/dataService.ts                 # Review changes
supabase/functions/universal-bison-webhook/index.ts  # Review changes
```

---

## Commit Strategy

### Option 1: Single Comprehensive Commit (Recommended)
**One commit with all KPI dashboard fixes**

Benefits:
- Complete fix in one atomic commit
- Easy to understand what was done
- Clear before/after state

Commit message:
```
fix: Resolve KPI Dashboard data pipeline issue

Root cause: The daily-kpi-metrics-sync cron job was never created in production,
causing client_metrics table to become stale.

Changes:
- Created pg_cron job (ID: 5) to run sync-daily-kpi-metrics daily at 12:01 AM UTC
- Added manually-trigger-kpi-sync.ts for immediate data population
- Added comprehensive monitoring and verification scripts
- Documented complete fix and troubleshooting procedures

The dashboard now automatically updates daily with fresh metrics data.

Resolves #[issue-number]
```

Files to include:
- All KPI-related scripts (listed above)
- New Edge Functions (check-cron-status)
- Documentation (KPI_DASHBOARD_FIX_COMPLETE.md, INVESTIGATION_REPORT)
- Any src/ changes that are KPI-related

### Option 2: Separate Commits
**Multiple focused commits**

1. **Commit 1: Monitoring Scripts**
   - Add all scripts/check-*.ts files
   - Add scripts/verify-*.ts files
   - Add scripts/manually-trigger-kpi-sync.ts

2. **Commit 2: Edge Functions**
   - Add supabase/functions/check-cron-status/
   - Add supabase/functions/setup-cron-job/

3. **Commit 3: Documentation**
   - Add docs/KPI_DASHBOARD_FIX_COMPLETE.md
   - Add INVESTIGATION_REPORT_SYNC_DAILY_KPI.md

4. **Commit 4: Source Changes** (if any KPI-related)
   - Review and commit only KPI-related src/ changes

---

## Pre-Commit Checklist

Before committing, verify:

- [ ] Dashboard is displaying data correctly
- [ ] Cron job exists and is active (jobid = 5)
- [ ] Manual trigger script works: `npx tsx scripts/manually-trigger-kpi-sync.ts`
- [ ] Verification script confirms data: `npx tsx scripts/verify-client-metrics-today.ts`
- [ ] Edge Function is deployed and working
- [ ] Documentation is complete and accurate
- [ ] No sensitive data (API keys, passwords) in committed files
- [ ] All scripts have proper TypeScript types
- [ ] Test files are excluded (.test.ts, .spec.ts)

---

## Commands to Execute

### Stage KPI-related files:
```bash
# Core operational scripts
git add scripts/manually-trigger-kpi-sync.ts
git add scripts/check-kpi-sync-status.ts
git add scripts/verify-client-metrics-today.ts
git add scripts/verify-client-metrics-recent.ts

# Investigation tools
git add scripts/check-pg-cron-simple.ts
git add scripts/investigate-sync-daily-kpi.ts
git add scripts/create-cron-job-direct.ts
git add scripts/list-available-tables.ts

# SQL & utilities
git add scripts/check-cron-job-status.sql
git add scripts/check-supabase-cron-access.sh

# Edge Functions
git add supabase/functions/check-cron-status/

# Documentation
git add docs/KPI_DASHBOARD_FIX_COMPLETE.md
git add INVESTIGATION_REPORT_SYNC_DAILY_KPI.md

# Review and add source changes if KPI-related
git add -p src/contexts/DashboardContext.tsx    # Review interactively
git add -p src/services/dataService.ts           # Review interactively
```

### Create commit:
```bash
git commit -m "fix: Resolve KPI Dashboard data pipeline issue

Root cause: The daily-kpi-metrics-sync cron job was never created in production,
causing client_metrics table to become stale.

Changes:
- Created pg_cron job (ID: 5) to run sync-daily-kpi-metrics daily at 12:01 AM UTC
- Added manually-trigger-kpi-sync.ts for immediate data population
- Added comprehensive monitoring and verification scripts
- Deployed check-cron-status Edge Function for system monitoring
- Documented complete fix and troubleshooting procedures

The dashboard now automatically updates daily with fresh metrics data.

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>"
```

### Push to GitHub:
```bash
git push origin main
```

---

## Post-Commit Actions

After pushing:

1. **Verify GitHub Actions** (if configured)
   - Check CI/CD pipeline passes
   - Verify no deployment errors

2. **Monitor First Cron Execution**
   - Next run: October 13, 2025 at 00:01 UTC
   - Check logs after execution
   - Verify data is populated

3. **Update Team**
   - Notify team of fix
   - Share monitoring script locations
   - Document any manual steps needed

4. **Create Follow-up Issues** (if needed)
   - Add Workspark API key (1 client skipped)
   - Set up alerting for failed cron jobs
   - Consider adding healthcheck endpoint

---

## Rollback Plan

If something goes wrong:

1. **Revert commit**:
   ```bash
   git revert HEAD
   git push origin main
   ```

2. **Disable cron job** (in Supabase Dashboard):
   ```sql
   UPDATE cron.job
   SET active = false
   WHERE jobname = 'daily-kpi-metrics-sync';
   ```

3. **Use manual sync** while investigating:
   ```bash
   npx tsx scripts/manually-trigger-kpi-sync.ts
   ```

---

## Success Criteria

Commit is successful when:

- ✅ All files are staged correctly
- ✅ Commit message is descriptive
- ✅ No sensitive data is committed
- ✅ GitHub push succeeds
- ✅ Dashboard continues to work after push
- ✅ Team is notified
- ✅ Monitoring scripts are accessible

