# Quick Reference Guide

**Last Updated:** October 15, 2025

This is a quick reference for common tasks and commands.

---

## 🚀 Getting Started

```bash
# First time setup (automated)
./setup-local.sh

# Start development
npm run dev

# Open browser
open http://localhost:8080
```

---

## 📋 Common Commands

### Development

```bash
npm run dev              # Start dev server (http://localhost:8080)
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run linter
npm run validate:types   # TypeScript type checking
```

### Supabase

```bash
supabase start           # Start local Supabase
supabase stop            # Stop local Supabase
supabase status          # Check status
supabase db reset        # Reset database + apply migrations
supabase db push         # Push schema changes to production
supabase db diff         # Show schema differences
```

### Supabase Studio (Web UI)

```bash
open http://localhost:54323    # Open local Supabase Studio
# Or navigate to: Supabase Dashboard > Project Settings > API
```

### Edge Functions

```bash
# Serve function locally
supabase functions serve hybrid-email-accounts-v2 --env-file .env.local

# Deploy to production
supabase functions deploy hybrid-email-accounts-v2

# Deploy all functions
for func in supabase/functions/*/; do
  func_name=$(basename "$func")
  supabase functions deploy "$func_name"
done

# View function logs
supabase functions logs hybrid-email-accounts-v2
```

### Database Migrations

```bash
# Create new migration
supabase migration new your_migration_name

# Apply migrations locally
supabase db reset

# Push to production
supabase db push
```

---

## 🗄️ Key Database Tables

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `client_registry` | Master client list | `workspace_id`, `workspace_name`, `monthly_kpi_target` |
| `client_leads` | Lead management | `workspace_name`, `pipeline_stage`, `date_received` |
| `sender_emails_cache` | Email account cache | `email_address`, `status`, `reply_rate_percentage` |
| `email_account_metadata` | Manual overrides | `email_address`, `price`, `daily_sending_limit` |

### Query Examples

```sql
-- Get all active clients
SELECT * FROM client_registry WHERE is_active = true;

-- Get leads for a specific client
SELECT * FROM client_leads
WHERE workspace_name = 'Client Name'
ORDER BY date_received DESC;

-- Get email account stats
SELECT
  status,
  COUNT(*) as count,
  AVG(reply_rate_percentage) as avg_reply_rate
FROM sender_emails_cache
GROUP BY status;
```

---

## 🔧 Key Edge Functions

| Function | Purpose | Endpoint |
|----------|---------|----------|
| `hybrid-email-accounts-v2` | Fetch all email accounts | `/functions/v1/hybrid-email-accounts-v2` |
| `hybrid-workspace-analytics` | KPI dashboard data | `/functions/v1/hybrid-workspace-analytics` |
| `volume-dashboard-data` | Volume metrics | `/functions/v1/volume-dashboard-data` |
| `revenue-analytics` | Revenue calculations | `/functions/v1/revenue-analytics` |
| `universal-bison-webhook` | Handle Email Bison webhooks | `/functions/v1/universal-bison-webhook` |

---

## 🌐 Frontend Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | HomePage | Landing page |
| `/kpi-dashboard` | KPIDashboard | Client KPI tracking |
| `/volume-dashboard` | VolumeDashboard | Email volume tracking |
| `/email-accounts` | EmailAccountsPage | 600+ email account management |
| `/revenue-dashboard` | RevenueDashboard | Revenue analysis |
| `/client-portal` | ClientPortalHub | Client portal hub |
| `/client-portal/:workspace` | ClientPortalPage | Individual client portal |
| `/billing` | BillingPage | Cost analysis |
| `/zip-dashboard` | ZipDashboard | Territory management |

---

## 🔐 Environment Variables

### Local Development (`.env.local`)

```env
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_ANON_KEY=your-local-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-local-service-key
EMAIL_BISON_API_KEY=your-api-key
```

### Production (Netlify + Supabase Secrets)

**Netlify (Frontend):**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Supabase Secrets (Edge Functions):**
```bash
supabase secrets set EMAIL_BISON_API_KEY=your-key
supabase secrets set LONG_RUN_BISON_API_KEY=your-key
supabase secrets list  # View all secrets
```

---

## 🐛 Troubleshooting Quick Fixes

### Supabase Won't Start

```bash
docker ps            # Check Docker is running
supabase stop
supabase start
```

### Database Issues

```bash
supabase db reset    # Reset and reapply all migrations
```

### Frontend Build Errors

```bash
rm -rf node_modules package-lock.json
npm install
npm run dev
```

### Clear Browser Cache

1. Open DevTools (F12)
2. Right-click refresh button
3. "Empty Cache and Hard Reload"

---

## 📊 Performance Metrics

### Expected Load Times

| Dashboard | Cold Load | With Cache |
|-----------|-----------|------------|
| KPI | < 1s | < 500ms |
| Volume | < 1s | < 300ms |
| Email Accounts | 2-3s | Instant (60min cache) |
| Revenue | < 1s | < 500ms |

### Cache TTLs

- KPI Data: 2 minutes
- Volume Data: 30 seconds
- Infrastructure: 60 minutes
- Revenue: 10 seconds

---

## 🔄 Deployment Checklist

### Before Deploying

- [ ] Test locally
- [ ] Run type checking: `npm run validate:types`
- [ ] Run linter: `npm run lint`
- [ ] Build succeeds: `npm run build`
- [ ] Database migrations tested locally

### Deploy

```bash
# 1. Database changes
supabase db push

# 2. Edge Functions (if changed)
supabase functions deploy function-name

# 3. Frontend (auto-deploys)
git add .
git commit -m "feat: Your change description"
git push origin main

# 4. Verify deployment
# Check Netlify dashboard for build status
```

---

## 📝 Adding a New Client

```sql
INSERT INTO client_registry (
  workspace_id,
  workspace_name,
  display_name,
  is_active,
  billing_type,
  monthly_kpi_target,
  monthly_sending_target,
  payout,
  price_per_lead
) VALUES (
  12345,                    -- Email Bison workspace ID
  'Client Workspace Name',  -- Must match Email Bison exactly
  'Client Display Name',    -- Pretty name for UI
  true,                     -- Active/inactive
  'per_lead',               -- or 'retainer'
  50,                       -- Monthly KPI target
  10000,                    -- Monthly email target
  0.0,                      -- Retainer amount (if applicable)
  25.00                     -- Price per lead (if applicable)
);
```

---

## 📞 Quick Links

- **Production Dashboard:** https://perf-spotlight-portal.lovable.app
- **Supabase Dashboard:** https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx
- **Local Supabase Studio:** http://localhost:54323
- **Local Dev Server:** http://localhost:8080

---

## 📚 Documentation

- **Full Architecture:** [SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)
- **Setup Guide:** [LOCAL_DEVELOPMENT_GUIDE.md](./LOCAL_DEVELOPMENT_GUIDE.md)
- **Main README:** [README.md](./README.md)

---

## 💡 Pro Tips

1. **Use the automated setup script** for quickest start: `./setup-local.sh`
2. **Keep Supabase Studio open** for easy database queries
3. **Use feature flags** in `dataService.ts` for safe rollbacks
4. **Cache management** is automatic - force refresh with `?force=true` parameter
5. **Check Edge Function logs** in Supabase Dashboard when debugging
6. **Use TypeScript** - it catches bugs before runtime
7. **Test migrations locally** before pushing to production

---

**Need more help?** See the full documentation files linked above.
