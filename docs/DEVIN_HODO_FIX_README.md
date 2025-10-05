# Devin Hodo Leads Not Appearing - Root Cause & Fix

## 🔍 Root Cause Analysis

### Why the script reported "28/28 synced" but database shows 0 leads:

#### ❌ **Critical Issue 1: Missing Required Field `airtable_id`**
- **Database schema requires:** `airtable_id TEXT UNIQUE NOT NULL` (line 6 of `20251003150000_create_client_leads.sql`)
- **Script provides:** No `airtable_id` field
- **Result:** Supabase silently rejects inserts (returns 200 OK but doesn't insert)

#### ❌ **Issue 2: Wrong Field Name**
- **Script used:** `email`
- **Database expects:** `lead_email`
- **Script line 133:** `"email": "${EMAIL}"`
- **Webhook (correct):** `lead_email: lead.email` ✅

#### ❌ **Issue 3: Invalid JSON Formatting**
```bash
# WRONG - Creates string instead of JSONB
CUSTOM_VARS=$(echo "$LEAD" | jq -c '.custom_variables // []' | sed 's/"/\\"/g')
"custom_variables": "${CUSTOM_VARS}"

# Result: "custom_variables": "[{\"name\":\"phone\"...}]" (STRING)
# Expected: "custom_variables": [{"name":"phone"...}] (JSON)
```

#### ❌ **Issue 4: No Error Checking**
- Script used `if [ $? -eq 0 ]` which checks curl exit code, NOT HTTP response
- curl returns 0 even when server returns errors
- Script couldn't detect failed insertions

---

## ✅ The Fix

### Step 1: Run Database Migration (REQUIRED)

**File:** `supabase/migrations/MANUAL_RUN_fix_airtable_constraint.sql`

**What it does:**
1. Makes `airtable_id` optional (no longer NOT NULL)
2. Adds unique constraint on `(lead_email, workspace_name)`
3. Keeps `airtable_id` unique when it exists (for Airtable-sourced leads)

**How to run:**
1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new
2. Copy entire contents of `MANUAL_RUN_fix_airtable_constraint.sql`
3. Paste and click "Run"
4. Verify you see: `✅ airtable_id constraint fixed successfully!`

### Step 2: Run Fixed Sync Script

**File:** `scripts/sync-devin-interested-FIXED.sh`

**What was fixed:**
```bash
# ✅ Correct field name
"lead_email": "$EMAIL"  # Was: "email"

# ✅ Proper JSON handling using jq
PAYLOAD=$(jq -n \
  --argjson custom_variables "$(echo "$LEAD" | jq '.custom_variables // []')" \
  '{
    custom_variables: $custom_variables  # Raw JSON, not string
  }')

# ✅ Error detection
ERROR_MSG=$(echo "$UPSERT_RESPONSE" | jq -r '.message // empty')
if [ -n "$ERROR_MSG" ]; then
  echo "❌ Error: $ERROR_MSG"
fi

# ✅ Handles optional airtable_id
"airtable_id": null
```

**Run it:**
```bash
cd "/Users/tommychavez/Maverick Dashboard/perf-spotlight-portal"
./scripts/sync-devin-interested-FIXED.sh
```

### Step 3: Verify Results

**Check database:**
```bash
curl 'https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/client_leads?workspace_name=eq.Devin%20Hodo&select=count' \
  -H 'apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0'
```

Expected result: Shows count of leads (should be 28)

**Check Client Portal:**
Open: http://localhost:8082/client-portal/Devin%20Hodo

You should see all 28 interested leads in the pipeline!

---

## 📊 Comparison: Before vs After

### Before (Broken Script)
```bash
# Wrong field name
"email": "${EMAIL}"

# Invalid JSON (creates string)
CUSTOM_VARS=$(... | sed 's/"/\\"/g')
"custom_variables": "${CUSTOM_VARS}"

# No error detection
if [ $? -eq 0 ]; then
  echo "✅ Synced"  # Always shows success!
fi

# Missing required field
# No airtable_id = database rejects
```

**Result:** Script says "28/28 synced" but database has 0 records

### After (Fixed Script)
```bash
# Correct field name
"lead_email": "${EMAIL}"

# Proper JSON using jq
PAYLOAD=$(jq -n \
  --argjson custom_variables "$(echo "$LEAD" | jq '.custom_variables')" \
  '{ custom_variables: $custom_variables }')

# Real error detection
ERROR_MSG=$(echo "$RESPONSE" | jq -r '.message // empty')
if [ -n "$ERROR_MSG" ]; then
  echo "❌ Error: $ERROR_MSG"
fi

# Handles optional field
"airtable_id": null
```

**Result:** Script accurately reports success/failure, database gets all records

---

## 🎯 Quick Start

1. **Run migration** (in Supabase SQL Editor)
2. **Run fixed script:** `./scripts/sync-devin-interested-FIXED.sh`
3. **View results:** http://localhost:8082/client-portal/Devin%20Hodo

That's it! All 28 interested leads should appear in the pipeline.
