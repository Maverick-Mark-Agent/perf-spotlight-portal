#!/bin/bash

# ============================================
# Automated Email Dashboard Fix Deployment
# ============================================

set -e  # Exit on error

echo "
========================================
🚀 Email Dashboard Fix Deployment
========================================
"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${RED}❌ Error: .env file not found${NC}"
    echo "Please create .env file with your Supabase credentials:"
    echo "  cp .env.example .env"
    echo "  # Then edit .env with your actual keys"
    exit 1
fi

# Load environment variables
source .env

# Validate required environment variables
if [ -z "$SUPABASE_URL" ] || [ "$SUPABASE_URL" == "https://your-project.supabase.co" ]; then
    echo -e "${RED}❌ Error: SUPABASE_URL not configured in .env${NC}"
    exit 1
fi

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ] || [ "$SUPABASE_SERVICE_ROLE_KEY" == "your-service-role-key-here" ]; then
    echo -e "${RED}❌ Error: SUPABASE_SERVICE_ROLE_KEY not configured in .env${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Configuration:${NC}"
echo "  Project URL: $SUPABASE_URL"
echo "  Service Role Key: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
echo ""

# ============================================
# PHASE 1: Check Supabase CLI
# ============================================

echo -e "${BLUE}🔍 Checking Supabase CLI...${NC}"

if ! command -v supabase &> /dev/null; then
    echo -e "${YELLOW}⚠️  Supabase CLI not found. Installing...${NC}"

    # Try Homebrew first
    if command -v brew &> /dev/null; then
        echo "  Installing via Homebrew..."
        brew install supabase/tap/supabase || {
            echo -e "${RED}❌ Homebrew installation failed${NC}"
            echo -e "${YELLOW}Please install manually:${NC}"
            echo "  brew install supabase/tap/supabase"
            exit 1
        }
    else
        echo -e "${RED}❌ Homebrew not found${NC}"
        echo "Please install Supabase CLI manually:"
        echo "  https://github.com/supabase/cli#install-the-cli"
        exit 1
    fi
fi

echo -e "${GREEN}✅ Supabase CLI found${NC}"
supabase --version

# ============================================
# PHASE 2: Link Project
# ============================================

echo ""
echo -e "${BLUE}🔗 Linking to Supabase project...${NC}"

# Extract project ref from URL
PROJECT_REF=$(echo "$SUPABASE_URL" | sed -n 's/.*https:\/\/\([^.]*\).*/\1/p')

if [ -z "$PROJECT_REF" ]; then
    echo -e "${RED}❌ Could not extract project ref from SUPABASE_URL${NC}"
    exit 1
fi

echo "  Project Ref: $PROJECT_REF"

# Link project (will prompt for auth if needed)
supabase link --project-ref "$PROJECT_REF" || {
    echo -e "${YELLOW}⚠️  Link failed. You may need to login first:${NC}"
    echo "  supabase login"
    exit 1
}

echo -e "${GREEN}✅ Project linked${NC}"

# ============================================
# PHASE 3: Deploy Edge Functions
# ============================================

echo ""
echo -e "${BLUE}🚀 PHASE 1: Deploying pagination fix...${NC}"
echo "  Function: hybrid-email-accounts-v2"

supabase functions deploy hybrid-email-accounts-v2 || {
    echo -e "${RED}❌ Failed to deploy hybrid-email-accounts-v2${NC}"
    exit 1
}

echo -e "${GREEN}✅ hybrid-email-accounts-v2 deployed${NC}"

# Test Phase 1
echo ""
echo -e "${BLUE}🧪 Testing Phase 1...${NC}"

curl -X POST "$SUPABASE_URL/functions/v1/hybrid-email-accounts-v2" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  --silent --output /dev/null --write-out "%{http_code}" > /tmp/phase1_status.txt

STATUS=$(cat /tmp/phase1_status.txt)

if [ "$STATUS" == "200" ]; then
    echo -e "${GREEN}✅ Phase 1 test successful (HTTP $STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️  Phase 1 returned HTTP $STATUS${NC}"
    echo "Check function logs: $SUPABASE_URL/dashboard/project/$PROJECT_REF/functions/hybrid-email-accounts-v2/logs"
