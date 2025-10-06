# Runbook: Syncing Client Interested Leads from Email Bison to CRM

**Last Updated**: 2025-10-06
**Owner**: Engineering Team
**Status**: Active

## Overview

This runbook provides step-by-step instructions for syncing interested leads from Email Bison to the Supabase CRM database when leads are not appearing in real-time via webhooks.

## When to Use This Runbook

Use this procedure when:
- Client reports that interested leads are not showing up in their CRM
- Weekend/batch leads need to be backfilled into the database
- Webhook is not functioning and manual sync is required
- Initial setup of a new client workspace requires historical lead import
- Verifying lead counts between Email Bison and CRM database

## Prerequisites

1. **Access Required**:
   - Email Bison Super Admin API Key (stored in `client-registry.json`)
   - Supabase project access with write permissions to `client_leads` table
   - Client workspace ID and workspace-specific API key

2. **Files Needed**:
   - `scripts/client-registry.json` - Client configuration registry
   - Template script: `scripts/sync-devin-interested-via-replies.sh`

3. **Tools**:
   - `curl` for API requests
   - `jq` for JSON parsing
   - Bash shell

## Step-by-Step Procedure

### Step 1: Verify Client Configuration

```bash
# Open client registry
cat scripts/client-registry.json | jq '.clients[] | select(.company_name == "CLIENT_NAME")'
```

**Collect the following information**:
- `workspace_id` - Email Bison workspace ID
- `workspace_name` - Workspace display name
- `api_key` - Client-specific API key
- `webhook_id` - Current webhook ID (may need troubleshooting if sync is needed)

**Example Output**:
```json
{
  "id": 2,
  "company_name": "Kim Wallace",
  "workspace_name": "Kim Wallace",
  "workspace_id": 4,
  "api_key": "49|5e899b62c8710dfe6f6ae82f3758a6105af10ad89b66a40c21f7ec568a658410",
  "webhook_id": 72,
  "webhook_verified": true,
  "status": "deployed"
}
```

### Step 2: Switch to Client Workspace

**CRITICAL**: You must switch workspace context before querying workspace-specific data.

```bash
SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
WORKSPACE_ID=4  # Replace with actual workspace ID
BASE_URL="https://api.emailbison.com/api"

curl -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\": ${WORKSPACE_ID}}"
```

**Expected Response**:
```json
{
  "message": "Workspace switched successfully"
}
```

### Step 3: Check Interested Lead Count

**CORRECT APPROACH**: Use the `/api/replies?status=interested` endpoint.

**DO NOT** use tag-based filtering (`/api/leads?filters[tag_ids][]=31`) - this approach times out and is unreliable.

```bash
# Get first page to determine total count
FIRST_PAGE=$(curl -s -G "${BASE_URL}/replies" \
  --data-urlencode "status=interested" \
  --data-urlencode "per_page=100" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

echo "$FIRST_PAGE" | jq '{
  current_page: .current_page,
  last_page: .last_page,
  total: .total,
  per_page: .per_page
}'
```

**Example Output**:
```json
{
  "current_page": 1,
  "last_page": 40,
  "total": 590,
  "per_page": 100
}
```

### Step 4: Compare with Database Lead Count

```bash
# Query Supabase to check current lead count
curl -X GET "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/client_leads?workspace_name=eq.Kim%20Wallace&interested=eq.true&select=count" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY"
```

**Calculate Gap**:
- Email Bison Interested Replies: 590
- Database Interested Leads: 573
- **Gap to Sync**: 17 leads

### Step 5: Create or Use Existing Sync Script

#### Option A: Use Existing Client Script

If a script already exists (e.g., `sync-kim-wallace-leads.sh`):

```bash
cd scripts
chmod +x sync-kim-wallace-leads.sh
./sync-kim-wallace-leads.sh
```

#### Option B: Create New Client Script

Copy the template and customize:

```bash
cp scripts/sync-devin-interested-via-replies.sh scripts/sync-CLIENT-NAME-leads.sh
```

**Edit the new script** with client-specific values:

```bash
#!/bin/bash

# Email Bison API Configuration
BASE_URL="https://api.emailbison.com/api"
SUPER_ADMIN_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
WORKSPACE_ID=4  # Client workspace ID
WORKSPACE_NAME="Kim Wallace"  # Client workspace name

# Supabase Configuration
SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="YOUR_SUPABASE_SERVICE_ROLE_KEY"

# Continue with script logic...
```

### Step 6: Run the Sync Script

**For Large Datasets** (500+ leads), run in background:

```bash
nohup ./sync-kim-wallace-leads.sh > sync-kim-wallace-$(date +%Y%m%d-%H%M%S).log 2>&1 &
echo $! > sync-kim-wallace.pid
```

**Monitor Progress**:

```bash
tail -f sync-kim-wallace-*.log
```

**Check if Still Running**:

```bash
ps aux | grep sync-kim-wallace | grep -v grep
```

### Step 7: Verify Results

After sync completes, verify the results:

```bash
# Check final lead count in database
curl -X GET "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/client_leads?workspace_name=eq.Kim%20Wallace&interested=eq.true&select=count" \
  -H "apikey: YOUR_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY"
```

**Expected Result**: Database count should match Email Bison interested reply count (±1-2 due to timing).

## Common Errors and Fixes

### Error 1: Query Timeout with Tag Filtering

**Symptom**:
```bash
curl: (28) Operation timed out after 30000 milliseconds
```

**Cause**: Using `/api/leads?filters[tag_ids][]=31` approach for interested leads.

**Fix**: Switch to `/api/replies?status=interested` endpoint.

### Error 2: Zero Interested Leads Returned

**Symptom**: API returns `total: 0` or empty data array.

**Possible Causes**:
1. **Not switched to correct workspace** - Run workspace switch API call
2. **Using wrong endpoint** - Use `/api/replies?status=interested` not tag filtering
3. **Wrong status value** - Use `interested` not `Interested` (case-sensitive)

**Fix**:
```bash
# Verify workspace switch
curl -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\": ${WORKSPACE_ID}}"

# Use correct endpoint
curl -s -G "${BASE_URL}/replies?status=interested&per_page=100"
```

### Error 3: Database Constraint Violations

**Symptom**: Leads are not appearing in database after sync, no errors in log.

**Cause**: Missing required fields or incorrect field names.

**Required Fields**:
- `lead_email` (NOT `email`)
- `workspace_name` (NOT `workspace_id`)
- `bison_lead_id` (unique identifier)
- `airtable_id` (required even if null)
- `interested` (boolean, must be `true`)

**Fix**: Check sync script ensures all fields are present:

```bash
PAYLOAD=$(cat <<EOF
{
  "lead_email": "$EMAIL",
  "workspace_name": "$WORKSPACE_NAME",
  "bison_lead_id": "$LEAD_ID",
  "interested": true,
  "airtable_id": null,
  "first_name": "$FIRST_NAME",
  "last_name": "$LAST_NAME",
  "company_name": "$COMPANY_NAME",
  "reply_uuid": "$REPLY_UUID",
  "conversation_url": "$CONVERSATION_URL"
}
EOF
)
```

### Error 4: Rate Limiting

**Symptom**: 429 errors or random failures during bulk sync.

**Fix**: Add sleep delays between API calls:

```bash
for lead_id in "${UNIQUE_LEAD_IDS[@]}"; do
  # Fetch lead
  LEAD=$(curl -s "${BASE_URL}/leads/${lead_id}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  # Process lead...

  # Rate limit protection
  sleep 0.2
done
```

### Error 5: Script Timeout

**Symptom**: Script stops responding after several minutes.

**Fix**: Run in background and check logs:

```bash
nohup ./sync-script.sh > sync.log 2>&1 &
tail -f sync.log
```

### Error 6: Leads Created But Not Visible in Portal

**Symptom**: Database shows leads exist, but portal displays empty columns.

**Cause**: Mismatch between `pipeline_stage` values in database and stages displayed in portal frontend.

**Investigation**:
1. Check database pipeline_stage values:
```bash
curl "https://YOUR_SUPABASE_URL/rest/v1/client_leads?workspace_name=eq.CLIENT&select=pipeline_stage&limit=5" \
  -H "apikey: YOUR_KEY"
```

