# Webhook Rollout Plan - All 24 Clients
**Date**: October 8, 2025
**Status**: Ready to Execute
**Goal**: Verify and ensure all 24 clients have working real-time lead sync via webhooks

---

## 📊 Current Status

**Total Clients**: 24
**Webhooks Registered** (per Oct 6 verification): 24/24 ✅
**Webhook Function**: ✅ Deployed with --no-verify-jwt (confirmed working)
**Tested Successfully**: David Amiri ✅

---

## 🎯 Rollout Strategy

### Phase 1: Verification (Day 1 - Today)
**Goal**: Confirm all webhooks still exist and are active

### Phase 2: Testing (Day 1-2)
**Goal**: Test end-to-end delivery for sample clients

### Phase 3: Monitoring Setup (Day 2-3)
**Goal**: Implement automated health checks and alerts

### Phase 4: Documentation & Training (Day 3-4)
**Goal**: Document for team and create runbooks

---

## 📋 Phase 1: Verification (2-3 hours)

### Step 1.1: Run Automated Verification Script

**Execute**:
```bash
./scripts/verify-all-webhooks.sh
```

**This script will**:
- Switch to each client workspace
- Check if webhook exists
- Verify webhook URL is correct
- Verify webhook event type is LEAD_INTERESTED
- Verify webhook is active
- Output JSON report

**Expected Output**:
```json
{
  "total_clients": 24,
  "verified": 24,
  "issues": []
}
```

### Step 1.2: Review Client Registry

**Check registry matches reality**:
```bash
cat scripts/client-registry.json | jq '.clients[] | select(.webhook_id != null) | {company_name, workspace_id, webhook_id, webhook_verified}'
```

**Verify**:
- All 24 clients listed
- webhook_id matches actual webhook in Email Bison
- webhook_verified = true

### Step 1.3: Database Verification

**Check database can accept leads**:
```bash
# Test upsert for each workspace
for workspace in "Kim Wallace" "John Roberts" "Danny Schwartz" "Devin Hodo" "David Amiri"
do
  echo "Testing: $workspace"
  curl -X POST https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook \
    -H "Content-Type: application/json" \
    --data-binary @- << EOF
{
  "event": {
    "type": "LEAD_INTERESTED",
    "workspace_name": "$workspace",
    "workspace_id": 1,
    "instance_url": "https://app.emailbison.com"
  },
  "data": {
    "lead": {
      "id": 999,
      "email": "verification-test-$RANDOM@example.com",
      "first_name": "Verification",
      "last_name": "Test",
      "status": "interested",
      "title": "Test",
      "company": "Test Co",
      "custom_variables": []
    },
    "reply": {
      "id": 888,
      "uuid": "test-uuid",
      "date_received": "2025-10-08T20:00:00Z",
      "from_name": "Test",
      "from_email_address": "verification-test@example.com"
    },
    "campaign": {"id": 1, "name": "Test"},
    "sender_email": {"id": 1, "email": "test@test.com", "name": "Test"}
  }
}
EOF
done
```

**Then cleanup**:
```bash
curl -X DELETE "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/client_leads?lead_email=like.verification-test%25" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

---

## 🧪 Phase 2: End-to-End Testing (1-2 hours)

### Step 2.1: Sample Client Testing

**Test 5 representative clients** (mix of high/low volume):

| Client | Workspace ID | Priority | Test Method |
|--------|--------------|----------|-------------|
| Kim Wallace | 4 | High | Mark real reply as interested |
| John Roberts | 28 | High | Mark real reply as interested |
| Danny Schwartz | 36 | Medium | Mark real reply as interested |
| Nick Sakha | 40 | Medium | Mark real reply as interested |
| Rob Russell | 24 | Low | Mark real reply as interested |

**For each client**:

1. **Go to Email Bison UI**
   - Switch to client workspace
   - Find a reply
   - Mark as "Interested"
   - Note the email address

2. **Wait 30 seconds**

3. **Check Database**:
   ```bash
   curl "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/client_leads?workspace_name=eq.Kim%20Wallace&lead_email=eq.THE_EMAIL&select=*" \
     -H "apikey: YOUR_ANON_KEY"
   ```

4. **Check Client Portal**:
   - Navigate to: `http://localhost:8080/client-portal/Kim%20Wallace`
   - Verify lead appears in "Interested" column
   - Verify all fields populated correctly

5. **Record Results**:
   ```
   ✅ Kim Wallace - Lead: john@example.com - Success
   ✅ John Roberts - Lead: jane@example.com - Success
   ```

### Step 2.2: Multi-Workspace Testing

**Test shared workspace** (Insurance - Workspace 11):

