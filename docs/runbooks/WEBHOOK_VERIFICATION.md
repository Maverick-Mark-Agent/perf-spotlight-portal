# Runbook: Webhook Verification & Testing

**Last Updated**: 2025-10-06
**Owner**: Engineering Team
**Status**: Active

## Overview

This runbook documents how to verify and test Email Bison webhooks for all clients to ensure real-time lead delivery to the CRM.

## When to Use This Runbook

- **After deploying Supabase function changes**: Verify all webhooks still work
- **Monthly maintenance**: First week of each month (use with WORKSPACE_AUDIT.md)
- **Client reports missing leads**: Diagnose specific webhook issues
- **After onboarding new clients**: Verify webhook is delivering correctly

## Prerequisites

- Super Admin API key for Email Bison
- Supabase project access and API keys
- Client registry file is up to date
- Supabase function deployed with `--no-verify-jwt` flag

## Webhook Architecture (Important!)

### How Email Bison Webhooks Work

**Webhooks are workspace-scoped** - this is by design in Email Bison's API:

1. **Each workspace has its own set of webhooks**
   - When you call `GET /api/webhook-url`, you only see webhooks for the **currently active workspace**
   - When you call `POST /api/webhook-url`, the webhook is created **only for the current workspace**

2. **The same webhook URL can be used across all workspaces**
   - All our clients use: `https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook`
   - Each workspace has a **separate webhook registration** pointing to this URL
   - Different workspaces will have **different webhook IDs** (this is normal and correct!)

3. **Webhook payloads include workspace identification**
   ```json
   {
     "event": {
       "type": "LEAD_INTERESTED",
       "workspace_id": 28,
       "workspace_name": "John Roberts"
     }
   }
   ```
   This allows our single webhook endpoint to receive events from all workspaces and correctly route them.

### Why This Matters

- ✅ **CORRECT**: John Roberts has webhook ID 78, Shane Miller has webhook ID 83, both pointing to the same URL
- ❌ **WRONG**: Thinking a single webhook ID should work for all workspaces
- ✅ **CORRECT**: Creating a webhook in each workspace during client onboarding
- ❌ **WRONG**: Trying to share a single webhook registration across workspaces

**Key Insight**: Webhook IDs are workspace-scoped, not global. The same webhook ID (like 83) can exist in multiple workspaces - it's like apartment numbers in different buildings.

## Quick Verification - All Clients

### Run Comprehensive Verification Script

```bash
cd /path/to/perf-spotlight-portal
./scripts/verify-all-webhooks.sh
```

**What it does**:
1. Switches to each client workspace
2. Verifies webhook exists and has correct URL
3. Sends test `LEAD_INTERESTED` event to Supabase function
4. Verifies test lead appears in database
5. Cleans up test leads
6. Generates JSON report

**Runtime**: ~2-3 minutes for all clients

**Output**: `scripts/webhook-verification-report-YYYYMMDD-HHMMSS.json`

**Success Criteria**:
- All webhooks have status: `ok`
- All deliveries have status: `success`
- Report shows 0 missing webhooks
- Report shows 0 failed deliveries

## Interpreting Verification Results

### Webhook Statuses

| Status | Meaning | Action Required |
|--------|---------|----------------|
| `ok` | Webhook exists with correct URL | None - working correctly |
| `wrong_url` | Webhook exists but URL doesn't match | Update webhook URL in Email Bison |
| `missing` | Webhook not found in workspace | Create webhook using fix script |

### Delivery Statuses

| Status | Meaning | Action Required |
|--------|---------|----------------|
| `success` | Test event delivered and lead created | None - working correctly |
| `webhook_failed` | Supabase function returned error | Check function logs, verify JWT settings |
| `db_not_found` | Function succeeded but lead not in DB | Check RLS policies, verify database connection |
| `not_tested` | Webhook missing, delivery not attempted | Fix webhook first |

## Testing Individual Webhooks

### Test Specific Client Webhook

