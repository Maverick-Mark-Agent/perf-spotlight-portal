# Comprehensive Backfill Solution

## 🎯 Problem Identified

The Email Bison API has **session-based workspace switching** that causes race conditions when querying multiple workspaces programmatically. When switching workspaces too quickly, the API returns data from the wrong workspace.

**Example of the problem:**
- David Amiri, Jason Binyon, Rob Russell, Shane Miller, Tony Schmitz ALL showed **162,179 leads** (identical) - clear evidence of workspace context corruption

## ✅ Solution Implemented

### Approach: Batched Processing with Long Delays

**Key Strategy:**
1. Process clients in batches of 6
2. 10-second delays between each client
3. Deduplication by email (keep most recent reply)
4. Proper error handling and logging

### Scripts Created

#### 1. `backfill-single-client.sh`
- Processes ONE client at a time
- Fetches ALL interested replies with pagination
- Deduplicates by email
- Inserts in batches of 100

#### 2. `run-backfill-batch.sh`
- Runs batches of 6 clients
- 10-second delays between clients
- Usage: `./run-backfill-batch.sh [1-4]`

### Execution Plan

**Batch 1 (Clients 1-6):**
- ATI
- Boring Book Keeping
- Danny Schwartz
- David Amiri
- Devin Hodo
- Gregg Blanchard

**Batch 2 (Clients 7-12):**
- Jason Binyon
- Jeff Schroder
- John Roberts
- Kim Wallace
- Kirk Hodgson
- Koppa Analytics

**Batch 3 (Clients 13-18):**
- Littlegiant
- LongRun
- Maverick In-house
- Nick Sakha
- Ozment Media
- Radiant Energy

**Batch 4 (Clients 19-24):**
- Rob Russell
- Shane Miller
- SMA Insurance
- StreetSmart Commercial
- Tony Schmitz
- Workspark

## 📊 Current Status

**Batch 1:** ⏳ Running (started at 6:59 PM PST)
**Batch 2:** ⏸️ Pending
**Batch 3:** ⏸️ Pending
**Batch 4:** ⏸️ Pending

## 🔄 How to Run

### Step 1: Run Batch 1
```bash
./scripts/run-backfill-batch.sh 1
```

### Step 2: Wait for Completion (~10-15 minutes)

### Step 3: Run Batch 2
```bash
./scripts/run-backfill-batch.sh 2
```

### Step 4: Repeat for Batches 3 & 4

### Step 5: Verify Results
```bash
npx tsx scripts/diagnostic-full-comparison.ts
```

## 📈 Expected Results

After all 4 batches complete:
- All 24 active clients will have their historical interested leads
- Deduplication ensures one lead per unique email address
- KPI Dashboard will show accurate totals
- October MTD counts will be available for billing

## 🔍 Verification

### Check Individual Client
```bash
curl -s "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/client_leads?select=count&workspace_name=eq.Kim%20Wallace&interested=eq.true" \
  -H "apikey: <SUPABASE_KEY>" \
  -H "Prefer: count=exact"
```

### Run Full Diagnostic
```bash
npx tsx scripts/diagnostic-full-comparison.ts
```

### Generate KPI Report
```bash
npx tsx scripts/generate-kpi-report.ts
```

## 🚨 Troubleshooting

### If a batch fails:
1. Check which client failed
2. Re-run that specific client:
   ```bash
   ./scripts/backfill-single-client.sh "Client Name"
   ```
3. Continue with next batch

### If workspace switching still fails:
- Increase delay in `backfill-single-client.sh` (line 66: `await sleep(2000)` → `await sleep(5000)`)
- Increase delay in `run-backfill-batch.sh` (line 74: `sleep 10` → `sleep 15`)

## 🎯 Going Forward

### November 2025+ (Automated)
✅ Webhook configured on both Email Bison instances
✅ Real-time lead capture
✅ No manual syncing needed

### Data Architecture
```
Email Bison (Real-time)
    ↓
bison-interested-webhook
    ↓
Supabase client_leads table
    ↓
hybrid-workspace-analytics Edge Function
    ↓
KPI Dashboard
```

## 📝 Notes

- **Deduplication Logic:** When a lead replies multiple times, we keep the reply with the highest ID (most recent)
- **Performance:** Each client takes ~1-3 minutes depending on reply count
- **Reliability:** 10-second delays ensure workspace context is clean between clients
- **Billing Accuracy:** October 2025 totals will be accurate once all batches complete

## ✅ Success Criteria

- [ ] All 4 batches completed successfully
- [ ] Diagnostic shows matches between Email Bison and Supabase
- [ ] KPI Dashboard displays correct totals
- [ ] October MTD counts ready for billing