Clients sharing workspace 11:
- Boring Book Keeping
- Koppa Analytics
- Ozment media
- Radiant Energy Partners
- Workspark

**Test**:
1. Mark reply as interested in workspace 11
2. Verify Email Bison routes correctly by workspace_name
3. Check lead appears for correct client in portal

### Step 2.3: Edge Cases

**Test these scenarios**:

1. **Duplicate Lead**:
   - Mark same email as interested twice
   - Verify only one record exists (upsert works)

2. **Lead Already in Portal**:
   - Mark lead that was already manually synced
   - Verify pipeline_stage is preserved

3. **Special Characters**:
   - Test with email containing +, ., etc.
   - Verify database accepts it

---

## 🔔 Phase 3: Monitoring Setup (2-3 hours)

### Step 3.1: Create Daily Health Check Function

**Create**: `supabase/functions/daily-webhook-health-check/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  const results = {
    timestamp: new Date().toISOString(),
    overall_health: 'healthy',
    clients_tested: 0,
    clients_passed: 0,
    clients_failed: 0,
    failures: []
  };

  // Test webhook function
  const testResponse = await fetch(
    'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: {
          type: 'LEAD_INTERESTED',
          workspace_name: 'Health Check Test',
          workspace_id: 9999,
          instance_url: 'https://app.emailbison.com'
        },
        data: {
          lead: {
            id: 999999,
            email: `health-check-${Date.now()}@example.com`,
            first_name: 'Health',
            last_name: 'Check',
            status: 'interested',
            title: 'Test',
            company: 'Test Co',
            custom_variables: []
          },
          reply: {
            id: 99999,
            uuid: 'health-check-uuid',
            date_received: new Date().toISOString(),
            from_name: 'Health Check',
            from_email_address: `health-check-${Date.now()}@example.com`
          },
          campaign: { id: 999, name: 'Health Check' },
          sender_email: { id: 999, email: 'test@test.com', name: 'Test' }
        }
      })
    }
  );

  if (testResponse.ok) {
    const testData = await testResponse.json();
    results.clients_tested++;
    results.clients_passed++;

    // Cleanup test lead
    await supabase
      .from('client_leads')
      .delete()
      .eq('id', testData.lead_id);
  } else {
    results.clients_failed++;
    results.failures.push({
      client: 'Health Check Test',
      error: await testResponse.text()
    });
    results.overall_health = 'unhealthy';
  }

  // Check recent lead creation rate
  const { data: recentLeads } = await supabase
    .from('client_leads')
    .select('workspace_name')
    .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  const leadsByWorkspace = recentLeads?.reduce((acc, lead) => {
    acc[lead.workspace_name] = (acc[lead.workspace_name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Alert if any active client has 0 leads in 24 hours
  const activeClients = [
    'Kim Wallace', 'John Roberts', 'Danny Schwartz',
    'Devin Hodo', 'David Amiri'
  ];

  for (const client of activeClients) {
    if (!leadsByWorkspace?.[client]) {
      results.failures.push({
        client,
        error: 'No leads received in past 24 hours'
      });
      results.overall_health = 'degraded';
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

**Deploy**:
```bash
SUPABASE_ACCESS_TOKEN=xxx npx supabase functions deploy daily-webhook-health-check
```

**Set up Cron** (via Supabase pg_cron):
```sql
SELECT cron.schedule(
  'daily-webhook-health-check',
  '0 9 * * *', -- Run at 9 AM daily
  $$
  SELECT net.http_post(
    url := 'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/daily-webhook-health-check',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
```

### Step 3.2: Set Up Slack Alerts

**When health check fails, send Slack message**:

```typescript
// In daily-webhook-health-check function
if (results.overall_health !== 'healthy') {
  await fetch(Deno.env.get('SLACK_WEBHOOK_URL')!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `🚨 Webhook Health Check Failed`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Webhook Health: ${results.overall_health.toUpperCase()}*\n\n` +
                  `✅ Passed: ${results.clients_passed}\n` +
                  `❌ Failed: ${results.clients_failed}\n\n` +
                  `*Failures*:\n${results.failures.map(f => `• ${f.client}: ${f.error}`).join('\n')}`
          }
        }
      ]
    })
  });
}
```

### Step 3.3: Dashboard Widget

**Create webhook health widget** for internal dashboard:

```typescript
// src/components/admin/WebhookHealthWidget.tsx
const WebhookHealthWidget = () => {
  const [health, setHealth] = useState(null);

  useEffect(() => {
    const checkHealth = async () => {
      const response = await fetch(
        'https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/daily-webhook-health-check'
      );
      setHealth(await response.json());
    };

    checkHealth();
    const interval = setInterval(checkHealth, 60000); // Every minute
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <h3>Webhook Health</h3>
        <Badge variant={health?.overall_health === 'healthy' ? 'success' : 'destructive'}>
          {health?.overall_health}
        </Badge>
      </CardHeader>
      <CardContent>
        <div>Clients Passed: {health?.clients_passed}</div>
        <div>Clients Failed: {health?.clients_failed}</div>
        {health?.failures?.length > 0 && (
          <div className="mt-2">
            <h4>Failures:</h4>
            {health.failures.map((f, i) => (
              <div key={i}>• {f.client}: {f.error}</div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
```

---

## 📚 Phase 4: Documentation (1-2 hours)

### Step 4.1: Team Documentation

**Create**: `docs/WEBHOOK_DEPLOYMENT_GUIDE.md`

**Contents**:
1. When to deploy webhook function
2. How to deploy (use script only)
3. How to verify deployment
4. How to test end-to-end
5. How to rollback
6. Troubleshooting common issues

### Step 4.2: Client Onboarding Guide

**Create**: `docs/CLIENT_WEBHOOK_ONBOARDING.md`

**Contents**:
1. How to add new client webhook
2. Testing checklist
3. Portal verification steps
4. Registry update procedure

### Step 4.3: Update README

**Add section**:
```markdown
## Webhook System

Real-time lead sync via Email Bison webhooks.

**Status**: ✅ Active for all 24 clients

**Deploy webhook function**:
```bash
./scripts/deploy-webhook-function.sh
```

**Verify all webhooks**:
```bash
./scripts/verify-all-webhooks.sh
```

**Check health**:
```bash
curl https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/daily-webhook-health-check
```

**Troubleshooting**: See [WEBHOOK_TROUBLESHOOTING.md](./docs/runbooks/WEBHOOK_TROUBLESHOOTING.md)
```

---

## ✅ Rollout Checklist

### Day 1 (Today) - 3-4 hours

- [ ] Run `./scripts/verify-all-webhooks.sh`
- [ ] Review and confirm all 24 webhooks active
- [ ] Test David Amiri (already done ✅)
- [ ] Test 4 more sample clients
- [ ] Document any issues found
- [ ] Update client registry if needed

### Day 2 - 2-3 hours

- [ ] Test remaining sample clients
- [ ] Test multi-workspace scenario
- [ ] Test edge cases (duplicates, special chars)
- [ ] Create daily health check function
- [ ] Deploy health check function
- [ ] Set up cron job

### Day 3 - 2 hours

- [ ] Set up Slack alerts
- [ ] Create webhook health dashboard widget
- [ ] Write team documentation
- [ ] Update README

### Day 4 - 1 hour

- [ ] Final verification of all clients
- [ ] Run end-to-end smoke test
- [ ] Mark rollout as complete
- [ ] Announce to team

---

## 🚨 Rollback Plan

**If critical issues found**:

### Option 1: Redeploy Webhook Function
```bash
./scripts/deploy-webhook-function.sh
```

### Option 2: Disable Specific Client Webhook
```bash
# In Email Bison UI
# 1. Switch to client workspace
# 2. Go to Settings → Webhooks
# 3. Toggle webhook to inactive
```

### Option 3: Emergency Manual Sync
```bash
# Run manual sync for affected clients
./scripts/sync-CLIENT-NAME-leads.sh
```

---

## 📊 Success Criteria

**Rollout is successful when**:

- ✅ All 24 clients have active webhooks
- ✅ Sample tests (5+ clients) pass end-to-end
- ✅ Leads appear in portals within 30 seconds
- ✅ No duplicate leads created
- ✅ Daily health check function deployed
- ✅ Slack alerts configured
- ✅ Team documentation complete
- ✅ 0 critical issues in past 7 days

---

## 📞 Support

**During Rollout**:
- Primary: Engineering team
- Escalation: VP Engineering
- Emergency: Rollback using procedures above

**After Rollout**:
- Webhook issues: [WEBHOOK_TROUBLESHOOTING.md](./runbooks/WEBHOOK_TROUBLESHOOTING.md)
- Email Bison API: Email Bison support
- Database issues: Engineering team

---

## 📝 Post-Rollout Tasks

### Week 1
- Monitor health check daily
- Review any Slack alerts
- Check lead creation rates
- Gather client feedback

### Week 2
- Analyze webhook performance metrics
- Optimize if needed
- Update documentation based on learnings

### Month 1
- Run full audit of all webhooks
- Review and tune alert thresholds
- Consider additional monitoring

---

**Last Updated**: October 8, 2025
**Owner**: Engineering Team
**Status**: Ready to Execute
**Estimated Time**: 4 days (3-4 hours/day)
