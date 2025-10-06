# Runbook: Webhook Troubleshooting for Email Bison Lead Events

**Last Updated**: 2025-10-06
**Owner**: Engineering Team
**Status**: Active

## Overview

This runbook provides diagnostic and resolution steps for troubleshooting Email Bison webhook delivery issues, specifically for the `LEAD_INTERESTED` event that triggers real-time lead sync to the CRM.

## When to Use This Runbook

Use this procedure when:
- Client reports leads not appearing in CRM in real-time
- Webhook is marked as "verified" in registry but not delivering events
- Weekend/batch leads are missing (indicating webhook stopped working)
- New client webhook needs to be set up
- Webhook ID listed in registry doesn't exist in Email Bison
- Testing webhook delivery after configuration changes

## How Webhooks Work

### Event Flow

```
Email Bison Reply Marked as "Interested"
  ↓
LEAD_INTERESTED event triggered
  ↓
Email Bison sends POST to webhook URL
  ↓
Supabase Edge Function: bison-interested-webhook
  ↓
Lead upserted to client_leads table
  ↓
Lead appears in CRM portal
```

### Webhook Configuration

**Webhook URL**: `https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook`

**Event Type**: `LEAD_INTERESTED`

**Payload Structure**:
```json
{
  "event": {
    "type": "LEAD_INTERESTED",
    "data": {
      "lead_id": 12345,
      "email": "prospect@example.com",
      "first_name": "John",
      "last_name": "Doe",
      "company_name": "Acme Inc",
      "workspace_id": 4,
      "workspace_name": "Kim Wallace",
      "reply_uuid": "550e8400-e29b-41d4-a716-446655440000",
      "conversation_url": "https://app.emailbison.com/conversations/..."
    }
  }
}
```

## Diagnostic Steps

### Step 1: Verify Webhook Exists

```bash
SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://api.emailbison.com/api"
WORKSPACE_ID=4  # Replace with client workspace ID

# Switch to client workspace
curl -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\": ${WORKSPACE_ID}}"

# List all webhooks in workspace
curl -s -X GET "${BASE_URL}/webhook-url" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" | jq '.'
```

**Expected Output** (webhook exists):
```json
{
  "data": [
    {
      "id": 92,
      "workspace_id": 4,
      "url": "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook",
      "event": "LEAD_INTERESTED",
      "active": true,
      "created_at": "2025-10-06T...",
      "updated_at": "2025-10-06T..."
    }
  ]
}
```

**Problem Indicators**:
- Empty `data` array → No webhooks configured
- Webhook ID in registry doesn't match actual webhook ID
- Webhook `active: false`
- Different `url` or `event` type

### Step 2: Check Specific Webhook

If you have a webhook ID from the client registry:

```bash
WEBHOOK_ID=72  # From client-registry.json

curl -s -X GET "${BASE_URL}/webhook-url/${WEBHOOK_ID}" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" | jq '.'
```

**Possible Results**:
1. **Success** → Webhook exists and is properly configured
2. **404 Not Found** → Webhook ID in registry is wrong/deleted
3. **401 Unauthorized** → You're not in the correct workspace

### Step 3: Test Webhook Delivery

Create a test event to verify webhook is receiving and processing events:

```bash
# Trigger test by manually marking a reply as interested
# Then check Supabase function logs

# View recent webhook function invocations
# Go to: Supabase Dashboard → Edge Functions → bison-interested-webhook → Logs

# Look for recent POST requests and check:
# - Event payload structure
# - Database upsert success
# - Any error messages
```

**Healthy Webhook Logs**:
```
[INFO] Received LEAD_INTERESTED event for workspace: Kim Wallace
[INFO] Lead email: prospect@example.com
[INFO] Successfully upserted lead to database
[INFO] Response sent: 200 OK
```

**Problem Indicators in Logs**:
```
[ERROR] Invalid event type: undefined
[ERROR] Missing required fields: workspace_name
[ERROR] Database error: duplicate key value
[ERROR] Authorization failed
```

