# Runbook: Understanding Email Bison Interested Leads Workflow

**Last Updated**: 2025-10-06
**Owner**: Engineering Team
**Status**: Active

## Overview

This document explains how the "interested lead" workflow operates in Email Bison, how leads get marked as interested, how this triggers our CRM sync, and the critical API patterns that must be used when working with interested leads.

## The Interested Lead Lifecycle

### 1. Initial Contact
- Client sends cold emails via Email Bison campaigns
- Prospects receive emails and some reply
- Replies appear in Email Bison inbox

### 2. Reply Classification
**Manual Process**: Sales team reviews replies in Email Bison and marks them as:
- **Interested** - Prospect expresses interest, wants more info
- **Not Interested** - Prospect declines or opts out
- **Neutral/Unclassified** - Informational replies, questions, etc.

**How to Mark as Interested** (Email Bison UI):
1. Go to Email Bison Dashboard → Conversations
2. Click on a conversation with a reply
3. Review the reply content
4. Click the "Interested" button or apply "Interested" tag
5. Reply status changes to `status: "interested"`

### 3. Event Trigger
When a reply is marked as interested:
```
User clicks "Interested" button
  ↓
Reply object updated: { status: "interested" }
  ↓
Tag applied to lead: "Interested"
  ↓
Email Bison fires: LEAD_INTERESTED event
  ↓
Webhook delivers event to our Supabase function
```

### 4. CRM Sync (Real-time)
```
Webhook event received
  ↓
Supabase Edge Function: bison-interested-webhook
  ↓
Extract lead data from event payload
  ↓
Upsert to client_leads table
  ↓
Lead appears in client CRM portal (interested: true)
```

### 5. Client Visibility
- Client logs into CRM portal
- Sees interested lead with full contact info
- Can follow up, move through pipeline stages
- Lead data includes: email, name, company, reply content, conversation link

## Critical API Patterns

### ✅ CORRECT: Using Reply Status Endpoint

**This is the ONLY reliable method for getting interested leads:**

```bash
GET /api/replies?status=interested&per_page=100&page=1
```

**Why This Works**:
- Replies are marked with `status: "interested"` when user clicks interested button
- This field is indexed and queryable
- Returns ALL interested replies across all time
- Pagination is reliable (can fetch all pages)
- Fast response time even with thousands of replies

**Example Response**:
```json
{
  "data": [
    {
      "id": 12345,
      "lead_id": 67890,
      "status": "interested",
      "body": "Yes, I'd like to learn more...",
      "created_at": "2025-10-05T14:30:00Z",
      "conversation_id": 111
    }
  ],
  "current_page": 1,
  "last_page": 40,
  "per_page": 100,
  "total": 590
}
```

**Key Pattern**:
```bash
# Step 1: Get all interested replies
# Step 2: Extract unique lead_id values from replies
# Step 3: Fetch full lead details using /api/leads/{lead_id}
# Step 4: Upsert leads to database with interested: true
```

### ❌ WRONG: Using Tag Filtering on Leads Endpoint

**DO NOT USE THIS APPROACH:**

```bash
# ❌ This will timeout or return incorrect results
GET /api/leads?filters[tag_ids][]=31
```

**Why This Doesn't Work**:
- Tag filtering on leads endpoint is not optimized
- Query times out with large datasets (500+ leads)
- Tags can be applied/removed independently of interested status
- No reliable pagination
- May miss leads if tag was removed/changed

**Historical Context**:
This was the original approach tried during Kim Wallace sync. It appeared to work in small tests but:
- Returned 0 results when queried (despite 590 interested leads existing)
- Supabase function using this approach reported "0 total interested leads found"
- User confirmed "interested tag is being applied" - the API just can't query it reliably

### How the Reply Status Gets Set

**Email Bison Internal Logic** (inferred from API behavior):

```javascript
// When user clicks "Interested" button in UI:
async function markAsInterested(replyId) {
  // 1. Update reply status
  await db.replies.update(replyId, {
    status: 'interested'
  });

  // 2. Apply "Interested" tag to lead
  const reply = await db.replies.find(replyId);
  await db.leads.addTag(reply.lead_id, 'Interested');

  // 3. Fire webhook event
  await webhooks.trigger('LEAD_INTERESTED', {
    lead_id: reply.lead_id,
    reply_id: replyId,
    workspace_id: reply.workspace_id
  });
}
```

