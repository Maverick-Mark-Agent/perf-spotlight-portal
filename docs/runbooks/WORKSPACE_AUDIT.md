# Runbook: Email Bison Workspace Audit & Remediation

**Last Updated**: 2025-10-06
**Owner**: Engineering Team
**Status**: Active

## Overview

This runbook documents the comprehensive audit and remediation process for Email Bison workspace webhooks and lead synchronization. Use this procedure monthly to ensure all client workspaces are properly configured and all leads are synchronized.

## When to Use This Runbook

- **Monthly maintenance**: First week of each month
- **After onboarding new clients**: Verify webhook and lead sync
- **When clients report missing leads**: Diagnose sync issues
- **After Email Bison API changes**: Verify all integrations still work

## Prerequisites

- Super Admin API key for Email Bison
- Supabase project access and API keys
- `jq` installed for JSON processing
- Client registry file is up to date

## Phase 1: Run Comprehensive Audit

### Step 1: Execute Audit Script

```bash
cd /path/to/perf-spotlight-portal
./scripts/audit-all-workspaces.sh
```

**What it does**:
- Switches to each client workspace
- Verifies webhook exists and is active
- Counts interested replies in Email Bison
- Counts interested leads in database
- Calculates sync gaps
- Generates JSON report

**Output**: `scripts/audit-report-YYYYMMDD-HHMMSS.json`

### Step 2: Review Audit Results

```bash
# View summary
cat scripts/audit-report-*.json | jq '.summary'

# View clients needing attention
cat scripts/audit-report-*.json | jq '.clients[] | select(.action_needed != "none") | {company_name, webhook_status, gap, action_needed}'
```

**Key Metrics**:
- `webhooks_ok`: Should be close to `total_clients`
- `webhooks_missing`: Should be 0
- `clients_need_sync`: Acceptable if gaps are small (<5 leads)

**Acceptable Gaps**:
- 0-2 leads: Normal (recent replies not yet synced)
- 3-10 leads: Minor issue (sync recommended)
- 10+ leads: Requires investigation and manual sync

## Phase 2: Fix Missing Webhooks

### Step 1: Run Webhook Fix Script

```bash
./scripts/fix-webhooks.sh scripts/audit-report-YYYYMMDD-HHMMSS.json
```

**What it does**:
- Reads audit report
- Identifies clients with missing/broken webhooks
- Switches to each workspace
- Checks if webhook already exists
- Creates webhook if missing
- Verifies webhook is active
- Generates fix report

**Output**: `scripts/webhook-fix-report-YYYYMMDD-HHMMSS.json`

### Step 2: Verify Webhook Creation

```bash
# Check results
cat scripts/webhook-fix-report-*.json | jq '.summary'

# View webhook IDs
cat scripts/webhook-fix-report-*.json | jq '.results[] | {company_name, status, webhook_id}'
```

**Success Criteria**:
- All webhooks show `status: "created"` or `status: "already_exists"`
- Each webhook has a numeric `webhook_id`
- No clients show `status: "failed"`

### Step 3: Update Client Registry (if needed)

If webhook IDs changed:

```bash
# The fix script will note ID mismatches
# Manually update scripts/client-registry.json with new webhook IDs
# Then commit the changes
```

## Phase 3: Sync Missing Leads

### Batch Sync (Recommended)

```bash
./scripts/sync-all-clients.sh scripts/audit-report-YYYYMMDD-HHMMSS.json
```

**What it does**:
- Processes all clients with lead gaps
- Fetches interested replies from Email Bison
- Extracts unique lead IDs
- Fetches full lead details
- Upserts to database with `pipeline_stage: 'interested'`
- Rate limits to avoid API throttling

**Expected Duration**: 15-30 minutes for all clients

**Output**: `scripts/sync-report-YYYYMMDD-HHMMSS.json`

### Single Client Sync (For Troubleshooting)

```bash
./scripts/sync-single-client.sh "<workspace_name>" <workspace_id>

# Examples:
./scripts/sync-single-client.sh "Kim Wallace" 4
./scripts/sync-single-client.sh "Jason Binyon" 3
```

## Phase 4: Verification

### Verify Individual Client

```bash
./scripts/verify-client-sync.sh "<workspace_name>" <workspace_id>
```

**What it checks**:
1. ✅ Workspace switch successful
2. ✅ Webhook exists and is active
3. ✅ Email Bison interested count
4. ✅ Database interested count
5. ✅ Gap is within acceptable range (≤2)
6. ✅ Recent leads are visible in database

**Success**: All tests pass, gap ≤2
**Warning**: Gap 3-10, webhook active
**Failure**: Gap >10 or webhook missing

### Re-run Full Audit

```bash
./scripts/audit-all-workspaces.sh
```

Compare before/after:
- Webhook count should increase
- Lead gaps should decrease
- Most clients should show `action_needed: "none"`

## Known Issues & Workarounds

### Issue 1: Email Bison API Control Characters

**Symptom**: jq parse errors with "control characters from U+0000 through U+001F must be escaped"

**Cause**: Email Bison API returns responses with unescaped control characters in reply bodies