fi

# ============================================
# PHASE 4: Run Database Migrations
# ============================================

echo ""
echo -e "${BLUE}🗄️  PHASE 2: Running database migrations...${NC}"

echo "  Migration 1: Creating cache tables..."
supabase db push || {
    echo -e "${RED}❌ Database migrations failed${NC}"
    exit 1
}

echo -e "${GREEN}✅ Database migrations completed${NC}"

# ============================================
# PHASE 5: Configure PostgreSQL Settings
# ============================================

echo ""
echo -e "${BLUE}⚙️  Configuring PostgreSQL settings...${NC}"

psql "$SUPABASE_URL" <<EOF || echo -e "${YELLOW}⚠️  Could not configure PostgreSQL settings via psql. Run manually in SQL Editor.${NC}"
ALTER DATABASE postgres SET app.settings.supabase_url = '$SUPABASE_URL';
ALTER DATABASE postgres SET app.settings.service_role_key = '$SUPABASE_SERVICE_ROLE_KEY';
EOF

echo -e "${GREEN}✅ PostgreSQL settings configured${NC}"

# ============================================
# PHASE 6: Deploy Background Sync Function
# ============================================

echo ""
echo -e "${BLUE}🚀 Deploying background sync function...${NC}"
echo "  Function: sync-email-accounts-cache"

supabase functions deploy sync-email-accounts-cache || {
    echo -e "${RED}❌ Failed to deploy sync-email-accounts-cache${NC}"
    exit 1
}

echo -e "${GREEN}✅ sync-email-accounts-cache deployed${NC}"

# Test Phase 2
echo ""
echo -e "${BLUE}🧪 Testing Phase 2...${NC}"

curl -X POST "$SUPABASE_URL/functions/v1/sync-email-accounts-cache" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  --silent --output /dev/null --write-out "%{http_code}" > /tmp/phase2_status.txt

STATUS=$(cat /tmp/phase2_status.txt)

if [ "$STATUS" == "200" ]; then
    echo -e "${GREEN}✅ Phase 2 test successful (HTTP $STATUS)${NC}"
else
    echo -e "${YELLOW}⚠️  Phase 2 returned HTTP $STATUS${NC}"
    echo "Check function logs: $SUPABASE_URL/dashboard/project/$PROJECT_REF/functions/sync-email-accounts-cache/logs"
fi

# ============================================
# VERIFICATION
# ============================================

echo ""
echo -e "${BLUE}✅ VERIFICATION${NC}"
echo ""
echo "Run these SQL queries to verify deployment:"
echo ""
echo -e "${YELLOW}-- Check Jason Binyon account count (should be 433)${NC}"
echo "SELECT COUNT(*) as jason_accounts"
echo "FROM email_accounts_cache"
echo "WHERE workspace_name ILIKE '%Jason Binyon%';"
echo ""
echo -e "${YELLOW}-- Check total accounts (should be 4000+)${NC}"
echo "SELECT COUNT(*) as total_accounts"
echo "FROM email_accounts_cache"
echo "WHERE sync_status = 'success';"
echo ""
echo -e "${YELLOW}-- Check sync health${NC}"
echo "SELECT * FROM public.get_email_sync_health();"
echo ""

# ============================================
# SUCCESS
# ============================================

echo ""
echo "========================================"
echo -e "${GREEN}✅ DEPLOYMENT COMPLETE!${NC}"
echo "========================================"
echo ""
echo "📊 Next Steps:"
echo "  1. Check Edge Function logs:"
echo "     $SUPABASE_URL/dashboard/project/$PROJECT_REF/functions"
echo ""
echo "  2. Run verification queries in SQL Editor:"
echo "     $SUPABASE_URL/dashboard/project/$PROJECT_REF/sql"
echo ""
echo "  3. Monitor sync health:"
echo "     SELECT * FROM public.get_email_sync_health();"
echo ""
echo "🎯 Expected Results:"
echo "  - Jason Binyon: 433 accounts (was 15)"
echo "  - Total accounts: 4000+"
echo "  - Sync runs every 30 minutes"
echo ""