```bash
# Switch to client workspace
WORKSPACE_ID=28
curl -X POST "https://send.maverickmarketingllc.com/api/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"team_id\": ${WORKSPACE_ID}}"

sleep 2

# List webhooks
curl "https://send.maverickmarketingllc.com/api/webhook-url" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" | jq

# Send test event
curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "LEAD_INTERESTED",
      "workspace_name": "John Roberts",
      "workspace_id": 28,
      "instance_url": "https://app.emailbison.com"
    },
    "data": {
      "lead": {
        "id": 99999,
        "email": "test@example.com",
        "first_name": "Test",
        "last_name": "Webhook",
        "status": "interested",
        "title": "Test Manager",
        "company": "Test Co",
        "custom_variables": [{"name": "Phone", "value": "555-0000"}]
      },
      "reply": {
        "id": 88888,
        "uuid": "test-uuid",
        "date_received": "2025-10-06T12:00:00Z",
        "from_name": "Test Webhook",
        "from_email_address": "test@example.com"
      },
      "campaign": {
        "id": 123,
        "name": "Test Campaign"
      },
      "sender_email": {
        "id": 456,
        "email": "sender@test.com",
        "name": "Test Sender"
      }
    }
  }' | jq

# Verify in database
curl "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/client_leads?workspace_name=eq.John%20Roberts&lead_email=eq.test@example.com&select=id,lead_email,first_name,last_name,pipeline_stage" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq
```

## Common Issues & Fixes

### Issue 1: Webhook Not Found (404)

**Symptoms**:
- Verification script shows `webhook_status: "missing"`
- Client registry lists webhook ID but it doesn't exist

**Diagnosis**:
```bash
# Switch to workspace and list all webhooks
curl -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -d "{\"team_id\": ${WORKSPACE_ID}}"

sleep 2

curl "${BASE_URL}/webhook-url" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" | jq
```

**Fix**:
```bash
# Run webhook fix script
./scripts/fix-webhooks.sh scripts/audit-report-latest.json

# Or create webhook manually
curl -X POST "${BASE_URL}/webhook-url" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Client Portal Pipeline - Interested Leads",
    "url": "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook",
    "events": ["lead_interested"]
  }' | jq

# Update client registry with new webhook ID
```

### Issue 2: Webhook Delivery Failed (401 Unauthorized)

**Symptoms**:
- Verification shows `delivery_status: "webhook_failed"`
- Error message: "Missing authorization header" or "Invalid JWT"

**Root Cause**: Supabase function deployed WITH JWT verification

**Fix**:
```bash
# Redeploy function without JWT verification
SUPABASE_ACCESS_TOKEN=sbp_... npx supabase functions deploy bison-interested-webhook --no-verify-jwt

# Test again
./scripts/verify-all-webhooks.sh
```

### Issue 3: Lead Created But Not in Database

**Symptoms**:
- Verification shows `delivery_status: "db_not_found"`
- Function returns success but lead not queryable

**Possible Causes**:
1. RLS policy blocking read access
2. Database connection issue
3. Race condition (query too fast)

**Diagnosis**:
```bash
# Check RLS policies
# Open Supabase dashboard > client_leads table > Policies

# Query directly without filters
curl "${SUPABASE_URL}/rest/v1/client_leads?select=id,lead_email&order=created_at.desc&limit=5" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" | jq
```

**Fix**:
- Ensure RLS policy allows public read: `(true)`
- Add delay before querying (verification script uses 1 second)

### Issue 4: Wrong Webhook URL

**Symptoms**:
- Verification shows `webhook_status: "wrong_url"`
- Webhook points to old/incorrect Supabase function

**Fix**:
```bash
# Update webhook URL
WEBHOOK_ID=78
curl -X PUT "${BASE_URL}/webhook-url/${WEBHOOK_ID}" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook"
  }' | jq
```

### Issue 5: Multiple Competing Webhooks

**Symptoms**:
- Multiple webhooks listen to `lead_interested` event
- Unclear which webhook is being fired
- AgencyZoom or Slack webhooks also present

**Example** (John Roberts workspace):
- Webhook 78: Client Portal ← correct one
- Webhook 57: AgencyZoom
- Webhook 47: Reply to All
- Webhook 41: Send to Slack Positive

**Impact**: All active webhooks for the same event will be fired. This is usually fine unless one fails and blocks others.

**Fix**: Only disable competing webhooks if they're causing issues. Otherwise, leave them active.

## Webhook Testing Best Practices

### 1. Always Test After Deployment

```bash
# After any Supabase function deployment
npx supabase functions deploy bison-interested-webhook --no-verify-jwt

# Immediately run verification
./scripts/verify-all-webhooks.sh

# Check report
cat scripts/webhook-verification-report-*.json | jq '.summary'
```

### 2. Clean Up Test Leads

Test leads are automatically cleaned up by verification script, but if you create manual tests:

```bash
# Delete test leads
curl -X DELETE "${SUPABASE_URL}/rest/v1/client_leads?lead_email=like.*@test.com" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}"

curl -X DELETE "${SUPABASE_URL}/rest/v1/client_leads?lead_email=like.*@verify.test" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}"
```