### Step 4: Verify Supabase Function

Check that the Supabase Edge Function is deployed and accessible:

```bash
curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "event": {
      "type": "LEAD_INTERESTED",
      "data": {
        "lead_id": 999,
        "email": "test@example.com",
        "workspace_name": "Test"
      }
    }
  }'
```

**Expected Response** (function is working):
```json
{
  "success": true,
  "message": "Lead processed successfully"
}
```

**Problem Response**:
```json
{
  "error": "Function not found"
}
```
or
```json
{
  "error": "Internal Server Error"
}
```

## Common Issues and Fixes

### Issue 1: Webhook Listed in Registry But Doesn't Exist

**Symptom**:
- `client-registry.json` shows `webhook_id: 72` and `webhook_verified: true`
- API call to `/webhook-url/72` returns 404 or unauthorized
- Listing all webhooks doesn't show ID 72

**Root Cause**:
- Webhook was never created
- Webhook was deleted
- Webhook was created in different workspace

**Fix**: Create new webhook and update registry

```bash
# Step 1: Switch to client workspace
curl -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\": ${WORKSPACE_ID}}"

# Step 2: Create webhook
WEBHOOK_RESPONSE=$(curl -s -X POST "${BASE_URL}/webhook-url" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook",
    "event": "LEAD_INTERESTED"
  }')

echo "$WEBHOOK_RESPONSE" | jq '.'

# Step 3: Extract new webhook ID
NEW_WEBHOOK_ID=$(echo "$WEBHOOK_RESPONSE" | jq -r '.data.id')
echo "New webhook ID: ${NEW_WEBHOOK_ID}"

# Step 4: Update client-registry.json with new webhook_id
# See Step 5 below for registry update procedure
```

### Issue 2: Wrong Workspace Context

**Symptom**:
- Webhook API calls return 401 Unauthorized
- Cannot see webhooks even though they exist

**Root Cause**: API calls are workspace-scoped, must switch context first

**Fix**:

```bash
# Always switch workspace before webhook operations
curl -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\": ${WORKSPACE_ID}}"

# Wait 1-2 seconds for context switch
sleep 2

# Then make webhook API calls
```

### Issue 3: Webhook Exists But Events Not Delivering

**Symptom**:
- Webhook exists and shows `active: true`
- Supabase function logs show no recent invocations
- Leads manually marked as interested in Email Bison don't trigger webhook

**Diagnostic Steps**:

1. **Check Email Bison Event Logs**:
   - Go to Email Bison Dashboard → Settings → Webhooks
   - Check webhook delivery history for failed attempts
   - Look for retry attempts or delivery errors

2. **Verify Webhook URL is Accessible**:
```bash
curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook" \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

3. **Check Supabase Function Status**:
   - Verify function is deployed and not paused
   - Check for recent deployment errors
   - Verify function has correct environment variables

**Fix**:
- Delete and recreate webhook if delivery is stuck
- Redeploy Supabase function if it's erroring
- Check Supabase project status (not paused/over quota)

### Issue 4: Multiple Webhooks for Same Event

**Symptom**:
- Duplicate leads appearing in database
- Multiple webhook IDs exist for same event type

**Diagnostic**:
```bash
curl -s -X GET "${BASE_URL}/webhook-url" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" | \
  jq '.data[] | select(.event == "LEAD_INTERESTED")'
```

**Fix**: Delete old/duplicate webhooks, keep only the latest active one:

```bash
OLD_WEBHOOK_ID=72

