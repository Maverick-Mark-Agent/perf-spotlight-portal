# Contact Pipeline Automation Guide

## Overview

The Contact Pipeline system automates the entire homeowner insurance lead processing workflow, replacing the manual Clay-based process. It handles everything from Cole X Dates CSV uploads through email verification and weekly batch uploads to Email Bison.

## Architecture

```
MONTHLY PROCESS (15th of each month):
Cole X Dates CSV Upload
    ↓
process-contact-upload (Edge Function)
    ↓
raw_contacts table (filtered & parsed)
    ↓
verify-contacts-debounce (Edge Function)
    ↓
verified_contacts table (email verified, renewal windows calculated)
    ↓
generate-weekly-batches (Edge Function)
    ↓
weekly_batches table (4 batches created)

WEEKLY PROCESS (Every Monday):
slack-notify-weekly-batch (Edge Function)
    ↓
Slack notification sent to team
    ↓
Team approves via /approve-batch command
    ↓
slack-approve-batch (Edge Function)
    ↓
upload-to-email-bison (Edge Function)
    ↓
Contacts uploaded to Email Bison
    ↓
Added to Evergreen campaigns
    ↓
Campaign renamed with renewal dates
```

## Database Schema

### 1. `raw_contacts`
Stores uploaded Cole X Dates CSV data before processing.

**Key Fields:**
- `upload_batch_id`: Groups contacts from single CSV
- `first_name`, `last_name`, `email`: Contact info
- `property_*`, `mailing_*`: Address fields
- `home_value_estimate`, `purchase_date`: Property details
- `is_head_of_household`: Filtered (no "&" or "and" in name)
- `meets_value_criteria`: <$900k (or >$900k HNW for TX)
- `is_high_net_worth`: >$900k homes in Texas
- `parsed_purchase_date`: Extracted date for renewal calculation
- `processing_status`: pending → ready_for_verification → verified
- `filter_reason`: Why contact was excluded

### 2. `verified_contacts`
Email-verified contacts ready for weekly uploads.

**Key Fields:**
- `raw_contact_id`: Link to raw_contacts
- `purchase_day`: Day of month (1-31)
- `renewal_start_date`: M+28 days from purchase
- `renewal_end_date`: M+34 days from purchase
- `week_bucket`: 1 (days 1-7), 2 (8-14), 3 (15-21), 4 (22-end)
- `debounce_status`: deliverable/undeliverable/risky/unknown
- `debounce_response`: Full Debounce API result (JSONB)
- `is_high_net_worth`: Routes to HNW Evergreen campaign
- `target_campaign`: "Evergreen" or "HNW Evergreen"
- `is_uploaded`: Whether sent to Email Bison
- `upload_batch_id`: Link to weekly_batches

### 3. `weekly_batches`
Tracks each Monday upload batch.

**Key Fields:**
- `batch_id`: UUID
- `workspace_name`: Client workspace
- `month`: Processing month (YYYY-MM)
- `week_number`: 1-4 (which Monday of month)
- `week_bucket`: 1-4 (which purchase day range)
- `scheduled_upload_date`: The Monday for upload
- `actual_upload_date`: When actually uploaded
- `contact_count`: Total contacts in batch
- `hnw_count`: High Net Worth contacts
- `csv_file_path`: Generated CSV location
- `bison_upload_id`: Email Bison upload ID
- `bison_campaign_name`: Campaign name after renaming
- `bison_upload_status`: pending → uploaded → added_to_campaign → failed
- `slack_notification_sent`: Notification status
- `slack_approved_by`: Who approved the batch
- `slack_approved_at`: Approval timestamp

### 4. `upload_audit_log`
Complete audit trail of all operations.

**Key Fields:**
- `batch_id`: Link to weekly_batches
- `action`: csv_upload, contact_verification, batch_generation, bison_upload, campaign_add, campaign_rename, slack_notification
- `status`: success, partial_success, failed
- `contacts_processed`, `contacts_succeeded`, `contacts_failed`
- `api_endpoint`, `api_request`, `api_response`: Full API details
- `duration_ms`: Operation duration
- `credits_used`: Debounce credits consumed

### 5. `debounce_usage`
Tracks Debounce API credit consumption.

**Key Fields:**
- `month`: Processing month
- `credits_used`: API credits consumed
- `emails_verified`: Total emails checked
- `deliverable_count`, `undeliverable_count`, `risky_count`, `unknown_count`

## Edge Functions

### 1. `process-contact-upload`
**Purpose:** Parse and filter Cole X Dates CSV uploads

**Endpoint:** `POST /functions/v1/process-contact-upload`

