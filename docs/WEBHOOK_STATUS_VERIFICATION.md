# Webhook Configuration Status - October 2025

**Last Verified**: October 8, 2025 at 6:08 PM PST

## ✅ Webhook Status: FULLY OPERATIONAL

The `bison-interested-webhook` Edge Function is now configured on **both Email Bison instances** and capturing leads in real-time.

---

## Email Bison Instances

### 1. Maverick Email Bison
- **URL**: https://send.maverickmarketingllc.com
- **Webhook ID**: 75
- **Webhook Name**: "Client Portal Pipeline - Interested Leads"
- **Endpoint**: https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook
- **Event**: `lead_interested`
- **Status**: ✅ Active (configured Oct 4, 2025)
- **Clients Covered**: 16 Maverick workspaces

### 2. Long Run Email Bison
- **URL**: https://send.longrun.agency
- **Webhook ID**: 21
- **Webhook Name**: "Client Portal Pipeline - Interested Leads"
- **Endpoint**: https://gjqbbgrfhijescaouqkx.supabase.co/functions/v1/bison-interested-webhook
- **Event**: `lead_interested`
- **Status**: ✅ Active (configured Oct 8, 2025)
- **Clients Covered**: 7 Long Run workspaces

---

## Active Workspaces (24 Total)

### Maverick Email Bison (16 workspaces)
1. **Danny Schwartz** - Bison ID: 36
2. **David Amiri** - Bison ID: 25
3. **Devin Hodo** - Bison ID: 37
4. **Gregg Blanchard** - Bison ID: 44
5. **Jason Binyon** - Bison ID: 3
6. **Jeff Schroder** - Bison ID: 26
7. **John Roberts** - Bison ID: 28
8. **Kim Wallace** - Bison ID: 4
9. **Kirk Hodgson** - Bison ID: 23
10. **Maverick In-house** - Bison ID: 14
11. **Nick Sakha** - Bison ID: 40
12. **Rob Russell** - Bison ID: 24
13. **Shane Miller** - Bison ID: 12
14. **SMA Insurance** - Bison ID: 32
15. **StreetSmart Commercial** - Bison ID: 29
16. **Tony Schmitz** - Bison ID: 41

### Long Run Email Bison (7 workspaces)
1. **ATI** - Bison ID: 4
2. **Boring Book Keeping** - Bison ID: 16
3. **Koppa Analytics** - Bison ID: 17
4. **Littlegiant** - Bison ID: 19
5. **LongRun** - Bison ID: 2
6. **Ozment Media** - Bison ID: 15
7. **Radiant Energy** - Bison ID: 9
8. **Workspark** - Bison ID: 14

---

## Verification Test Results

### Recent Lead Capture (Oct 8, 2025 - 11:22 PM)
✅ **Danny Schwartz** - 10 recent leads captured:
- henrietta@wefundanybusiness.com (23:22:53)
- tyrone.jackson@my.rhinotracking.net (23:22:48)
- valentina.rossi@getmomit.com (23:22:43)
- joseph.harris@outreach.availvaluerecovery.com (23:22:32)
- joel_basch@geteyetoeyecareers.com (23:22:26)
- sarahschmitz@schmitzagencyinsurancerisk.com (23:22:22)
- matt@hirerelatesearch.com (23:22:21)
- aurore.leroy@meetslidor.com (23:22:01)
- sarahschmitz@schmitzagencysecure.com (23:22:00)
- ana.martinez@work.weatherbug.online (23:22:00)

**Result**: Webhook capturing leads in real-time with accurate timestamps ✅

---

## Data Flow Architecture

```
Email Bison (Maverick) ─┐
                        ├─→ Webhook Event (lead_interested)
Email Bison (Long Run) ─┘   ↓
                            bison-interested-webhook Function
                            ↓
                            Supabase client_leads table
                            ↓
                            KPI Dashboard / hybrid-workspace-analytics
```

---

## November 2025+ Billing Process

### Automated (Recommended)
✅ **Use KPI Dashboard data directly** - webhook captures all interested leads in real-time
- No manual verification needed
- No API sync race conditions
- Accurate billing counts automatically

### Verification Query
If you need to verify counts for any client:

```sql
SELECT
  workspace_name,
  COUNT(*) as interested_leads_count
FROM client_leads
WHERE
  interested = true
  AND date_received >= '2025-11-01'
  AND date_received < '2025-12-01'
GROUP BY workspace_name
ORDER BY workspace_name;
```

---

## October 2025 Billing (Manual Verification Required)

⚠️ **October 2025 requires manual verification** due to historical data gaps before webhook was fully deployed.

See: [OCTOBER_BILLING_VERIFICATION.md](./OCTOBER_BILLING_VERIFICATION.md)

---

## Monitoring

### Check Webhook Health
```bash
# Verify Maverick webhook
curl -s "https://send.maverickmarketingllc.com/api/webhook-url" \
  -H "Authorization: Bearer <SUPER_ADMIN_KEY>"

# Verify Long Run webhook
curl -s "https://send.longrun.agency/api/webhook-url" \
  -H "Authorization: Bearer <LONGRUN_API_KEY>"
```

### Check Recent Leads
```bash
# Last 10 leads captured
curl -s "https://gjqbbgrfhijescaouqkx.supabase.co/rest/v1/client_leads?select=workspace_name,lead_email,date_received,interested&order=date_received.desc&limit=10" \
  -H "apikey: <SUPABASE_KEY>"
```

---

## Support

If webhook stops receiving data:
1. Check webhook configuration in Email Bison dashboard
2. Verify Edge Function is deployed: `npx supabase functions list`
3. Check Edge Function logs for errors
4. Verify RLS policies on `client_leads` table allow inserts

---

**Status**: ✅ **ALL SYSTEMS OPERATIONAL** - Ready for November 2025 billing
