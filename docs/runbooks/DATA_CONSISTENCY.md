# Data Consistency Runbook

**Purpose:** Troubleshooting guide for dashboard data consistency issues
**Audience:** Engineering team, DevOps
**Last Updated:** October 8, 2025

---

## 🚨 Quick Reference

| Issue | Solution | Time |
|-------|----------|------|
| Stale data showing | Force refresh | 1 min |
| Dashboard won't load | Check Edge Functions | 5 min |
| Validation errors | Review error logs | 10 min |
| Slow performance | Check API health | 15 min |

---

## 1. Dashboard Shows Stale Data

### Symptoms
- Data freshness indicator shows 🟡 Stale or 🔴 Very Stale
- "Updated Xh ago" timestamp is old
- User reports outdated metrics

### Diagnosis

**Step 1: Check cache status**
```typescript
// Open browser console on dashboard page
import { getCacheStats } from '@/services/dataService';
console.log(getCacheStats());
```

**Expected output:**
```json
{
  "cacheSize": 4,
  "pendingRequests": 0,
  "entries": [
    {
      "key": "kpi-dashboard-data",
      "age": 65000,  // Age in milliseconds
      "hasWarnings": false
    }
  ]
}
```

**Step 2: Check Supabase cache metadata**
```sql
SELECT
  cache_key,
  status,
  last_updated,
  AGE(NOW(), last_updated) as age
FROM data_cache_metadata
ORDER BY last_updated DESC;
```

### Solutions

**Solution A: User-initiated refresh (Fastest)**
1. Click "Refresh Data" button on dashboard
2. Verify freshness indicator turns 🟢 Fresh
3. Duration: < 10 seconds

**Solution B: Clear browser cache**
```javascript
// Browser console
localStorage.clear();
window.location.reload();
```

**Solution C: Force cache invalidation (Backend)**
```sql
-- Clear specific cache
DELETE FROM data_cache_metadata WHERE cache_key = 'kpi-dashboard-data';

-- Or clear all caches
DELETE FROM data_cache_metadata;
```

### Prevention
- Ensure auto-refresh interval is running (check `DashboardContext.tsx:613`)
- Monitor cache TTL settings match requirements
- Review `CACHE_DURATION` in `src/contexts/DashboardContext.tsx:151`

---

## 2. Dashboard Won't Load / Infinite Loading

### Symptoms
- Loading spinner never stops
- Console shows "Fetching..." logs but no completion
- Dashboard shows blank screen

### Diagnosis

**Step 1: Check Edge Function logs**
```bash
# View real-time logs for KPI dashboard
supabase functions logs hybrid-workspace-analytics --follow

# Or check last 100 lines
supabase functions logs hybrid-workspace-analytics --tail 100
```

**Step 2: Test Edge Function directly**
```bash
curl -X POST https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/hybrid-workspace-analytics \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"timestamp": 1696800000000}'
```

**Step 3: Check API health logs**
```sql
SELECT
  endpoint,
  status_code,
  response_time_ms,
  error_message
FROM api_health_logs
WHERE api_name = 'Email Bison'
AND timestamp > NOW() - INTERVAL '15 minutes'
ORDER BY timestamp DESC
LIMIT 10;
```

### Solutions