**Request (multipart/form-data):**
```json
{
  "csv_file": File,
  "workspace_name": "Danny Schwartz",
  "month": "2025-11",
  "uploaded_by": "tommy@example.com"
}
```

**Process:**
1. Parse CSV (13 columns from Cole X Dates)
2. Filter Head of Household (no "&", "and", or "," in first name)
3. Apply home value criteria (<$900k standard, >$900k HNW for TX)
4. Parse purchase dates
5. Validate email format
6. Insert into `raw_contacts` with status

**Response:**
```json
{
  "success": true,
  "upload_batch_id": "uuid",
  "summary": {
    "total_contacts": 5000,
    "ready_for_verification": 4200,
    "filtered_out": 800,
    "hnw_contacts": 150,
    "filter_reasons": {
      "Not head of household": 300,
      "Home value >=$900k outside criteria": 400,
      "Invalid email format": 100
    }
  }
}
```

### 2. `verify-contacts-debounce`
**Purpose:** Verify emails and calculate renewal windows

**Endpoint:** `POST /functions/v1/verify-contacts-debounce`

**Request:**
```json
{
  "workspace_name": "Danny Schwartz",
  "month": "2025-11",
  "batch_size": 100
}
```

**Process:**
1. Fetch unverified contacts (status = ready_for_verification)
2. Batch verify via Debounce API (100 emails per request)
3. Calculate renewal windows (M+28 to M+34 days)
4. Assign week buckets based on purchase day
5. Insert into `verified_contacts`
6. Update `raw_contacts` status to verified
7. Track Debounce usage

**Response:**
```json
{
  "success": true,
  "verified_count": 100,
  "summary": {
    "deliverable": 85,
    "undeliverable": 10,
    "risky": 3,
    "unknown": 2,
    "credits_used": 100,
    "duration_ms": 5000
  }
}
```

### 3. `generate-weekly-batches`
**Purpose:** Create weekly upload batches for Mondays

**Endpoint:** `POST /functions/v1/generate-weekly-batches`

**Request:**
```json
{
  "workspace_name": "Danny Schwartz",
  "month": "2025-11"
}
```

**Process:**
1. Find all Mondays in the month
2. Group verified contacts by week_bucket (1-4)
3. Create batch record for each Monday
4. Generate CSV files
5. Schedule uploads

**Response:**
```json
{
  "success": true,
  "batches_created": 4,
  "batches": [
    {
      "batch_id": "uuid",
      "week_number": 1,
      "scheduled_date": "2025-11-03",
      "contact_count": 1200,
      "hnw_count": 50
    },
    // ... 3 more batches
  ]
}
```

### 4. `upload-to-email-bison`
**Purpose:** Upload batch to Email Bison and manage campaigns

**Endpoint:** `POST /functions/v1/upload-to-email-bison`

**Request:**
```json
{
  "batch_id": "uuid"
}
```

**Process:**
1. Fetch batch details and contacts
2. Switch to client's Email Bison workspace
3. Generate CSV in Email Bison format
4. Upload standard contacts to Evergreen campaign
5. Upload HNW contacts to HNW Evergreen campaign
6. Rename campaigns with renewal dates
7. Mark contacts as uploaded
8. Update batch status

**Response:**
```json
{
  "success": true,
  "batch_id": "uuid",
  "contacts_uploaded": 1200,
  "upload_results": [
    {
      "campaign": "Evergreen",
      "contacts": 1150,
      "upload_id": "12345",
      "campaign_name": "Evergreen 2025-12-01 to 2025-12-07"
    },
    {
      "campaign": "HNW Evergreen",
      "contacts": 50,
      "upload_id": "12346",
      "campaign_name": "HNW Evergreen 2025-12-01 to 2025-12-07"
    }
  ]
}
```

### 5. `slack-notify-weekly-batch`
**Purpose:** Send Slack notifications for pending batches

**Endpoint:** `POST /functions/v1/slack-notify-weekly-batch`

**Runs:** Automatically via cron on Mondays at 8 AM

**Process:**
1. Find batches scheduled for today (pending status)
2. Generate approval message with details
3. Send to Slack channel
4. Mark notification as sent

**Slack Message Format:**
```
📋 Weekly Contact Upload - Approval Required

2 batches scheduled for upload today
Please review and approve each batch below

──────────────────────────────

Danny Schwartz - Week 1
• Batch ID: `123e4567-e89b-12d3-a456-426614174000`
• Total Contacts: 1,200
• Standard: 1,150 (Evergreen campaign)
• High Net Worth: 50 (HNW Evergreen campaign)
• Upload Date: 2025-11-03

To approve: Reply with `/approve-batch 123e4567-e89b-12d3-a456-426614174000`

──────────────────────────────

📌 Next Steps:
1. Review contact counts for each client
2. Approve batches by replying with `/approve-batch <batch_id>`
3. Approved batches will be uploaded to Email Bison automatically
```