2. Check portal code for PIPELINE_STAGES array (src/pages/ClientPortalPage.tsx):
```typescript
const PIPELINE_STAGES = [
  { key: 'new', label: 'New', ... },
  { key: 'interested', label: 'Interested', ... },
  // ... other stages
];
```

**Common Issues**:
- Database has `pipeline_stage = 'new'` but portal doesn't show 'new' column
- Webhook creates leads with `pipeline_stage = 'new'` but should use 'interested' for LEAD_INTERESTED events
- Sync scripts set wrong pipeline stage

**Fix**:
1. **Add missing stage to portal** (if stage is valid):
```typescript
// In src/pages/ClientPortalPage.tsx
const PIPELINE_STAGES = [
  { key: 'new', label: 'New', color: 'bg-blue-500/20 border-blue-500/40' },
  // ... other stages
];

// Also update grid columns
<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
```

2. **Fix webhook stage** (supabase/functions/bison-interested-webhook/index.ts):
```typescript
const leadData = {
  // ...
  pipeline_stage: 'interested', // Not 'new' for interested leads
  interested: true,
};
```

3. **Fix sync script stage**:
```bash
# Ensure sync scripts set correct stage
PAYLOAD=$(jq -n \
  --arg stage "interested" \
  '{
    pipeline_stage: $stage,
    interested: true,
    # ... other fields
  }')
```

**Related Fix**: See commit 2025-10-06 - Added 'new' stage to portal and updated webhook to use 'interested' stage for LEAD_INTERESTED events.

## Script Template

Complete working template based on Devin Hodo fix:

```bash
#!/bin/bash
set -e

echo "======================================"
echo "Email Bison Interested Leads Sync"
echo "Client: CLIENT_NAME"
echo "Started: $(date)"
echo "======================================"

# Configuration
BASE_URL="https://api.emailbison.com/api"
SUPER_ADMIN_KEY="YOUR_SUPER_ADMIN_KEY"
WORKSPACE_ID=X
WORKSPACE_NAME="CLIENT_NAME"

SUPABASE_URL="https://gjqbbgrfhijescaouqkx.supabase.co"
SUPABASE_KEY="YOUR_SERVICE_ROLE_KEY"

# Step 1: Switch workspace
echo "[1/5] Switching to workspace ${WORKSPACE_ID}..."
curl -X POST "${BASE_URL}/workspaces/v1.1/switch-workspace" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\": ${WORKSPACE_ID}}" \
  -s > /dev/null

# Step 2: Get total interested replies
echo "[2/5] Fetching interested replies metadata..."
FIRST_PAGE=$(curl -s -G "${BASE_URL}/replies" \
  --data-urlencode "status=interested" \
  --data-urlencode "per_page=100" \
  -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

LAST_PAGE=$(echo "$FIRST_PAGE" | jq -r '.last_page')
TOTAL=$(echo "$FIRST_PAGE" | jq -r '.total')

echo "Found ${TOTAL} interested replies across ${LAST_PAGE} pages"

# Step 3: Collect unique lead IDs
echo "[3/5] Collecting unique lead IDs..."
LEAD_IDS=()

for page in $(seq 1 $LAST_PAGE); do
  echo "  Processing page ${page}/${LAST_PAGE}..."

  REPLIES_PAGE=$(curl -s -G "${BASE_URL}/replies" \
    --data-urlencode "status=interested" \
    --data-urlencode "per_page=100" \
    --data-urlencode "page=${page}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}")

  PAGE_LEAD_IDS=$(echo "$REPLIES_PAGE" | jq -r '.data[].lead_id | select(. != null)')
  LEAD_IDS+=($PAGE_LEAD_IDS)

  sleep 0.2  # Rate limiting
done

# Get unique lead IDs
UNIQUE_LEAD_IDS=($(echo "${LEAD_IDS[@]}" | tr ' ' '\n' | sort -u | tr '\n' ' '))
echo "Found ${#UNIQUE_LEAD_IDS[@]} unique leads"

# Step 4: Fetch and upsert leads
echo "[4/5] Fetching full lead details and upserting to database..."
SUCCESS_COUNT=0
ERROR_COUNT=0

for lead_id in "${UNIQUE_LEAD_IDS[@]}"; do
  # Fetch lead
  LEAD=$(curl -s "${BASE_URL}/leads/${lead_id}" \
    -H "Authorization: Bearer ${SUPER_ADMIN_KEY}" | jq '.data')

  # Extract fields
  EMAIL=$(echo "$LEAD" | jq -r '.email // empty')
  FIRST_NAME=$(echo "$LEAD" | jq -r '.first_name // empty')
  LAST_NAME=$(echo "$LEAD" | jq -r '.last_name // empty')
  COMPANY=$(echo "$LEAD" | jq -r '.company_name // empty')

  if [ -z "$EMAIL" ]; then
    echo "  ⚠ Skipping lead ${lead_id} - no email"
    ((ERROR_COUNT++))
    continue
  fi

  # Build payload
  PAYLOAD=$(cat <<EOF
{
  "lead_email": "$EMAIL",
  "workspace_name": "$WORKSPACE_NAME",
  "bison_lead_id": "$lead_id",
  "interested": true,
  "first_name": "$FIRST_NAME",
  "last_name": "$LAST_NAME",
  "company_name": "$COMPANY",
  "airtable_id": null
}
EOF
)

  # Upsert to Supabase
  RESPONSE=$(curl -s -X POST "${SUPABASE_URL}/rest/v1/client_leads" \
    -H "apikey: ${SUPABASE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_KEY}" \
    -H "Content-Type: application/json" \
    -H "Prefer: resolution=merge-duplicates" \
    -d "$PAYLOAD")

  if echo "$RESPONSE" | jq -e 'has("error")' > /dev/null 2>&1; then
    echo "  ✗ Failed: ${EMAIL} - $(echo "$RESPONSE" | jq -r '.message')"
    ((ERROR_COUNT++))
  else
    echo "  ✓ Synced: ${EMAIL}"
    ((SUCCESS_COUNT++))
  fi

  sleep 0.2  # Rate limiting
done

# Step 5: Summary
echo "[5/5] Sync complete!"
echo "======================================"
echo "Summary:"
echo "  Total interested replies: ${TOTAL}"
echo "  Unique leads processed: ${#UNIQUE_LEAD_IDS[@]}"
echo "  Successfully synced: ${SUCCESS_COUNT}"
echo "  Errors: ${ERROR_COUNT}"
echo "  Completed: $(date)"
echo "======================================"
```