**Key Insight**: The reply status field is the source of truth, not the tag.

## Data Flow Diagrams

### Interested Lead Creation Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Email Bison UI                                              │
│                                                             │
│  [Conversation Thread]                                      │
│  ┌──────────────────────────────────────┐                  │
│  │ Prospect: "Yes, tell me more..."     │                  │
│  └──────────────────────────────────────┘                  │
│                                                             │
│         ↓ User clicks "Interested"                         │
│                                                             │
│  [Reply Updated]                                            │
│  status: null → status: "interested" ✓                     │
│                                                             │
│  [Lead Updated]                                             │
│  tags: [..., "Interested"] ✓                               │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Email Bison Backend                                         │
│                                                             │
│  LEAD_INTERESTED event created                             │
│  {                                                          │
│    type: "LEAD_INTERESTED",                                │
│    data: {                                                  │
│      lead_id: 67890,                                        │
│      email: "prospect@example.com",                         │
│      workspace_name: "Kim Wallace",                         │
│      reply_uuid: "550e8400-...",                            │
│      conversation_url: "https://..."                        │
│    }                                                        │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Webhook Delivery                                            │
│                                                             │
│  POST https://gjqbbgrfhijescaouqkx.supabase.co/           │
│       functions/v1/bison-interested-webhook                 │
│                                                             │
│  Headers:                                                   │
│    Content-Type: application/json                           │
│    X-Webhook-Signature: ...                                 │
│                                                             │
│  Body: {event: {...}}                                       │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Supabase Edge Function                                      │
│ (bison-interested-webhook)                                  │
│                                                             │
│  1. Validate event type                                     │
│  2. Extract lead data                                       │
│  3. Query existing lead in database                         │
│  4. Preserve pipeline_stage if exists                       │
│  5. Upsert lead with interested: true                       │
│  6. Return 200 OK                                           │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Supabase Database                                           │
│ (client_leads table)                                        │
│                                                             │
│  INSERT or UPDATE                                           │
│  {                                                          │
│    lead_email: "prospect@example.com",                      │
│    workspace_name: "Kim Wallace",                           │
│    bison_lead_id: "67890",                                  │
│    interested: true, ✓                                      │
│    first_name: "John",                                      │
│    last_name: "Doe",                                        │
│    reply_uuid: "550e8400-...",                              │
│    conversation_url: "https://...",                         │
│    pipeline_stage: "new" (or preserved value)               │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Client CRM Portal                                           │
│                                                             │
│  Query: SELECT * FROM client_leads                          │
│         WHERE workspace_name = 'Kim Wallace'                │
│         AND interested = true                               │
│         ORDER BY created_at DESC                            │
│                                                             │
│  Display:                                                   │
│  ┌────────────────────────────────────────────┐           │
│  │ New Lead: John Doe                          │           │
│  │ Email: prospect@example.com                 │           │
│  │ Company: Acme Inc                           │           │
│  │ Status: Interested ✓                        │           │
│  │ [View Conversation] [Move to Pipeline]      │           │
│  └────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### Manual Sync Flow (When Webhook Fails)

```
┌─────────────────────────────────────────────────────────────┐
│ Troubleshooting: Webhook not delivering events             │
│                                                             │
│  Engineer runs: ./scripts/sync-kim-wallace-leads.sh        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Switch Workspace Context                           │
│                                                             │
│  POST /api/workspaces/v1.1/switch-workspace                 │
│  { workspace_id: 4 }                                        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Query All Interested Replies                       │
│                                                             │
│  GET /api/replies?status=interested&per_page=100            │
│                                                             │
│  Response: { total: 590, last_page: 40 }                   │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Paginate Through All Replies                       │
│                                                             │
│  for page in 1..40:                                         │
│    GET /api/replies?status=interested&page=${page}          │
│    Extract all lead_id values                               │
│                                                             │
│  Result: [67890, 67891, 67892, ...]                        │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Get Unique Lead IDs                                │
│                                                             │
│  unique_lead_ids = deduplicate(all_lead_ids)               │
│                                                             │
│  Result: 456 unique leads from 590 replies                  │
│  (Some leads have multiple interested replies)             │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 5: Fetch Full Lead Details                            │
│                                                             │
│  for each lead_id in unique_lead_ids:                       │
│    GET /api/leads/${lead_id}                                │
│    Extract full contact info                                │
│    sleep 0.2 (rate limiting)                                │
└─────────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────────┐
│ Step 6: Upsert to Database                                  │
│                                                             │
│  for each lead:                                             │
│    POST /rest/v1/client_leads                               │
│    Header: Prefer: resolution=merge-duplicates              │
│    Body: { lead_email, workspace_name, interested: true }   │
│                                                             │
│  Result: All interested leads now in CRM                    │
└─────────────────────────────────────────────────────────────┘
```

## Database Schema

### client_leads Table

```sql
CREATE TABLE client_leads (
  id BIGSERIAL PRIMARY KEY,
  lead_email TEXT NOT NULL,
  workspace_name TEXT NOT NULL,
  bison_lead_id TEXT NOT NULL,
  interested BOOLEAN DEFAULT false,

  -- Contact info
  first_name TEXT,
  last_name TEXT,
  company_name TEXT,
  phone TEXT,

  -- Email Bison references
  reply_uuid TEXT,
  conversation_url TEXT,
  airtable_id TEXT,

  -- Pipeline management
  pipeline_stage TEXT DEFAULT 'new',
  assigned_to TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  UNIQUE(lead_email, workspace_name),
  UNIQUE(bison_lead_id)
);

-- Indexes for performance
CREATE INDEX idx_workspace_interested ON client_leads(workspace_name, interested);
CREATE INDEX idx_bison_lead_id ON client_leads(bison_lead_id);
CREATE INDEX idx_pipeline_stage ON client_leads(pipeline_stage);
```

**Key Fields**:
- `interested` - Boolean flag, set to `true` when lead is marked as interested
- `bison_lead_id` - Unique ID from Email Bison, used for upserts
- `workspace_name` - Client name, used for multi-tenant filtering
- `pipeline_stage` - Current stage in sales pipeline, preserved during updates
- `reply_uuid` - Link to specific interested reply
- `conversation_url` - Direct link to Email Bison conversation

## Common Questions

### Q: Why not just query the "Interested" tag?

**A**: Tags are not reliably queryable via the API. The `/api/leads?filters[tag_ids][]=31` endpoint:
- Times out with large datasets
- Has inconsistent pagination
- May return incomplete results
- Was attempted during Kim Wallace sync and returned 0 results despite 590 interested leads existing

The reply status field is the indexed, queryable source of truth.

### Q: What if a lead has multiple interested replies?

**A**: This is normal. A prospect might reply multiple times expressing continued interest.

**Handling**:
1. Collect all interested replies
2. Extract all `lead_id` values
3. Deduplicate to get unique lead IDs
4. Fetch full lead details once per unique lead
5. Upsert to database (only one record per lead_email + workspace_name)

**Example**:
```
590 interested replies → 456 unique leads
```

### Q: How do I know if someone manually unmarked a lead as interested?

**A**: You don't, easily. The API doesn't provide change history for reply status.

**Best Practice**:
- Never automatically remove `interested: true` flag from database
- Manual sync scripts only ADD interested leads, never REMOVE
- If a lead needs to be unmarked, do it manually in the CRM portal

### Q: What happens if webhook fails for a few hours?

**A**: Leads won't appear in CRM during that window.

**Recovery**:
1. Fix webhook (see [WEBHOOK_TROUBLESHOOTING.md](./WEBHOOK_TROUBLESHOOTING.md))
2. Run manual sync script to backfill missed leads
3. Verify lead counts match between Email Bison and database

**Prevention**:
- Set up webhook health monitoring
- Alert on >1 hour without events (for active clients)
- Regular health checks (monthly)

### Q: Can I use the workspace-specific API key instead of super admin key?

**A**: For most operations, yes, but with limitations:

**Super Admin Key** (recommended):
- Can switch between any workspace
- Can access all workspaces' data
- Required for cross-workspace operations
- Used in webhook creation

**Workspace-Specific Key**:
- Only accesses that workspace's data
- Cannot switch workspaces
- Fine for single-workspace sync scripts
- More secure (limited scope)

**Best Practice**: Use super admin key for sync scripts (easier workspace switching), but store it securely.

### Q: Why do we preserve `pipeline_stage` during upserts?

**A**: If a lead already exists in the database, they may have been moved through the pipeline (e.g., "new" → "contacted" → "qualified"). When a webhook or sync updates the lead (e.g., adding a new reply_uuid), we don't want to reset their pipeline progress.

**Implementation**:
```typescript
// Check if lead exists
const { data: existingLead } = await supabase
  .from('client_leads')
  .select('id, pipeline_stage')
  .eq('lead_email', leadData.lead_email)
  .eq('workspace_name', leadData.workspace_name)
  .single();

// If exists, preserve their current stage
if (existingLead) {
  updateData.pipeline_stage = existingLead.pipeline_stage;
}
```

## Integration Points

### Email Bison → CRM (Real-time)

**Trigger**: User marks reply as interested in Email Bison UI

**Path**:
```
Email Bison → Webhook → Supabase Function → Database → CRM Portal
```

**Latency**: < 5 seconds typical

**Reliability**: Depends on webhook health

### Email Bison → CRM (Batch Sync)

**Trigger**: Manual execution of sync script

**Path**:
```
Sync Script → Email Bison API → Database → CRM Portal
```

**Latency**: 3-10 minutes for 500+ leads

**Reliability**: High (direct API calls, retryable)

### CRM Portal → Database

**Trigger**: Client views CRM, updates lead, moves pipeline stage

**Path**:
```
CRM Portal → Supabase Client → Database → Webhook (optional)
```

**Queries**:
```sql
-- Get all interested leads for client
SELECT * FROM client_leads
WHERE workspace_name = 'Kim Wallace'
  AND interested = true
ORDER BY created_at DESC;

-- Get leads by pipeline stage
SELECT * FROM client_leads
WHERE workspace_name = 'Kim Wallace'
  AND interested = true
  AND pipeline_stage = 'qualified'
ORDER BY created_at DESC;
```

## Monitoring and Metrics

### Key Metrics to Track

1. **Interested Reply Volume**
   - Metric: Total interested replies per workspace
   - Query: `GET /api/replies?status=interested`
   - Baseline: Varies by client (10-100 per week typical)

2. **Database Lead Count**
   - Metric: Total interested leads in database per workspace
   - Query: `SELECT COUNT(*) FROM client_leads WHERE workspace_name = 'X' AND interested = true`
   - Should match Email Bison count ±2

3. **Webhook Delivery Rate**
   - Metric: % of LEAD_INTERESTED events successfully delivered
   - Check: Supabase function invocation logs
   - Target: >99% delivery rate

4. **Sync Lag**
   - Metric: Time between reply marked interested and appearing in CRM
   - Check: Compare reply timestamp vs database created_at
   - Target: <1 minute for webhook, <24 hours for manual sync

### Alerting Thresholds

```yaml
alerts:
  - name: "Webhook delivery failure"
    condition: "No LEAD_INTERESTED events for 24 hours AND client is active"
    action: "Run manual sync, investigate webhook"

  - name: "Lead count mismatch"
    condition: "Database count < Email Bison count - 10"
    action: "Run manual sync to backfill"

  - name: "Sync script failure"
    condition: "Manual sync exits with error code"
    action: "Check logs, verify API keys, retry"
```

## Related Documentation

- [SYNC_CLIENT_LEADS.md](./SYNC_CLIENT_LEADS.md) - Manual lead sync procedure
- [WEBHOOK_TROUBLESHOOTING.md](./WEBHOOK_TROUBLESHOOTING.md) - Webhook diagnostics
- [EMAIL_BISON_API_REFERENCE.md](../EMAIL_BISON_API_REFERENCE.md) - Complete API docs

## Lessons Learned

### From Devin Hodo Fix (Original Discovery)
- Tag filtering approach doesn't work reliably
- Reply status endpoint is the correct approach
- Field name mismatches cause silent failures (`email` vs `lead_email`)
- Database constraints can reject inserts without clear errors

### From Kim Wallace Investigation (This Week)
- Webhooks can be listed in registry but not actually exist
- Tag-based sync function returns 0 results despite 590 actual interested leads
- Always verify webhook exists before trusting registry
- Interested tags ARE being applied by sales team (user confirmed)
- The issue is querying them via API, not the data itself

### Best Practices Established
1. **Always use reply status endpoint** for interested leads
2. **Always switch workspace context** before API calls
3. **Always preserve pipeline_stage** during upserts
4. **Always add rate limiting** for bulk operations
5. **Always verify webhooks exist** before assuming they work
6. **Document everything** to prevent repeating same troubleshooting