### 6. `slack-approve-batch`
**Purpose:** Handle /approve-batch slash command

**Endpoint:** `POST /functions/v1/slack-approve-batch`

**Slack Command:** `/approve-batch <batch_id>`

**Process:**
1. Parse batch_id from command
2. Validate batch exists and is pending
3. Mark batch as approved (record approver and timestamp)
4. Trigger `upload-to-email-bison` function
5. Post confirmation to Slack channel

**Slack Response:**
```
✅ Batch Approved & Uploaded

• Batch ID: `123e4567-e89b-12d3-a456-426614174000`
• Client: Danny Schwartz
• Week: 1
• Contacts: 1,200
• Approved by: tommy
• Status: Uploaded to Email Bison successfully

Notification sent: Nov 3, 2025 at 8:05 AM
```

## Monthly Workflow

### Step 1: Upload Cole X Dates CSV (15th of Month)
On the 15th of each month, upload next month's CSV file:

1. Navigate to Contact Pipeline Dashboard
2. Click "Upload CSV"
3. Select workspace (client)
4. Select month (format: 2025-11)
5. Choose CSV file from Cole X Dates
6. Click "Upload & Process"

**What Happens:**
- CSV parsed and validated
- Head of Household filter applied
- Home value criteria checked
- Invalid emails removed
- Purchase dates parsed
- Contacts stored in `raw_contacts`

**Expected Results:**
- ~15,000 contacts for 100-lead tier
- ~30,000 contacts for 200-lead tier
- ~10-20% filtered out
- Status: ready_for_verification

### Step 2: Verify Emails (Automatic)
After upload completes, verification runs automatically:

**Process:**
- Batches of 100 emails sent to Debounce API
- Rate limited to avoid overwhelming API
- Runs in background (may take 10-30 minutes)

**What's Calculated:**
- Email deliverability status
- Purchase day (1-31)
- Renewal start date (M+28 days)
- Renewal end date (M+34 days)
- Week bucket assignment (1-4)

**Expected Results:**
- ~85-90% deliverable
- ~10-15% undeliverable/risky
- All verified contacts ready for batching

### Step 3: Generate Weekly Batches (Automatic)
After verification completes:

**Process:**
- Identifies all Mondays in the month
- Groups contacts by week bucket
- Creates 4 batch records
- Generates CSV files
- Schedules uploads

**Week Bucket Logic:**
- **Bucket 1** (Week 1): Purchase days 1-7 → 1st Monday
- **Bucket 2** (Week 2): Purchase days 8-14 → 2nd Monday
- **Bucket 3** (Week 3): Purchase days 15-21 → 3rd Monday
- **Bucket 4** (Week 4): Purchase days 22-31 → 4th Monday

**Expected Results:**
- 4 batches created per client
- ~25% of contacts per batch
- Status: pending

## Weekly Workflow

### Monday Morning: Slack Notification (8 AM)
Every Monday at 8 AM, team receives Slack notification:

**Message Includes:**
- List of all batches scheduled for today
- Client name, week number, contact count
- Standard vs HNW breakdown
- Batch ID for approval

**Team Action Required:**
- Review contact counts
- Verify clients are correct
- Approve each batch via slash command

### Approve Batch (Via Slack)
To approve a batch:

1. Copy batch ID from notification
2. Reply in Slack: `/approve-batch <batch_id>`
3. Wait for confirmation (30 seconds - 2 minutes)

**What Happens After Approval:**
1. Batch marked as approved (records approver + timestamp)
2. Upload function triggered automatically
3. Contacts uploaded to Email Bison
4. Added to Evergreen campaigns
5. Campaigns renamed with renewal dates
6. Confirmation posted to Slack

**Expected Duration:**
- Small batches (<1000 contacts): 1-2 minutes
- Large batches (>2000 contacts): 3-5 minutes

### Upload Results
After successful upload:

**Standard Contacts:**
- Uploaded to "Evergreen" campaign
- Campaign renamed: "Evergreen 2025-12-01 to 2025-12-07"
- Contacts added to existing campaign

**High Net Worth Contacts (TX >$900k):**
- Uploaded to "HNW Evergreen" campaign
- Campaign renamed: "HNW Evergreen 2025-12-01 to 2025-12-07"
- Separate from standard contacts

