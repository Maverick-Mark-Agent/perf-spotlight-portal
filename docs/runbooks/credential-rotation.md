# Credential Rotation Runbook

## Overview
Regular credential rotation improves security. This runbook covers rotating credentials for Cole, Clay, Bison, and API keys.

## Frequency
- **Production:** Rotate every 90 days
- **Staging/Dev:** Rotate every 180 days
- **Immediately:** After suspected compromise

## Process

### 1. Cole X Dates Credentials

**Steps:**
1. Log in to Cole X Dates portal for each state
2. Navigate to account settings
3. Change password (use password manager to generate strong password)
4. Update `.env` file: `COLE_{STATE}_PASSWORD=new-password`
5. Update `site_credentials` table: Run `npm run seed:credentials`
6. Test login: `npx tsx tests/connectors/cole-test.ts`
7. Document rotation in password management tool

**Rollback:**
- Keep old password for 24 hours in case of issues
- Update `.env` back to old password if automation fails

---

### 2. Clay Credentials

**Steps:**
1. Log in to Clay: https://clay.com
2. Settings → Change Password
3. Update `.env`: `CLAY_PASSWORD=new-password`
4. Run seed script: `npm run seed:credentials`
5. Test: `npx tsx tests/connectors/clay-test.ts`

---

### 3. Email Bison Credentials

**Steps:**
1. Log in to Email Bison
2. Account Settings → Security → Change Password
3. Update `.env`: `BISON_PASSWORD=new-password`
4. Run seed script: `npm run seed:credentials`
5. Test: `npx tsx tests/connectors/bison-test.ts`

---

### 4. Supabase API Keys

**Steps:**
1. Supabase Dashboard → Settings → API
2. Generate new service role key
3. Update `.env`: `SUPABASE_SERVICE_ROLE_KEY=new-key`
4. Update GitHub Actions secrets (if using CI/CD)
5. Test database connection: `npm run validate:secrets`
6. Revoke old key after 24 hours

---

### 5. Slack Webhook URL

**Steps:**
1. Slack App Settings → Incoming Webhooks
2. Regenerate webhook URL
3. Update `.env`: `SLACK_WEBHOOK_URL=new-url`
4. Test: Send test notification

---

## Verification Checklist

After rotating credentials:
- [ ] All `.env` files updated (local, staging, production)
- [ ] GitHub Actions secrets updated (if applicable)
- [ ] `site_credentials` table updated
- [ ] Test scripts pass
- [ ] No automation failures in last 24 hours
- [ ] Old credentials revoked/disabled
- [ ] Password manager updated
- [ ] Team notified via Slack

## Emergency Response

If credentials are compromised:
1. **Immediately** change passwords on all platforms
2. Update `.env` and re-deploy
3. Review audit logs for suspicious activity
4. Report to Head of Fulfillment
5. Document incident in security log

---

## Scheduled Rotation Calendar

Set calendar reminders for:
- **Production:** Every 90 days from deployment date
- **Staging:** Every 180 days
- **Review:** Monthly check of all credentials

## Contact

**Security Issues:** Head of Fulfillment for B2C
**Technical Issues:** Development Team
