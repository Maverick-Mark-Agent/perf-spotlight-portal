# Client Portal - Next Steps

## What We've Built So Far

### ✅ Completed
1. **Audited Kim Wallace's Airtable data**
   - Found ~16+ leads
   - Identified pipeline stages: Follow-Up, Quoting, Won
   - Identified custom fields: Birthday, Renewal Date, ICP, MJ Notes
   - Confirmed Email Bison links exist in `link` field

2. **Created Supabase Schema**
   - File: `supabase/migrations/20251003150000_create_client_leads.sql`
   - Table: `client_leads` with all necessary fields
   - Indexes for performance
   - RLS enabled for future client auth

3. **Created Sync Function**
   - File: `supabase/functions/sync-client-leads/index.ts`
   - Syncs Airtable Positive Replies → Supabase
   - Maps "Lead Status" to pipeline stages
   - Supports workspace filtering
   - Batch upserts (100 at a time)

## Next Steps to Complete Client Portal

### Step 1: Run SQL Migration (YOU NEED TO DO THIS)

Go to [Supabase SQL Editor](https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new)

Copy and paste the SQL from:
```
supabase/migrations/20251003150000_create_client_leads.sql
```

Click "Run" to create the `client_leads` table.

### Step 2: Deploy Sync Function

```bash
SUPABASE_ACCESS_TOKEN="sbp_765c83453a7d30be808b30e47cc230e0e9686015" \
  supabase functions deploy sync-client-leads --project-ref gjqbbgrfhijescaouqkx
```

### Step 3: Run Initial Sync for Kim Wallace

```bash
curl -X POST \
  'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-client-leads?workspace=Kim%20Wallace' \
  -H 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' \
  -H 'Content-Type: application/json'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Client leads synced successfully",
  "stats": {
    "totalAirtableRecords": 500,
    "recordsToSync": 16,
    "syncedCount": 16,
    "errorCount": 0
  },
  "workspace": "Kim Wallace"
}
```

### Step 4: Build Client Portal UI

#### 4.1 Create Portal Page Component
- File: `src/pages/ClientPortalPage.tsx`
- Kanban board layout with pipeline stages
- Lead cards showing key info
- Stats cards (total leads, this week, this month)

#### 4.2 Add Drag-and-Drop
- Install: `npm install @dnd-kit/core @dnd-kit/sortable`
- Implement column-to-column drag
- Auto-save stage changes to Supabase

#### 4.3 Create Lead Detail Modal
- Show full lead information
- Link to Email Bison conversation
- Edit notes
- Move to different stage

#### 4.4 Add Filtering & Search
- Filter by date range
- Search by name/email
- Filter by pipeline stage
- Filter by renewal date

### Step 5: Add Route to Dashboard

In `src/App.tsx`, add route:
```typescript
<Route path="/client-portal/:workspace" element={<ClientPortalPage />} />
```

## Future: Move from Airtable to Email Bison Direct

### Current Problem
- Leads come from Email Bison
- Currently stored/managed in Airtable
- We sync Airtable → Supabase → Dashboard
- **Dependency on Airtable is unnecessary**

### Solution: Direct Email Bison Integration

**Option A: Webhook from Email Bison**
```
Email Bison detects positive reply
  ↓ (webhook)
Supabase Edge Function
  ↓
Insert into client_leads table
  ↓ (Realtime subscription)
Dashboard auto-updates
```

**Option B: Scheduled Sync from Email Bison API**
```
Cron job (every 5 minutes)
  ↓
Fetch new replies from Email Bison API
  ↓
Upsert to client_leads table
  ↓
Dashboard shows new leads
```

**Recommended:** Option A (webhook) for instant updates

### Email Bison API Endpoints Needed

1. **Get Positive Replies**
   ```
   GET /api/workspaces/{workspace_id}/positive-replies
   ```

2. **Get Single Reply Details**
   ```
   GET /api/replies/{reply_id}
   ```

3. **Webhook Registration** (if available)
   ```
   POST /api/webhooks
   {
     "event": "positive_reply_received",
     "url": "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/email-bison-webhook"
   }
   ```

## Pipeline Stages

### Kim Wallace's Stages
- `new` - Just received (no status in Airtable)
- `follow-up` - Initial outreach sent
- `quoting` - Providing insurance quote
- `won` - Client closed/sold
- `lost` - Did not convert (future)
- `nurture` - Follow up later (future)

### Other Clients May Need Different Stages

Example B2B SaaS client:
- `new` → `contacted` → `demo` → `trial` → `negotiation` → `won`/`lost`

**Solution:** Store client-specific pipeline config in `clients` table or config file.

## Data Model

### Supabase client_leads Table

| Field | Type | Source | Notes |
|-------|------|--------|-------|
| id | UUID | Generated | Primary key |
| airtable_id | TEXT | Airtable | Unique, for sync |
| workspace_name | TEXT | Airtable/Bison | Client identifier |
| lead_email | TEXT | Bison | Prospect email |
| first_name | TEXT | Bison | Extracted from reply |
| last_name | TEXT | Bison | Extracted from reply |
| phone | TEXT | Bison | Contact phone |
| address | TEXT | Bison | Mailing address |
| city, state, zip | TEXT | Bison | Location |
| date_received | TIMESTAMP | Bison | When reply came in |
| reply_received | TEXT | Bison | The actual reply text |
| email_sent | TEXT | Bison | Original outreach |
| email_subject | TEXT | Bison | Subject line |
| renewal_date | TEXT | Bison/Manual | Insurance renewal |
| birthday | TEXT | Manual | DOB for quotes |
| pipeline_stage | TEXT | Manual | Current stage |
| pipeline_position | INTEGER | Manual | Sort order |
| notes | TEXT | Manual | Internal notes |
| bison_conversation_url | TEXT | Bison | Link to conversation |
| bison_lead_id | TEXT | Bison | Lead ID in Bison |

## Client-by-Client Rollout

### Phase 1: Kim Wallace (Pilot)
- [x] Audit data
- [x] Create schema
- [x] Create sync function
- [ ] Run migration
- [ ] Deploy sync function
- [ ] Build UI
- [ ] Test with Kim
- [ ] Gather feedback

### Phase 2: Next Clients
For each new client:
1. Audit their Airtable Positive Replies
2. Check for custom fields
3. Check their pipeline stages
4. Add custom fields to schema if needed
5. Update sync function mapping
6. Create client config
7. Deploy

### Phase 3: Eliminate Airtable
1. Set up Email Bison webhooks
2. Create email-bison-webhook function
3. Test with one client
4. Migrate all clients
5. Deprecate Airtable Positive Replies table

## Questions for User

1. **Auth:** When should we add client login? (Now or later?)
2. **Notifications:** Should clients get notified of new leads? (Email/Slack?)
3. **Team Access:** Can team members see all clients' leads, or only assigned ones?
4. **Exports:** Do clients need to export leads to CSV?
5. **Custom Fields:** Should we build a UI for clients to add custom fields?

## Estimated Timeline

- **SQL Migration + Deploy Sync:** 10 minutes
- **Initial Sync Test:** 5 minutes
- **Build Portal UI:** 8-10 hours
- **Drag-and-Drop:** 4-6 hours
- **Testing with Kim:** 2-4 hours
- **Refinements:** 4-6 hours

**Total for Kim Wallace Portal:** ~18-26 hours

**Per Additional Client:** ~2-4 hours (assuming no major custom fields)

---

## Ready to Continue?

We've completed the backend foundation. Next up is building the UI!

Should I continue with creating the ClientPortalPage component?
