# 🔐 Credentials Status

## ✅ HAVE

1. **Supabase**
   - ✅ URL: https://gjqbbgrfhijescaouqkx.supabase.co
   - ✅ Service Role Key: Added
   - ✅ Anon Key: Added

2. **Cole X Dates - New Jersey**
   - ✅ Username: thomaschavez@maverickmarketingllc.com
   - ✅ Password: 12345
   - ✅ URL: https://xdates.coleinformation.com/

3. **Clay**
   - ✅ API Key: 2bf95d3a3f9ddb86903d
   - ❌ Email: NEEDED (for browser automation)
   - ❌ Password: NEEDED (for browser automation)

4. **Redis**
   - ✅ URL: redis://localhost:6379 (local)

## ❌ STILL NEED

### Email Bison
No credentials found in Airtable. Need:
- Email
- Password

### Slack Webhook
No webhook found. Need:
- Webhook URL for #client-success channel
- Create at: https://slack.com/apps/A0F7XDUAZ-incoming-webhooks

### Clay Login
Have API key but connectors use browser automation, so need:
- Login email
- Login password

## 📝 Next Steps

### 1. Run SQL Migrations
**IMPORTANT:** Copy from the .sql files, NOT from the .md markdown file!

Files to copy (in VS Code):
1. `supabase/migrations/20251005200000_create_agent_tables.sql`
2. `supabase/migrations/20251005203000_create_client_zipcodes.sql`
3. `supabase/migrations/20251005203100_create_monthly_cleaned_leads.sql`

Paste into: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new

### 2. Get Missing Credentials
- Clay email/password (check your password manager or ask team)
- Email Bison email/password
- Slack webhook for #client-success

### 3. Test!
Once all credentials are in:
```bash
# Verify database
npx tsx scripts/test-db-connection.ts

# Validate secrets
npm run validate:secrets

# Test Cole connector (browser will open!)
HEADLESS=false npm run test:cole-login
```

## 🔍 Airtable Findings

Found these Cole accounts:
- Record 10: Missouri, Illinois, Wisconsin, Iowa (tichavez2020@gmail.com)
- Record 13: Alabama (Office@maverickmarketingllc.com)
- Record 17: Kim account (kwallace@farmersagent.com)
- Record 19: NJ StreetSmart (thomaschavez@maverickmarketingllc.com) ✅ USING THIS
- Record 21: Michigan, Nevada, Oregon, Mississippi (daniel@longrun.agency)

All use password: `12345`
