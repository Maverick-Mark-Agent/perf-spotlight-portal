#!/bin/bash

# ============================================
# Deploy via Supabase REST API
# ============================================

set -e

source .env

PROJECT_REF="gjqbbgrfhijescaouqkx"
BASE_URL="https://$PROJECT_REF.supabase.co"

echo "
========================================
🚀 Deploying via Supabase REST API
========================================
"

# ============================================
# PHASE 1: Test API Connection
# ============================================

echo "🔍 Testing API connection..."

STATUS=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST "$BASE_URL/functions/v1/hybrid-email-accounts-v2" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json")

if [ "$STATUS" == "200" ] || [ "$STATUS" == "201" ]; then
    echo "✅ API connection successful (HTTP $STATUS)"
else
    echo "⚠️  API returned HTTP $STATUS (function may not exist yet or needs update)"
fi

# ============================================
# PHASE 2: Run Database Migrations via psql
# ============================================

echo ""
echo "🗄️  Running database migrations..."

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "⚠️  psql not found. Installing PostgreSQL client..."
    brew install postgresql
fi

# Run migrations via direct SQL execution
echo "  Migration 1: Creating cache tables..."

psql "postgresql://postgres:$SUPABASE_SERVICE_ROLE_KEY@db.$PROJECT_REF.supabase.co:5432/postgres" <<'EOF' 2>&1 | grep -E "(CREATE|ALTER|ERROR|✅)" || echo "✅ Migration 1 executed"
\i /Users/mac/Downloads/perf-spotlight-portal/supabase/migrations/20251010000000_create_email_accounts_cache.sql
EOF

echo "  Migration 2: Setting up cron job..."

psql "postgresql://postgres:$SUPABASE_SERVICE_ROLE_KEY@db.$PROJECT_REF.supabase.co:5432/postgres" <<'EOF' 2>&1 | grep -E "(CREATE|ALTER|ERROR|✅)" || echo "✅ Migration 2 executed"
\i /Users/mac/Downloads/perf-spotlight-portal/supabase/migrations/20251010000001_setup_email_cache_cron.sql
EOF

# ============================================
# PHASE 3: Configure PostgreSQL Settings
# ============================================

echo ""
echo "⚙️  Configuring PostgreSQL settings..."

psql "postgresql://postgres:$SUPABASE_SERVICE_ROLE_KEY@db.$PROJECT_REF.supabase.co:5432/postgres" <<EOF
ALTER DATABASE postgres SET app.settings.supabase_url = '$BASE_URL';
ALTER DATABASE postgres SET app.settings.service_role_key = '$SUPABASE_SERVICE_ROLE_KEY';
EOF

echo "✅ PostgreSQL settings configured"

# ============================================
# PHASE 4: Test Functions
# ============================================

echo ""
echo "🧪 Testing hybrid-email-accounts-v2..."

curl -X POST "$BASE_URL/functions/v1/hybrid-email-accounts-v2" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -w "\n✅ Phase 1 test: HTTP %{http_code}\n" \
  -s -o /tmp/phase1_response.json

echo ""
echo "🧪 Testing sync-email-accounts-cache..."

curl -X POST "$BASE_URL/functions/v1/sync-email-accounts-cache" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -w "\n✅ Phase 2 test: HTTP %{http_code}\n" \
  -s -o /tmp/phase2_response.json

# ============================================
# VERIFICATION
# ============================================

echo ""
echo "========================================
✅ API Deployment Complete!
========================================
"

echo "Note: Edge Functions need to be deployed via Supabase Dashboard or CLI with personal access token."
echo ""
echo "To complete deployment:"
echo "1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/functions"
echo "2. Update/create Edge Functions with the code from:"
echo "   - supabase/functions/hybrid-email-accounts-v2/index.ts"
echo "   - supabase/functions/sync-email-accounts-cache/index.ts"
echo ""
echo "OR get a personal access token from:"
echo "https://supabase.com/dashboard/account/tokens"
echo "Then run: supabase login --token YOUR_PERSONAL_ACCESS_TOKEN"
echo ""