**Solution A: Email Bison API timeout**
If response_time_ms > 45000 or status_code = null:
1. Email Bison API may be down
2. Check [Email Bison Status](https://send.maverickmarketingllc.com)
3. Contact Email Bison support if extended outage

**Solution B: Edge Function error**
If status_code = 500 or function logs show errors:
1. Check function logs for stack trace
2. Verify environment variables in Supabase dashboard
3. Redeploy function if needed:
```bash
supabase functions deploy hybrid-workspace-analytics
```

**Solution C: Network/CORS issues**
Check browser console for CORS errors:
1. Verify Supabase URL in `.env` is correct
2. Check CORS headers in Edge Function (`corsHeaders`)
3. Clear browser cache and try again

### Prevention
- Set up monitoring alerts for failed API calls
- Implement health check endpoint (Phase 4)
- Configure Supabase function timeout appropriately

---

## 3. Validation Errors Appearing

### Symptoms
- Dashboard shows ⚠️ Warning indicators
- Toast notifications about data issues
- Some client data missing or incorrect

### Diagnosis

**Step 1: Check validation error logs**
```sql
SELECT
  source,
  error_type,
  field_name,
  error_message,
  workspace_name,
  timestamp
FROM data_validation_errors
WHERE timestamp > NOW() - INTERVAL '1 hour'
ORDER BY timestamp DESC
LIMIT 20;
```

**Step 2: Review warnings in dashboard state**
```typescript
// Browser console
const { kpiDashboard } = window.__DASHBOARD_CONTEXT__;
console.log('Warnings:', kpiDashboard.warnings);
```

**Step 3: Identify pattern**
```sql
-- Most common validation errors
SELECT
  error_type,
  field_name,
  COUNT(*) as occurrences
FROM data_validation_errors
WHERE timestamp > NOW() - INTERVAL '24 hours'
GROUP BY error_type, field_name
ORDER BY occurrences DESC;
```

### Solutions

**Solution A: Schema mismatch (Email Bison API changed)**
1. Review API response structure:
```typescript
// Add temporary logging in Edge Function
console.log('Raw API response:', JSON.stringify(apiResponse, null, 2));
```
2. Update Zod schema in `src/lib/dataValidation.ts`:
```typescript
// Example: Add new optional field
export const KPIClientSchema = z.object({
  // ... existing fields
  newField: z.string().optional(), // Add this
});
```
3. Redeploy and test

**Solution B: Data quality issue (Missing/invalid data from source)**
1. Identify affected workspace:
```sql
SELECT DISTINCT workspace_name
FROM data_validation_errors
WHERE timestamp > NOW() - INTERVAL '6 hours';
```
2. Check Email Bison workspace directly
3. Update/fix data in Email Bison if possible
4. Or adjust validation to handle edge case:
```typescript
// Allow nullable if data source unreliable
monthlyKPI: z.number().int().nonnegative().nullable()
```

**Solution C: False positive (Validation too strict)**
1. Review validation logic in `src/lib/dataValidation.ts`
2. Adjust thresholds if needed:
```typescript
// Before
if (client.leadsGenerated > 1000) {
  warnings.push(`Unusually high leads`);
}

// After (increased threshold)
if (client.leadsGenerated > 5000) {
  warnings.push(`Unusually high leads`);
}
```

### Prevention
- Monitor validation error trends weekly
- Keep Zod schemas in sync with API changes
- Add API version tracking to detect breaking changes

---

## 4. Dashboard Performance Issues

### Symptoms
- Dashboard takes > 15 seconds to load
- Laggy UI interactions
- High CPU usage in browser

### Diagnosis

**Step 1: Check fetch duration**
```typescript
// Browser console - check dashboard state
const { kpiDashboard } = window.__DASHBOARD_CONTEXT__;
console.log('Last fetch duration:', kpiDashboard.fetchDurationMs + 'ms');
```

**Step 2: Analyze API performance**
```sql
SELECT
  endpoint,
  AVG(response_time_ms) as avg_response_time,
  MAX(response_time_ms) as max_response_time,
  COUNT(*) as request_count
FROM api_health_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY endpoint
ORDER BY avg_response_time DESC;
```

**Step 3: Check batch processing**
```sql
-- Check workspace switching performance
SELECT
  workspace_name,
  response_time_ms
FROM api_health_logs
WHERE endpoint LIKE '%switch-workspace%'
AND timestamp > NOW() - INTERVAL '1 hour'
ORDER BY response_time_ms DESC
LIMIT 10;
```

### Solutions

**Solution A: Slow Email Bison API**
If avg_response_time > 2000ms per workspace:
1. **Increase batch size** (if rate limits allow):
```typescript
// supabase/functions/volume-dashboard-data/index.ts:264
const BATCH_SIZE = 10; // Increase from 5 to 10
```
2. **Or decrease timeout** to fail faster:
```typescript
// src/services/dataService.ts
const REQUEST_TIMEOUT = 30000; // Reduce from 45s to 30s
```
3. Redeploy affected Edge Functions

**Solution B: Too many workspaces**
If 50+ active workspaces:
1. **Implement pagination**:
```typescript
// Modify Edge Function to accept offset/limit
const { offset = 0, limit = 27 } = requestBody;
const eligibleWorkspaces = allWorkspaces.slice(offset, offset + limit);
```
2. **Or filter by priority**:
```sql
-- Update client_registry to add priority field
ALTER TABLE client_registry ADD COLUMN priority INTEGER DEFAULT 5;

-- Only fetch high-priority clients for real-time dashboards
WHERE priority <= 3
```

**Solution C: Large cache preventing fast hydration**
If localStorage is full (quota exceeded):
1. **Reduce cache TTL**:
```typescript
// src/services/dataService.ts
const CACHE_TTL = {
  KPI: 1 * 60 * 1000,  // Reduce to 1 minute
  INFRASTRUCTURE: 5 * 60 * 1000, // Reduce to 5 minutes
};
```
2. **Or implement cache size limits**:
```typescript
// Add to dataService.ts
const MAX_CACHE_SIZE_MB = 5;
if (dataSizeBytes > MAX_CACHE_SIZE_MB * 1024 * 1024) {
  // Don't cache large datasets
  return;
}
```

### Prevention
- Monitor API response times weekly
- Set up alerts for avg_response_time > 3000ms
- Review workspace count monthly and archive inactive clients

---

## 5. Force Refresh All Caches

### When to Use
- After deploying Edge Function changes
- After migrating data in Email Bison
- After Supabase maintenance
- User reports persistent stale data across all dashboards

### Process

**Step 1: Clear in-memory cache (Frontend)**
```typescript
// Browser console
import { clearAllCache } from '@/services/dataService';
clearAllCache();
console.log('In-memory cache cleared');
```

**Step 2: Clear localStorage (Browser)**
```javascript
// Browser console
localStorage.clear();
console.log('localStorage cleared');
```

**Step 3: Clear Supabase cache metadata (Backend)**
```sql
-- Connect to Supabase via psql or SQL Editor
DELETE FROM data_cache_metadata;
INSERT INTO data_cache_metadata (cache_key, status, record_count)
VALUES
  ('kpi-dashboard-data', 'stale', 0),
  ('volume-dashboard-data', 'stale', 0),
  ('revenue-dashboard-data', 'stale', 0),
  ('infrastructure-dashboard-data', 'stale', 0);
```

**Step 4: Trigger refresh**
```typescript
// Browser console
const { refreshAll } = window.__DASHBOARD_CONTEXT__;
await refreshAll();
console.log('All dashboards refreshed');
```

**Step 5: Verify**
```sql
SELECT
  cache_key,
  status,
  last_updated,
  record_count
FROM data_cache_metadata
ORDER BY last_updated DESC;
```

All `status` should be `'fresh'` and `last_updated` should be recent (< 1 minute ago).

---

## 6. Deploy Edge Function Updates

### When to Deploy
- After modifying Edge Function code
- After changing batch size or parallelization
- After updating validation logic
- After fixing bugs

### Deployment Process

**Step 1: Test locally (if possible)**
```bash
# Start local Supabase
supabase start

# Deploy to local
supabase functions deploy hybrid-workspace-analytics --project-ref local

# Test local function
curl -X POST http://localhost:54321/functions/v1/hybrid-workspace-analytics \
  -H "Authorization: Bearer YOUR_LOCAL_ANON_KEY" \
  -H "Content-Type: application/json"
```

**Step 2: Deploy to production**
```bash
# Deploy specific function
supabase functions deploy hybrid-workspace-analytics

# Or deploy all functions
supabase functions deploy
```

**Step 3: Monitor logs**
```bash
# Watch logs in real-time
supabase functions logs hybrid-workspace-analytics --follow
```

**Step 4: Test in production**
1. Navigate to dashboard
2. Open browser console
3. Force refresh:
```typescript
const { refreshKPIDashboard } = useDashboardContext();
await refreshKPIDashboard(true);
```
4. Verify no errors in console
5. Check data freshness indicator shows 🟢 Fresh

**Step 5: Rollback if needed**
```bash
# List function versions
supabase functions list --with-versions

# Deploy specific version
supabase functions deploy hybrid-workspace-analytics --version <version_id>
```

### Affected Functions

| Function | Dashboards Affected |
|----------|---------------------|
| `hybrid-workspace-analytics` | KPI, Revenue, Billing |
| `volume-dashboard-data` | Volume |
| `revenue-analytics` | Revenue |
| `hybrid-email-accounts-v2` | Infrastructure, Email Accounts |

---

## 7. Common Error Messages

### "Request timeout"
**Cause:** Email Bison API took > 45 seconds
**Solution:** Check Email Bison status, increase timeout if needed

### "Validation failed: Client ID is required"
**Cause:** API returned client without `id` field
**Solution:** Update Zod schema or fix data source

### "Failed to switch to workspace X"
**Cause:** Email Bison API rejected workspace switch (403/404)
**Solution:** Verify workspace exists and API key has access

### "Using stale data: Network error"
**Cause:** API call failed, falling back to cache
**Solution:** Check network connectivity, Email Bison status

### "Circuit breaker open"
**Cause:** Too many consecutive failures, requests blocked
**Solution:** Wait 5 minutes for circuit to reset, fix underlying issue

---

## 8. Monitoring Checklist

### Daily (Automated)
- [ ] Check `dashboard_health_summary.health_score` > 80
- [ ] Review critical validation errors (severity = 'critical')
- [ ] Monitor API success rate > 95%

### Weekly (Manual)
- [ ] Review average fetch duration trends
- [ ] Check for recurring validation errors
- [ ] Audit cache hit ratios
- [ ] Review workspace-specific performance issues

### Monthly (Manual)
- [ ] Audit cache TTL settings vs actual usage
- [ ] Review retry configuration effectiveness
- [ ] Update validation schemas for API changes
- [ ] Archive old API health logs (> 30 days)

---

## 9. Escalation

### Level 1: Dashboard issue (< 5 min downtime)
**Action:** Follow this runbook, attempt quick fixes
**Contact:** Engineering team Slack channel

### Level 2: Persistent issue (5-30 min downtime)
**Action:** Rollback recent changes, escalate
**Contact:** Engineering lead

### Level 3: Critical outage (> 30 min downtime)
**Action:** Page on-call engineer, prepare incident report
**Contact:** VP Engineering, CTO

---

## 10. Useful SQL Queries

### Health check query
```sql
SELECT
  cache_key,
  status,
  last_updated,
  record_count,
  AGE(NOW(), last_updated) as age
FROM data_cache_metadata
WHERE status != 'fresh'
OR last_updated < NOW() - INTERVAL '15 minutes';
```

### Performance analysis
```sql
SELECT
  DATE_TRUNC('hour', timestamp) as hour,
  AVG(response_time_ms) as avg_response_time,
  MAX(response_time_ms) as max_response_time,
  COUNT(*) as request_count
FROM api_health_logs
WHERE api_name = 'Email Bison'
AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

### Error trend analysis
```sql
SELECT
  DATE_TRUNC('day', timestamp) as day,
  error_type,
  COUNT(*) as occurrences
FROM data_validation_errors
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY day, error_type
ORDER BY day DESC, occurrences DESC;
```

---

## 📚 Additional Resources

- [Data Architecture Documentation](../DATA_ARCHITECTURE.md)
- [Migration Complete Guide](../../MIGRATION_COMPLETE.md)
- [Supabase Dashboard](https://app.supabase.com/project/gjqbbgrfhijescaouqkx)
- [Email Bison API Docs](https://docs.emailbison.com)

---

**Questions or issues not covered here?**
Update this runbook or contact the engineering team.
