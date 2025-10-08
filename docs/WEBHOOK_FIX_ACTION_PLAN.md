# Webhook Fix - Action Plan
**Date**: October 8, 2025
**Status**: ✅ Core fix applied, validation in progress

---

## ✅ COMPLETED

### 1. Root Cause Identified
- Webhook function deployed WITH JWT verification
- All Email Bison webhook events rejected with 401 errors
- Leads stopped syncing to client portals

### 2. Immediate Fix Applied
```bash
npx supabase functions deploy bison-interested-webhook --no-verify-jwt
```
- Function now accepts webhook events
- No more 401 errors
- Ready to process LEAD_INTERESTED events

---

## 🔄 IN PROGRESS

### 3. End-to-End Validation
**Test webhook delivery**:
1. Go to Email Bison UI
2. Mark any reply as "Interested"
3. Check Supabase function logs (within 30s)
4. Query client_leads table for new lead
5. Verify lead shows in client portal

**Commands**:
```bash
# Check function logs
npx supabase functions logs bison-interested-webhook --tail 50

# Query recent leads
curl "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/client_leads?select=*&order=created_at.desc&limit=10" \
  -H "apikey: YOUR_ANON_KEY"
```

---

## 📋 TODO - This Week

### 4. Verify All Client Webhooks
```bash
./scripts/verify-all-webhooks.sh
```
Expected: All 24 clients show active webhooks

### 5. Check for Missed Leads
1. Review Supabase function logs (past 7 days)
2. Identify when 401 errors started
3. Calculate lead volume missed
4. Determine if backfill needed

### 6. Document Deployment Procedure
**Create team documentation**:
- ALWAYS use: `./scripts/deploy-webhook-function.sh`
- NEVER deploy via Supabase dashboard
- NEVER use npx without `--no-verify-jwt` flag

---

## 🛡️ TODO - This Month

### 7. Set Up Monitoring
**Create webhook health monitor**:
- Daily cron job testing webhook
- Alert if 401 errors detected
- Monitor lead sync rates
- Dashboard showing webhook status per client

**Implementation**:
```typescript
// supabase/functions/daily-webhook-health-check/index.ts
// Sends test LEAD_INTERESTED event
// Verifies lead creation
// Alerts if failure
```

### 8. Add Automated Tests
- Synthetic webhook test (daily)
- Function deployment verification
- Client portal smoke test
- Lead query performance test

### 9. Create Pre-Commit Hook
Prevent accidental deployments without `--no-verify-jwt`:
```bash
# .git/hooks/pre-commit
if grep -r "supabase functions deploy bison" .; then
  echo "⚠️  Use ./scripts/deploy-webhook-function.sh instead!"
  exit 1
fi
```

---

## 📊 Monitoring Dashboard

**Track these metrics**:
| Metric | Target | Alert If |
|--------|--------|----------|
| Webhook HTTP status | 200 | Any 401 errors |
| Leads created/day | ~50-100 | Drop >50% |
| Function error rate | <1% | >10% |
| Avg response time | <500ms | >2000ms |

---

## 🚨 Emergency Rollback

If webhook issues occur again:

### Option 1: Redeploy
```bash
./scripts/deploy-webhook-function.sh
```

### Option 2: Manual Sync (Temporary)
```bash
# Run for affected client
./scripts/sync-CLIENT-NAME-leads.sh
```

### Option 3: Check Logs
```bash
# Find errors
npx supabase functions logs bison-interested-webhook | grep ERROR

# Check last 100 invocations
npx supabase functions logs bison-interested-webhook --tail 100
```

---

## 📝 Communication Plan

### If Significant Lead Loss Detected

**Step 1: Assess Impact**
- Count missed leads per client
- Identify time window of downtime
- Estimate business impact

**Step 2: Backfill Data**
```bash
# For each affected client
./scripts/sync-CLIENT-NAME-leads.sh
```

**Step 3: Notify Clients** (if >100 leads missed)
- Email affected clients
- Explain issue resolved
- Confirm all data restored
- Apologize for inconvenience

---

## ✅ Success Criteria

Webhook system is healthy when:
- [x] Function responds without 401 errors
- [ ] Test webhook creates lead within 30s
- [ ] Lead appears in client portal
- [ ] All 24 client webhooks active
- [ ] No function errors in past 24 hours
- [ ] Lead creation rate matches baseline

**Status**: 1/6 complete (function fixed, validation pending)

---

## 🎯 Next Steps (Priority Order)

1. **Today**: Test end-to-end webhook delivery
2. **This Week**: Run webhook verification, check for missed leads
3. **This Week**: Document deployment procedures
4. **This Month**: Set up monitoring and automated tests
5. **This Month**: Create pre-commit hooks

---

## 📞 Contacts

**If webhook issues persist**:
- Check: [WEBHOOK_TROUBLESHOOTING.md](./runbooks/WEBHOOK_TROUBLESHOOTING.md)
- Review: [WEBHOOK_DIAGNOSTIC_REPORT_2025-10-08.md](./WEBHOOK_DIAGNOSTIC_REPORT_2025-10-08.md)
- Escalate: Engineering team

**For Email Bison API issues**:
- Status: https://send.maverickmarketingllc.com
- Support: Email Bison team
- API Docs: https://docs.emailbison.com

---

**Last Updated**: October 8, 2025
**Owner**: Engineering Team
**Priority**: P0 - Critical