curl -X DELETE "${BASE_URL}/webhook-url/${OLD_WEBHOOK_ID}" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}"
```

### Issue 5: Webhook Payload Missing Required Fields

**Symptom**:
- Supabase function logs show errors about missing fields
- Leads not being inserted into database

**Check Logs For**:
```
[ERROR] Missing workspace_name in event data
[ERROR] Invalid email format
[ERROR] lead_id is null
```

**Fix**: Update webhook handler to use fallback values:

```typescript
// In supabase/functions/bison-interested-webhook/index.ts
const leadData = {
  lead_email: eventData.email || eventData.lead_email,
  workspace_name: eventData.workspace_name || "Unknown",
  bison_lead_id: String(eventData.lead_id || eventData.id),
  // ... other fields
};
```

## Creating a New Webhook

### Step-by-Step Webhook Creation

```bash
#!/bin/bash
# create-webhook.sh

CLIENT_NAME="Kim Wallace"
WORKSPACE_ID=4

SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_URL="https://api.emailbison.com/api"
WEBHOOK_URL="https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook"

echo "Creating webhook for: ${CLIENT_NAME}"
echo "Workspace ID: ${WORKSPACE_ID}"

# Step 1: Switch workspace
echo "[1/3] Switching to workspace..."
curl -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\": ${WORKSPACE_ID}}" \
  -s > /dev/null

sleep 2

