# October 2025 Billing Verification Guide

**Due to technical limitations with Email Bison's API workspace switching, use this manual verification process for October 2025 billing.**

## How to Verify Lead Counts in Email Bison

1. **Log into Email Bison** (https://send.maverickmarketingllc.com)
2. **Switch to the client's workspace** (top left dropdown)
3. **Go to Replies tab**
4. **Filter by:**
   - **Interested:** Yes
   - **Date Range:** October 1-31, 2025
5. **Note the count** shown at the top
6. **Use this number for billing**

## 16 Maverick Clients to Verify

- [ ] Danny Schwartz
- [ ] David Amiri
- [ ] Devin Hodo
- [ ] Gregg Blanchard
- [ ] Jason Binyon
- [ ] Jeff Schroder
- [ ] John Roberts
- [ ] Kim Wallace
- [ ] Kirk Hodgson
- [ ] Maverick In-house
- [ ] Nick Sakha
- [ ] Rob Russell
- [ ] Shane Miller
- [ ] SMA Insurance
- [ ] StreetSmart Commercial
- [ ] Tony Schmitz

## Going Forward (November 2025+)

✅ **The KPI Dashboard will be accurate** because:
1. Webhook (`bison-interested-webhook`) is now configured on **BOTH Email Bison instances** (Maverick + Long Run)
2. Captures all new interested leads in real-time
3. No reliance on API sync
4. Data flows automatically: Email Bison → Webhook → Supabase → KPI Dashboard

**See full webhook status**: [WEBHOOK_STATUS_VERIFICATION.md](./WEBHOOK_STATUS_VERIFICATION.md)

## Note

The Email Bison `/replies` API endpoint has a session-based workspace switching mechanism that causes race conditions when querying multiple workspaces. This makes automated syncing unreliable for billing purposes. The webhook integration is the proper solution and will ensure accuracy for all future months.

**Last webhook verification**: October 8, 2025 - All 24 workspaces covered ✅
