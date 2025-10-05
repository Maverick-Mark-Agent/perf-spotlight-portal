# Multi-Client Webhook Rollout Guide

## Overview

This guide covers the safe, incremental deployment of "Lead Interested" webhooks across all 28 clients in the system.

## Current Status

- **Total Clients**: 28
- **Deployed**: 1 (David Amiri - pilot)
- **Ready for Rollout**: 18
- **Blocked (No API Key)**: 3
- **Blocked (No Workspace)**: 5
- **Blocked (No Data)**: 1

## System Architecture

### Webhook Flow
```
Email Bison "Lead Interested" Event
    ↓
Webhook fires to Supabase Function
    ↓
Function extracts lead data
    ↓
Upsert to client_leads table
    ↓
Lead appears in Client Portal
```

### Webhook URL
```
https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook
```

## Files Created

### Core Registry
- **`scripts/client-registry.json`** - Master list of all 28 clients with workspace IDs, API keys, and deployment status

### Automation Scripts
- **`scripts/rollout-webhooks.sh`** - Automated deployment script
- **`scripts/verify-webhook-delivery.sh`** - Testing and verification suite
- **`scripts/rollback-webhooks.sh`** - Emergency rollback script

### Logs
- **`docs/webhook-rollout-log.md`** - Deployment audit trail
- **`docs/webhook-verification-log.md`** - Verification results

## Rollout Process

### Phase 1: Pilot (2-3 Clients)

Deploy to Kim Wallace and Jeff Schroder:

```bash
# 1. Deploy pilot webhooks
chmod +x scripts/rollout-webhooks.sh
./scripts/rollout-webhooks.sh pilot

# 2. Verify deployment
chmod +x scripts/verify-webhook-delivery.sh
./scripts/verify-webhook-delivery.sh pilot

# 3. Check logs
cat docs/webhook-rollout-log.md
cat docs/webhook-verification-log.md
```

**Success Criteria**:
- ✅ Webhooks created successfully (check rollout log)
- ✅ Test webhooks delivered (check verification log)
- ✅ No errors in Supabase function logs

**Monitor for 24 hours** before proceeding to Phase 2.

### Phase 2: Batch Rollout

Deploy in batches of 5 clients:

```bash
# Batch 1: ATI, Binyon, Danny, Devin, Gregg
./scripts/rollout-webhooks.sh batch 1
./scripts/verify-webhook-delivery.sh deployed

# Wait 2-4 hours, monitor

# Batch 2: John, Kirk, Nick, Rick, Rob
./scripts/rollout-webhooks.sh batch 2
./scripts/verify-webhook-delivery.sh deployed

# Wait 2-4 hours, monitor

# Batch 3: SMA, Shane, StreetSmart (Commercial, P&C, Trucking)
./scripts/rollout-webhooks.sh batch 3
./scripts/verify-webhook-delivery.sh deployed

# Wait 2-4 hours, monitor

# Batch 4: Tony
./scripts/rollout-webhooks.sh batch 4
./scripts/verify-webhook-delivery.sh deployed
```

### Phase 3: Full Deployment (Alternative)

If batching is not needed, deploy all at once:

```bash
./scripts/rollout-webhooks.sh full
./scripts/verify-webhook-delivery.sh deployed
```

## Verification Checklist

After each deployment:

### 1. Check Rollout Log
```bash
cat docs/webhook-rollout-log.md
```
- ✅ All webhooks have IDs
- ✅ No failed deployments
- ✅ API responses successful

### 2. Check Verification Log
```bash
cat docs/webhook-verification-log.md
```
- ✅ All test webhooks sent successfully
- ✅ No delivery failures

### 3. Check Registry
```bash
cat scripts/client-registry.json | grep "webhook_id"
```
- ✅ All deployed clients have webhook_id
- ✅ Status changed to "deployed"

### 4. Monitor Real Leads (24-48 hours)
- Check client portals for incoming leads
- Verify leads appear in correct "New Lead" stage
- Confirm workspace_name matches correctly

### 5. Check Supabase Logs
```bash
# View function logs in Supabase Dashboard
# https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions
```
- ✅ No errors
- ✅ Successful lead creation logs
- ✅ Correct workspace mapping

## Emergency Rollback