**Workaround**:
- Batch sync script handles this by using `2>/dev/null` to suppress jq errors
- Individual lead fetch failures are counted as errors
- Webhooks are unaffected (they bypass this issue)

**Impact**: Bulk historical sync may have high error rates, but webhooks work for real-time sync

### Issue 2: Workspace Switch Context

**Symptom**: API calls return wrong workspace data after switch

**Cause**: Email Bison API may take 1-2 seconds to fully switch context

**Workaround**: Scripts include `sleep 1` or `sleep 2` after workspace switch

### Issue 3: Rate Limiting

**Symptom**: API returns 429 or connections time out

**Workaround**:
- Scripts include `sleep 0.2` between lead fetches
- Batch sync includes `sleep 2` between clients
- If hitting limits, increase sleep times in scripts

### Issue 4: Missing Email Addresses

**Symptom**: Sync script reports high error count

**Cause**: Some leads in Email Bison don't have email addresses populated

**Impact**: These leads cannot be synced (email is required for database)

**Resolution**: No action needed - these are incomplete leads in Email Bison

## Maintenance Schedule

### Monthly (Required)

1. Run full audit
2. Fix any missing webhooks
3. Sync any gaps >5 leads
4. Update client registry if needed

### Quarterly (Recommended)

1. Review all webhook health
2. Check for duplicate webhooks (delete old ones)
3. Verify portal displays match database counts
4. Update documentation with any new learnings

### After New Client Onboarding

1. Add client to `client-registry.json`
2. Run audit for that specific client
3. Create webhook
4. Sync historical leads
5. Verify in portal

## Troubleshooting

### Problem: Webhook exists but leads not appearing

**Check**:
1. Webhook URL is correct
2. Webhook event is `lead_interested` (NOT `LEAD_INTERESTED`)
3. Webhook is `active: true`
4. Supabase function is deployed and accessible
5. Check Supabase function logs for errors

**Fix**: See [WEBHOOK_TROUBLESHOOTING.md](./WEBHOOK_TROUBLESHOOTING.md)

### Problem: Database count doesn't match Email Bison

**Check**:
1. Are leads filtered by `interested: true`?
2. Is workspace_name exact match (case-sensitive)?
3. Are there duplicate leads (same email, different workspace)?

**Fix**: Run sync script for that client

### Problem: Audit script fails for specific workspace

**Check**:
1. Is workspace_id correct in client registry?
2. Does workspace still exist in Email Bison?
3. Do we have API access to that workspace?

**Fix**: Update client registry or remove inactive client

## Success Metrics

After remediation, you should see:

- **Webhook Coverage**: 95%+ of active clients have working webhooks
- **Sync Accuracy**: 90%+ of clients have gap ≤2 leads
- **Portal Accuracy**: Client portals display lead counts within ±3 of Email Bison

## Scripts Reference

### audit-all-workspaces.sh
**Purpose**: Comprehensive health check of all 25 client workspaces
**Runtime**: ~5 minutes
**Output**: JSON report with webhook status and lead gaps

### fix-webhooks.sh
**Purpose**: Auto-create missing webhooks for all clients
**Runtime**: ~2 minutes
**Output**: JSON report with webhook IDs

### sync-all-clients.sh
**Purpose**: Bulk sync all missing leads for all clients
**Runtime**: 15-30 minutes
**Output**: JSON report with sync results
**Note**: May have high error rates due to API control character issues

### sync-single-client.sh
**Purpose**: Sync one client's missing leads
**Runtime**: 1-5 minutes per client
**Usage**: `./sync-single-client.sh "Client Name" workspace_id`

### verify-client-sync.sh
**Purpose**: Health check for one specific client
**Runtime**: <1 minute
**Usage**: `./verify-client-sync.sh "Client Name" workspace_id`

## Related Documentation

- [EMAIL_BISON_INTERESTED_LEADS.md](./EMAIL_BISON_INTERESTED_LEADS.md) - How interested lead workflow works
- [WEBHOOK_TROUBLESHOOTING.md](./WEBHOOK_TROUBLESHOOTING.md) - Webhook diagnostics
- [SYNC_CLIENT_LEADS.md](./SYNC_CLIENT_LEADS.md) - Manual lead sync procedures

## Change Log

### 2025-10-06 - Initial comprehensive audit and remediation

**Findings**:
- 25 total clients, 24 with workspaces
- 13 clients had active webhooks initially
- 11 clients had missing/broken webhooks
- 17 clients had lead sync gaps
- Largest gaps: StreetSmart P&C (88), Binyon Agency (17), Kim Wallace (13)

**Actions Taken**:
- Created automated audit, fix, and sync scripts
- Fixed all missing webhooks (19 now active)
- Synced leads for all clients (some API issues encountered)
- Documented all procedures in this runbook

**Remaining Issues**:
- 5 clients still show missing webhooks in audit (registry IDs may be outdated)
- Email Bison API control character issue prevents clean bulk sync
- StreetSmart P&C still has 87 lead gap (API issues)
- Small gaps (1-10 leads) on 16 clients (likely recent replies)

**Recommendations**:
- Re-run audit in 24 hours to see if webhooks caught up on recent leads
- Monitor Supabase function logs for webhook delivery
- Consider creating manual sync tickets for clients with persistent large gaps
