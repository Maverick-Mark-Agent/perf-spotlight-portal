#!/bin/bash

# Deploy Contact Pipeline Migration
# This script applies the contact pipeline database migration

set -e

echo "🚀 Deploying Contact Pipeline Migration..."

DB_URL="postgresql://postgres.gjqbbgrfhijescaouqkx:Maverick2024!@aws-0-us-west-1.pooler.supabase.com:6543/postgres"
MIGRATION_FILE="supabase/migrations/20251008100000_create_contact_pipeline.sql"

# Check if we have psql
if command -v psql &> /dev/null; then
    echo "✅ Found psql, running migration..."
    PGPASSWORD="Maverick2024!" psql "$DB_URL" -f "$MIGRATION_FILE"
    echo "✅ Migration complete!"
else
    echo "❌ psql not found. Please run the migration manually:"
    echo ""
    echo "Option 1 - Via Supabase Dashboard:"
    echo "1. Go to: https://supabase.com/dashboard/project/gjqbbgrfhijescaouqkx/sql/new"
    echo "2. Copy contents of: $MIGRATION_FILE"
    echo "3. Paste and click 'Run'"
    echo ""
    echo "Option 2 - Install PostgreSQL client:"
    echo "brew install postgresql"
    echo "Then run this script again"
    exit 1
fi