If issues are detected:

```bash
chmod +x scripts/rollback-webhooks.sh
./scripts/rollback-webhooks.sh
```

This will:
1. Delete ALL deployed webhooks via API
2. Update registry (set webhook_id to null, status to "ready")
3. Log all actions to `docs/webhook-rollback-log.md`

**Note**: Type `ROLLBACK` to confirm (safety measure)

## Troubleshooting

### Webhook Not Firing

**Symptoms**: Leads not appearing in portal

**Check**:
1. Verify webhook exists in Email Bison
   ```bash
   ./scripts/manage-webhooks.sh list
   ```

2. Send test webhook
   ```bash
   ./scripts/test-webhook-api.sh
   ```

3. Check Supabase function logs for errors

4. Verify workspace_name matches exactly

### Wrong Workspace

**Symptoms**: Leads appearing in wrong client portal

**Cause**: Workspace name mismatch between Email Bison and registry

**Fix**:
1. Check Email Bison workspace name
2. Update `workspace_name` in registry
3. Redeploy webhook

### API Key Invalid

**Symptoms**: Webhook creation fails with 401/403

**Fix**:
1. Generate new API key in Email Bison
2. Update `api_key` in registry
3. Redeploy webhook

## Blocked Clients

### Missing API Keys (3 clients)
- Biz Power Benefits
- Maison Energy
- Small Biz Heroes

**Action**: Generate API keys in Email Bison, update registry, deploy

### Missing Workspaces (5 clients)
- Boring Book Keeping
- Koppa Analytics
- Ozment media
- Radiant Energy Partners
- Workspark

**Action**: Create Email Bison workspaces or confirm they're inactive

### Missing Data (1 client)
- Boshra

**Action**: Get workspace name and API key, update registry

## Registry Management

### View Client Status
```bash
cat scripts/client-registry.json | python3 -m json.tool
```

### Filter by Status
```bash
# Ready for deployment
cat scripts/client-registry.json | python3 -c "import sys,json; [print(c['company_name']) for c in json.load(sys.stdin)['clients'] if c['status']=='ready']"

# Already deployed
cat scripts/client-registry.json | python3 -c "import sys,json; [print(c['company_name']) for c in json.load(sys.stdin)['clients'] if c.get('webhook_id')]"

# Blocked
cat scripts/client-registry.json | python3 -c "import sys,json; [print(f\"{c['company_name']}: {c['status']}\") for c in json.load(sys.stdin)['clients'] if 'blocked' in c['status']]"
```

### Manual Updates
Edit `scripts/client-registry.json` directly and commit changes.

## Success Metrics

### Per-Client Metrics
- ✅ Webhook created successfully
- ✅ Webhook ID recorded in registry
- ✅ Test webhook delivered
- ✅ Real leads appearing in portal
- ✅ Correct workspace mapping

### Overall Metrics
- **Target**: 18/18 ready clients deployed
- **Timeline**: 1 week (including monitoring)
- **Error Rate**: <5%
- **Rollback Events**: 0

## Post-Deployment

### Week 1
- Daily verification runs
- Monitor Supabase function logs
- Check portal activity
- Address any issues immediately

### Week 2-4
- Monitor for edge cases
- Optimize function if needed
- Document any additional issues

### Ongoing
- Monthly registry audit
- Update blocked clients as they become ready
- Keep logs for compliance/audit

## Support

### Logs Location
- Rollout: `docs/webhook-rollout-log.md`
- Verification: `docs/webhook-verification-log.md`
- Rollback: `docs/webhook-rollback-log.md`

### Supabase Dashboard
https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions

### Registry
`scripts/client-registry.json` - Single source of truth

## Quick Reference

```bash
# Pilot deployment
./scripts/rollout-webhooks.sh pilot

# Batch deployment
./scripts/rollout-webhooks.sh batch [1-4]

# Full deployment
./scripts/rollout-webhooks.sh full

# Verify all
./scripts/verify-webhook-delivery.sh deployed

# Verify specific client
./scripts/verify-webhook-delivery.sh [client_id]

# Emergency rollback
./scripts/rollback-webhooks.sh

# View webhooks
./scripts/manage-webhooks.sh list

# Test single webhook
./scripts/test-webhook-api.sh
```