# Step 2: Create webhook
echo "[2/3] Creating webhook..."
WEBHOOK_RESPONSE=$(curl -s -X POST "${BASE_URL}/webhook-url" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{
    \"url\": \"${WEBHOOK_URL}\",
    \"event\": \"LEAD_INTERESTED\"
  }")

# Check for errors
if echo "$WEBHOOK_RESPONSE" | jq -e 'has("error")' > /dev/null 2>&1; then
  echo "ERROR: Failed to create webhook"
  echo "$WEBHOOK_RESPONSE" | jq '.'
  exit 1
fi

# Step 3: Extract webhook ID
NEW_WEBHOOK_ID=$(echo "$WEBHOOK_RESPONSE" | jq -r '.data.id')

echo "[3/3] Webhook created successfully!"
echo "======================================"
echo "Webhook ID: ${NEW_WEBHOOK_ID}"
echo "URL: ${WEBHOOK_URL}"
echo "Event: LEAD_INTERESTED"
echo "Workspace: ${CLIENT_NAME} (${WORKSPACE_ID})"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Update client-registry.json with webhook_id: ${NEW_WEBHOOK_ID}"
echo "2. Test webhook by marking a reply as interested in Email Bison"
echo "3. Verify lead appears in CRM database"
```

### Test Webhook After Creation

```bash
# Step 1: Mark a test reply as interested in Email Bison UI

# Step 2: Check Supabase function logs (within 30 seconds)
# Go to: Supabase → Edge Functions → bison-interested-webhook → Logs

# Step 3: Query database for the test lead
curl -X GET "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/client_leads?workspace_name=eq.Kim%20Wallace&order=created_at.desc&limit=1" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" | jq '.'

# Expected: Most recent lead should be the test lead you just marked
```

## Webhook Registry Update Procedure

### Step 5: Update client-registry.json

After creating a new webhook, update the registry:

```bash
# Open registry in editor
nano scripts/client-registry.json

# Find client entry and update:
{
  "id": 2,
  "company_name": "Kim Wallace",
  "webhook_id": 92,  # ← Update this to new webhook ID
  "webhook_verified": true,
  "notes": "Webhook recreated 2025-10-06 - old ID 72 didn't exist"
}

# Validate JSON syntax
cat scripts/client-registry.json | jq '.' > /dev/null
echo "✓ JSON is valid"

# Commit changes
git add scripts/client-registry.json
git commit -m "Update Kim Wallace webhook ID to 92"
```

## Monitoring and Maintenance

### Regular Health Checks

Run monthly to verify webhook health:

```bash
#!/bin/bash
# webhook-health-check.sh

echo "Webhook Health Check - $(date)"
echo "======================================"

# Read all clients from registry
CLIENTS=$(cat scripts/client-registry.json | jq -r '.clients[] | select(.webhook_id != null) | @base64')

for client in $CLIENTS; do
  _jq() {
    echo ${client} | base64 --decode | jq -r ${1}
  }

  CLIENT_NAME=$(_jq '.company_name')
  WORKSPACE_ID=$(_jq '.workspace_id')
  EXPECTED_WEBHOOK_ID=$(_jq '.webhook_id')

  echo ""
  echo "Checking: ${CLIENT_NAME}"

  # Switch workspace
  curl -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"workspace_id\": ${WORKSPACE_ID}}" \
    -s > /dev/null

  sleep 1

  # Check webhook exists
  WEBHOOK=$(curl -s -X GET "${BASE_URL}/webhook-url/${EXPECTED_WEBHOOK_ID}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  if echo "$WEBHOOK" | jq -e 'has("error")' > /dev/null 2>&1; then
    echo "  ✗ Webhook ${EXPECTED_WEBHOOK_ID} NOT FOUND"
  else
    ACTIVE=$(echo "$WEBHOOK" | jq -r '.data.active')
    if [ "$ACTIVE" == "true" ]; then
      echo "  ✓ Webhook ${EXPECTED_WEBHOOK_ID} is active"
    else
      echo "  ⚠ Webhook ${EXPECTED_WEBHOOK_ID} exists but inactive"
    fi
  fi
done

echo ""
echo "======================================"
echo "Health check complete"
```

### Alert Conditions

Set up alerts for:
- Webhook delivery failures (>5 consecutive failures)
- No webhook events received for 7+ days for active clients
- Supabase function error rate >10%
- Database upsert failures

## Related Documentation

- [SYNC_CLIENT_LEADS.md](./SYNC_CLIENT_LEADS.md) - Manual lead sync procedure (fallback when webhook is broken)
- [EMAIL_BISON_INTERESTED_LEADS.md](./EMAIL_BISON_INTERESTED_LEADS.md) - Understanding interested lead workflow
- [EMAIL_BISON_API_REFERENCE.md](../EMAIL_BISON_API_REFERENCE.md) - Complete API documentation

## Decision Tree

```
Leads not appearing in CRM
│
├─ Check: Is webhook listed in registry?
│  ├─ No → Create webhook, update registry
│  └─ Yes → Continue
│
├─ Check: Does webhook exist in Email Bison?
│  ├─ No → Recreate webhook, update registry
│  └─ Yes → Continue
│
├─ Check: Is webhook active?
│  ├─ No → Activate webhook or recreate
│  └─ Yes → Continue
│
├─ Check: Are events being sent?
│  ├─ No → Check Email Bison delivery logs
│  └─ Yes → Continue
│
├─ Check: Is Supabase function receiving events?
│  ├─ No → Verify webhook URL, check function deployment
│  └─ Yes → Continue
│
└─ Check: Are leads being inserted to database?
   ├─ No → Check function logs for errors, verify database permissions
   └─ Yes → Issue may be frontend display, check CRM queries
```

## Success Criteria

✅ Webhook is healthy when:
1. Webhook exists in Email Bison and shows `active: true`
2. Webhook ID in registry matches actual webhook ID
3. Test event (marking reply as interested) delivers within 30 seconds
4. Supabase function logs show successful event processing
5. Lead appears in database with `interested: true`
6. Lead visible in client CRM portal immediately

## Emergency Fallback

If webhook is completely broken and cannot be fixed immediately:

1. **Use manual sync** as temporary solution:
   ```bash
   ./scripts/sync-CLIENT-NAME-leads.sh
   ```
   See [SYNC_CLIENT_LEADS.md](./SYNC_CLIENT_LEADS.md)

2. **Set up cron job** for periodic syncing (every 15 minutes):
   ```bash
   */15 * * * * /path/to/scripts/sync-CLIENT-NAME-leads.sh >> /var/log/sync.log 2>&1
   ```

3. **Fix webhook** using this runbook during business hours

4. **Remove cron job** once webhook is verified working