**Audit Trail:**
- All operations logged to `upload_audit_log`
- API requests/responses stored
- Duration and credits tracked

## Dashboard Usage

### Contact Pipeline Dashboard

**URL:** `/contact-pipeline-dashboard`

**Features:**
1. **Overview Cards**
   - Total Target: Monthly contact quota
   - Verified Contacts: Email-verified count + % of target
   - Uploaded: Sent to Email Bison
   - Pending Upload: Ready for weekly batches

2. **Client Progress Tab**
   - Per-client breakdown
   - Verification stats (deliverable, undeliverable, risky)
   - Upload progress
   - HNW contact count
   - Gap analysis (contacts needed to hit target)

3. **Weekly Batches Tab**
   - All scheduled batches
   - Status (pending, uploaded, completed, failed)
   - Approval details (who approved, when)
   - Upload status (scheduled, due today, overdue, completed)

**Filters:**
- Month selector (current + past 6 months)
- Client filter (all or specific)
- Status filter (all, pending, completed)

## Database Views

### `monthly_contact_pipeline_summary`
Aggregated pipeline progress by client/month.

**Usage:**
```sql
SELECT * FROM monthly_contact_pipeline_summary
WHERE month = '2025-11'
ORDER BY target_percentage DESC;
```

**Columns:**
- `workspace_name`, `client_display_name`
- `monthly_contact_target`, `contact_tier`
- `raw_contacts_uploaded`, `verified_contacts`
- `deliverable_count`, `undeliverable_count`, `risky_count`
- `contacts_uploaded`, `contacts_pending`
- `hnw_contacts`
- `batches_created`, `batches_completed`
- `contacts_needed`, `target_percentage`

### `weekly_batch_status`
Real-time status of all batches.

**Usage:**
```sql
SELECT * FROM weekly_batch_status
WHERE scheduled_upload_date >= CURRENT_DATE
ORDER BY scheduled_upload_date;
```

**Columns:**
- `batch_id`, `workspace_name`, `client_display_name`
- `month`, `week_number`
- `scheduled_upload_date`, `actual_upload_date`
- `contact_count`, `hnw_count`
- `bison_upload_status`, `bison_campaign_name`
- `slack_approved_by`, `slack_approved_at`
- `upload_status_text` (Completed, Scheduled in X days, Due Today, Overdue by X days)

## Configuration

### Client Settings (`client_registry`)
Each client needs these fields configured:

```sql
UPDATE client_registry
SET
  monthly_contact_target = 15000,  -- 15k for 100-lead tier, 30k for 200-lead tier
  contact_tier = '100_leads'       -- or '200_leads'
WHERE workspace_name = 'Danny Schwartz';
```

### Environment Variables (Supabase Secrets)
Required secrets:

