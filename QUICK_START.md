# 🚀 Quick Start: API & Webhook Management Deployment

## ✅ What's Already Done

1. **Edge Function Deployed:** `sync-email-accounts-v2` ✅
2. **Shared API Client:** `workspaceApiClient.ts` ✅
3. **Documentation:** Complete architecture & deployment guides ✅

---

## 📋 What You Need to Do (3 Steps)

### **Step 1: Deploy Database Migration** (5 minutes)

1. Open: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new

2. Copy **entire file**:
   `/supabase/migrations/20251010000000_add_api_webhook_management.sql`

3. Paste → Click **Run**

4. **Success when you see:**
   ```
   === API & Webhook Management Migration Complete ===
   Total active clients: 26
   Active clients with API keys: 25
   Active clients WITHOUT API keys: 1
   ```

---

### **Step 2: Fix Workspark** (5 minutes)

#### 2a. Generate API Key

1. Login: https://send.longrun.agency/dashboard
2. Switch to **Workspark** workspace
3. Settings → API Keys → Generate New API Key
   - Name: "Workspark Workspace API"
   - Type: **Workspace** (not super admin)
4. **Copy the key**

#### 2b. Add to Database

1. Open Supabase SQL Editor (same link as Step 1)
2. Run this (replace `YOUR_KEY` with actual key):

```sql
UPDATE client_registry
SET bison_api_key = 'YOUR_KEY',
    bison_api_key_name = 'Workspark Workspace API',
    api_health_status = 'healthy'
WHERE workspace_name = 'Workspark';
```

---

### **Step 3: Test It Works** (2 minutes)

Run this command to test Workspark sync:

```bash
curl -X POST "https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/sync-email-accounts-v2" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdqcWJiZ3JmaGlqZXNjYW91cWt4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2MTc1MzAsImV4cCI6MjA3MzE5MzUzMH0.P1CMjUt2VA5Q6d8z82XbyWHAUVWqlluL--Zihs8TzC0" \
  -H "Content-Type: application/json" \
  -d '{"workspace_name": "Workspark"}'
```

**Success = No 403 error, accounts synced!**

---

## 🎯 That's It!

Once complete, you'll have:
- ✅ 100% workspace-specific API key coverage (26/26 clients)
- ✅ Complete API call audit trail
- ✅ Real-time health monitoring
- ✅ Zero permission confusion
- ✅ Ready for Client Management Portal UI

---

## 📚 Full Documentation

- [DEPLOYMENT_COMPLETE_SUMMARY.md](docs/DEPLOYMENT_COMPLETE_SUMMARY.md) - Detailed deployment guide
- [REVISED_API_WEBHOOK_MANAGEMENT_PLAN.md](docs/REVISED_API_WEBHOOK_MANAGEMENT_PLAN.md) - Full architecture
- [MANUAL_DEPLOYMENT_STEPS.md](docs/MANUAL_DEPLOYMENT_STEPS.md) - Step-by-step instructions

---

**Total Time:** ~12 minutes
**Complexity:** Low (just copy/paste SQL)