## Troubleshooting Decision Tree

```
Lead not appearing in CRM
│
├─ Is the webhook working?
│  ├─ Yes → Check webhook logs, see WEBHOOK_TROUBLESHOOTING.md
│  └─ No → Run manual sync (this runbook)
│
├─ Did sync script find 0 leads?
│  ├─ Yes → Check workspace switch, verify endpoint
│  └─ No → Continue to next check
│
├─ Did sync script error?
│  ├─ Yes → Check error logs, verify field names
│  └─ No → Continue to next check
│
└─ Leads synced but not in database?
   └─ Check database constraints, verify required fields
```

## Related Documentation

- [WEBHOOK_TROUBLESHOOTING.md](./WEBHOOK_TROUBLESHOOTING.md) - Diagnosing webhook delivery issues
- [EMAIL_BISON_INTERESTED_LEADS.md](./EMAIL_BISON_INTERESTED_LEADS.md) - How interested status works
- [EMAIL_BISON_API_REFERENCE.md](../EMAIL_BISON_API_REFERENCE.md) - Complete API documentation
- [DEVIN_HODO_FIX_README.md](../DEVIN_HODO_FIX_README.md) - Original fix that established this approach

## Success Criteria

✅ Sync is successful when:
1. Script completes without errors
2. Database lead count matches Email Bison interested reply count (±2)
3. Leads appear in client CRM portal
4. All required fields are populated (email, workspace_name, bison_lead_id, interested)
5. No duplicate leads created

## Notes

- **Always use the replies endpoint** (`/api/replies?status=interested`) - tag filtering is unreliable
- **Always switch workspace context** before querying - API is workspace-scoped
- **Always use Prefer: resolution=merge-duplicates** header for upserts to avoid duplicates
- **Always add rate limiting** (0.2s sleep) between API calls for large datasets
- This procedure is a **temporary fix** - the webhook should handle real-time syncing
- If frequently using this runbook for the same client, investigate webhook issues