```bash
# Debounce API
DEBOUNCE_API_KEY=your_debounce_api_key

# Email Bison API
EMAIL_BISON_API_KEY=your_email_bison_super_admin_key

# Slack Webhook
SLACK_VOLUME_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Cron Jobs
Weekly batch notifications run automatically:

```sql
-- Monday morning at 8 AM
SELECT cron.schedule(
  'slack-notify-weekly-batches',
  '0 8 * * 1',  -- Every Monday at 8 AM
  $$
  SELECT net.http_post(
    url := 'https://your-project.supabase.co/functions/v1/slack-notify-weekly-batch',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_KEY"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
```

## Monitoring & Alerts

### Key Metrics to Track

1. **Upload Success Rate**
   - Target: >95% of batches uploaded successfully
   - Alert if: <90% success rate

2. **Verification Rate**
   - Target: >85% deliverable emails
   - Alert if: <80% deliverable

3. **Target Achievement**
   - Target: 100% of monthly contact quota
   - Alert if: <80% by 20th of month

4. **Debounce Credit Usage**
   - Budget: $500/month for 1M credits
   - Alert if: >80% credits used before month end

5. **Batch Approval Delays**
   - Target: All batches approved within 1 hour of notification
   - Alert if: Batch pending >4 hours

### Audit Queries

**Check today's batch status:**
```sql
SELECT * FROM weekly_batch_status
WHERE scheduled_upload_date = CURRENT_DATE;
```

**Find failed uploads:**
```sql
SELECT * FROM upload_audit_log
WHERE status = 'failed'
  AND performed_at >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY performed_at DESC;
```

**Debounce usage this month:**
```sql
SELECT
  workspace_name,
  SUM(credits_used) AS total_credits,
  SUM(emails_verified) AS total_emails,
  AVG(deliverable_count::FLOAT / emails_verified * 100) AS avg_deliverable_rate
FROM debounce_usage
WHERE month = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
GROUP BY workspace_name;
```

**Gap analysis (clients behind target):**
```sql
SELECT
  client_display_name,
  monthly_contact_target,
  verified_contacts,
  contacts_needed,
  target_percentage
FROM monthly_contact_pipeline_summary
WHERE month = TO_CHAR(CURRENT_DATE, 'YYYY-MM')
  AND target_percentage < 80
ORDER BY target_percentage;
```

## Troubleshooting

### Issue: CSV Upload Fails
**Symptoms:** Error message when uploading CSV

**Causes:**
1. Invalid CSV format (missing columns)
2. Workspace not found in client_registry
3. Invalid month format

**Solutions:**
```bash
# Check CSV has all 13 required columns
# Expected headers:
# First Name, Last Name, Mailing Address, Mailing City, Mailing State, Mailing ZIP,
# Property Address, Property City, Property State, Property ZIP,
# Home Value Estimate, Purchase Date, Email

# Verify client exists
SELECT * FROM client_registry WHERE workspace_name = 'Client Name';

# Check month format (must be YYYY-MM)
# Correct: 2025-11
# Wrong: 11-2025, November 2025
```

### Issue: Email Verification Stuck
**Symptoms:** Contacts stuck in ready_for_verification status

**Causes:**
1. Debounce API key invalid
2. Rate limit exceeded
3. Function timeout

**Solutions:**
```bash
# Verify Debounce API key
curl -H "Authorization: Bearer $DEBOUNCE_API_KEY" https://api.debounce.io/v1/status

# Check function logs
npx supabase functions logs verify-contacts-debounce --tail 50

# Retry verification manually
curl -X POST https://your-project.supabase.co/functions/v1/verify-contacts-debounce \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"workspace_name": "Client Name", "month": "2025-11"}'
```

### Issue: Batch Upload Fails
**Symptoms:** Batch status = failed

**Causes:**
1. Email Bison workspace not found
2. Campaign not found
3. API timeout

**Solutions:**
```bash
# Check batch details
SELECT * FROM weekly_batches WHERE batch_id = 'uuid';

# Check audit log for error
SELECT * FROM upload_audit_log
WHERE batch_id = 'uuid'
  AND action = 'bison_upload'
ORDER BY performed_at DESC LIMIT 1;

# Retry upload manually
curl -X POST https://your-project.supabase.co/functions/v1/upload-to-email-bison \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"batch_id": "uuid"}'
```

### Issue: Slack Notifications Not Received
**Symptoms:** No notification on Monday morning

**Causes:**
1. Cron job not running
2. No batches scheduled for today
3. Slack webhook invalid

**Solutions:**
```bash
# Check cron job status
SELECT * FROM cron.job WHERE jobname = 'slack-notify-weekly-batches';

# Check for pending batches
SELECT * FROM weekly_batches
WHERE scheduled_upload_date = CURRENT_DATE
  AND bison_upload_status = 'pending'
  AND slack_notification_sent = false;

# Test Slack webhook
curl -X POST $SLACK_VOLUME_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"text": "Test notification"}'

# Manually trigger notification
curl -X POST https://your-project.supabase.co/functions/v1/slack-notify-weekly-batch \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## API Rate Limits

### Debounce API
- **Rate Limit:** 100 emails per request
- **Monthly Credits:** 1M credits for $500
- **Cost per Email:** $0.0005
- **Batch Processing:** Automatic (100 emails at a time)

### Email Bison API
- **Workspace Switching:** Sequential only (no parallel)
- **Contact Upload:** Max 10,000 per CSV
- **Campaign Operations:** No documented limits
- **Recommended:** Add 1-2 second delays between operations

## Future Enhancements

### Phase 2: Browser Automation
- Playwright agent for Cole X Dates scraping
- Automatic CSV download on 15th
- No manual upload required

### Phase 3: Fully Automated Approval
- Replace Slack slash command with buttons
- Auto-approve batches that meet criteria
- Manual review only for exceptions

### Phase 4: AI-Powered Optimization
- Predict optimal send times
- Adjust renewal windows based on response rates
- Recommend targeting changes

### Phase 5: Multi-Client Batching
- Combine similar clients into single batches
- Reduce API calls
- Improve efficiency

## Support

For issues or questions:
- Check `upload_audit_log` for detailed error messages
- Review Supabase function logs: `npx supabase functions logs <function-name>`
- Contact system administrator

---

**Last Updated:** 2025-10-08
**Version:** 1.0.0
**Status:** Production Ready