### 3. Verify Real Lead Flow

After successful test, verify with real lead:

1. Go to Email Bison UI
2. Open a client workspace
3. Find a reply
4. Mark it as "Interested"
5. Wait 5-10 seconds
6. Check client portal to see if lead appears in "Interested" stage

### 4. Check Supabase Function Logs

```bash
# View recent function logs
npx supabase functions logs bison-interested-webhook --project-ref gjqbbgrfhijescaouqkx

# Or in Supabase dashboard:
# Functions > bison-interested-webhook > Logs
```

Look for:
- Successful invocations (200 status)
- Error messages
- Lead creation confirmations

## Verification Report Format

```json
{
  "summary": {
    "verification_date": "2025-10-06T19:29:18Z",
    "total_clients": 23,
    "webhooks_ok": 12,
    "webhooks_wrong_url": 0,
    "webhooks_missing": 11,
    "delivery_success": 12,
    "delivery_failed": 0
  },
  "clients": [
    {
      "company_name": "John Roberts",
      "workspace_name": "John Roberts",
      "workspace_id": 28,
      "webhook_id": 78,
      "webhook_status": "ok",
      "webhook_url": "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook",
      "delivery_status": "success",
      "test_lead_id": "02f56917-698e-45ad-982e-89b1ea42d856",
      "error": ""
    },
    // ... more clients
  ]
}
```

## Success Metrics

After verification, you should see:

- **Webhook Coverage**: 95%+ of active clients have working webhooks
- **Delivery Success**: 100% of webhooks with correct URL can deliver test events
- **Response Time**: Test events create leads within 1-2 seconds

## Integration with Other Runbooks

This runbook works alongside:

- [WORKSPACE_AUDIT.md](./WORKSPACE_AUDIT.md) - Monthly comprehensive audit
- [WEBHOOK_TROUBLESHOOTING.md](./WEBHOOK_TROUBLESHOOTING.md) - Deep webhook diagnostics
- [SYNC_CLIENT_LEADS.md](./SYNC_CLIENT_LEADS.md) - Manual lead sync procedures

**Recommended Workflow**:
1. Run workspace audit (checks webhooks + lead counts)
2. Run webhook verification (tests actual delivery)
3. Fix any missing/broken webhooks
4. Sync any historical lead gaps
5. Verify real lead flow for affected clients

## Emergency Procedures

### All Webhooks Failing

**Symptoms**: Verification shows 0% delivery success

**Likely Cause**: Supabase function issue (JWT verification, deployment failure, downtime)

**Fix**:
1. Check Supabase function status
2. Redeploy function with correct flags
3. Test single client first
4. Run full verification

### Individual Client Webhook Failing

**Symptoms**: One client consistently fails verification

**Diagnosis Steps**:
1. Switch to workspace and list webhooks
2. Verify webhook ID matches registry
3. Send manual test event
4. Check Supabase function logs for errors specific to that workspace
5. Check database for any RLS or constraint issues

## Related Scripts

### verify-all-webhooks.sh
**Purpose**: Comprehensive webhook verification with test event delivery
**Runtime**: ~2-3 minutes
**Output**: JSON report with webhook and delivery status

### fix-webhooks.sh
**Purpose**: Auto-create missing webhooks for all clients
**Runtime**: ~2 minutes
**Output**: JSON report with created webhook IDs

### audit-all-workspaces.sh
**Purpose**: Health check including webhook existence and lead sync gaps
**Runtime**: ~5 minutes
**Output**: JSON report with audit results

## Change Log

### 2025-10-06 - Initial webhook verification system

**Created**:
- Comprehensive verification script (`verify-all-webhooks.sh`)
- Test event delivery validation
- Automatic test lead cleanup
- JSON reporting format

**Key Finding**:
- John Roberts webhook delivery failing due to JWT verification
- Supabase function redeployed with `--no-verify-jwt`
- 12 of 23 clients have fully functional webhooks
- 11 clients need webhook creation/fixing

**Verified Working**:
- David Amiri (69)
- Jeff Schroder (73)
- ATI (74)
- Jason Binyon (75)
- Danny Schwartz (89)
- SMA Insurance (82)
- Shane Miller (83)
- StreetSmart P&C (85)
- StreetSmart Trucking (90)
- Tony Schmitz (86)
- Insurance workspace (87, 88)

**Need Attention**:
- John Roberts (78) - Webhook exists but needs registry verification
- Kim Wallace (92) - User confirmed working, registry may be wrong
- 9 other clients with missing webhooks
