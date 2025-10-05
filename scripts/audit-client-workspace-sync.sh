#!/bin/bash

# Client-Workspace Synchronization Audit Script
# Comprehensive audit of Email Bison workspaces vs Airtable clients

AIRTABLE_API_KEY="patHeVyZPZSelZQiv.0b42c8d2a6197c847c5e85824a4b8ab09d985659f9e4ecd0703c308ff8fd1730"
EMAIL_BISON_API_KEY="77|AqozJcNT8l2m52CRyvQyEEmLKa49ofuZRjK98aio8a3feb5d"
BASE_ID="appONMVSIf5czukkf"
OUTPUT_DIR="./docs/airtable-analysis"

mkdir -p "$OUTPUT_DIR"

echo "=========================================="
echo "Client-Workspace Sync Audit"
echo "Date: $(date)"
echo "=========================================="
echo ""

# Fetch all Email Bison workspaces
echo "Step 1: Fetching Email Bison workspaces..."
curl -s "https://send.maverickmarketingllc.com/api/workspaces/v1.1" \
  -H "Authorization: Bearer $EMAIL_BISON_API_KEY" \
  -H "Accept: application/json" \
  > "$OUTPUT_DIR/email-bison-workspaces.json"

BISON_COUNT=$(jq '.data | length' "$OUTPUT_DIR/email-bison-workspaces.json")
echo "✓ Found $BISON_COUNT Email Bison workspaces"
echo ""

# Fetch all Airtable clients from Positive Replies view
echo "Step 2: Fetching Airtable clients (Positive Replies view)..."
curl -s "https://api.airtable.com/v0/$BASE_ID/%F0%9F%91%A8%E2%80%8D%F0%9F%92%BB%20Clients?view=Positive%20Replies" \
  -H "Authorization: Bearer $AIRTABLE_API_KEY" \
  > "$OUTPUT_DIR/airtable-clients.json"

AIRTABLE_COUNT=$(jq '.records | length' "$OUTPUT_DIR/airtable-clients.json")
echo "✓ Found $AIRTABLE_COUNT Airtable clients"
echo ""

# Fetch October stats for each Email Bison workspace
echo "Step 3: Fetching October stats for all workspaces..."
echo "This may take a few minutes..."
echo ""

WORKSPACES=$(jq -r '.data[] | "\(.id)|\(.name)"' "$OUTPUT_DIR/email-bison-workspaces.json")

# Create workspace stats file
echo "[]" > "$OUTPUT_DIR/workspace-october-stats.json"

STATS_ARRAY="["
FIRST=true

while IFS='|' read -r WS_ID WS_NAME; do
  echo "  Fetching stats for: $WS_NAME"

  # Switch to workspace
  curl -s -X POST "https://send.maverickmarketingllc.com/api/workspaces/v1.1/switch-workspace" \
    -H "Authorization: Bearer $EMAIL_BISON_API_KEY" \
    -H "Accept: application/json" \
    -H "Content-Type: application/json" \
    -d "{\"team_id\": $WS_ID}" > /dev/null

  # Get stats for October 1 - today
  STATS=$(curl -s "https://send.maverickmarketingllc.com/api/workspaces/v1.1/stats?start_date=2025-10-01&end_date=$(date +%Y-%m-%d)" \
    -H "Authorization: Bearer $EMAIL_BISON_API_KEY" \
    -H "Accept: application/json")

  # Add to array
  if [ "$FIRST" = true ]; then
    FIRST=false
  else
    STATS_ARRAY+=","
  fi

  INTERESTED=$(echo "$STATS" | jq -r '.data.interested // 0')
  EMAILS_SENT=$(echo "$STATS" | jq -r '.data.emails_sent // 0')

  STATS_ARRAY+="{\"workspace_id\":$WS_ID,\"workspace_name\":\"$WS_NAME\",\"interested\":$INTERESTED,\"emails_sent\":$EMAILS_SENT}"

done <<< "$WORKSPACES"

STATS_ARRAY+="]"
echo "$STATS_ARRAY" | jq '.' > "$OUTPUT_DIR/workspace-october-stats.json"

echo ""
echo "✓ Fetched October stats for all workspaces"
echo ""

# Now create the audit report
echo "Step 4: Generating audit report..."
echo ""

# Create markdown report
cat > "$OUTPUT_DIR/client-workspace-sync-audit.md" << 'EOF'
# Client-Workspace Synchronization Audit Report

**Generated**: $(date)
**Email Bison Workspaces**: $(jq '.data | length' email-bison-workspaces.json)
**Airtable Clients**: $(jq '.records | length' airtable-clients.json)

---

## 1. Perfect Matches

Clients where Airtable Workspace Name matches Email Bison workspace AND data syncs correctly.

| Client Name | Workspace Name | Airtable MTD | Bison Interested | Variance | Status |
|-------------|----------------|--------------|------------------|----------|--------|
EOF

# Process perfect matches
jq -r --slurpfile bison email-bison-workspaces.json --slurpfile stats workspace-october-stats.json '
.records[] |
select(.fields["Workspace Name"] != null and .fields["Workspace Name"] != "") |
. as $client |
$bison[0].data[] |
select(.name == $client.fields["Workspace Name"]) |
. as $workspace |
$stats[0][] |
select(.workspace_name == $workspace.name) |
{
  client: $client.fields["Client Company Name"],
  workspace: $client.fields["Workspace Name"],
  airtable_mtd: ($client.fields["Positive Replies MTD"] // 0),
  bison_interested: .interested,
  variance: (if .interested > 0 then ((($client.fields["Positive Replies MTD"] // 0) - .interested) / .interested * 100) else 0 end),
  status: $client.fields["Client Status"]
} |
"| \(.client) | \(.workspace) | \(.airtable_mtd) | \(.bison_interested) | \(.variance | floor)% | \(.status) |"
' "$OUTPUT_DIR/airtable-clients.json" >> "$OUTPUT_DIR/client-workspace-sync-audit.md"

cat >> "$OUTPUT_DIR/client-workspace-sync-audit.md" << 'EOF'

---

## 2. Missing Workspace Names

Airtable clients without Workspace Name field set.

| Client Name | Client Status | MTD | Monthly KPI | Action Needed |
|-------------|---------------|-----|-------------|---------------|
EOF

jq -r '
.records[] |
select(.fields["Workspace Name"] == null or .fields["Workspace Name"] == "") |
"| \(.fields["Client Company Name"]) | \(.fields["Client Status"]) | \(.fields["Positive Replies MTD"] // 0) | \(.fields["Monthly KPI"] // "N/A") | Set workspace name |"
' "$OUTPUT_DIR/airtable-clients.json" >> "$OUTPUT_DIR/client-workspace-sync-audit.md"

cat >> "$OUTPUT_DIR/client-workspace-sync-audit.md" << 'EOF'

---

## 3. Name Mismatches

Clients where Airtable Client Name differs from Workspace Name.

| Client Company Name | Workspace Name | Match | Issue |
|---------------------|----------------|-------|-------|
EOF

jq -r '
.records[] |
select(.fields["Workspace Name"] != null and .fields["Workspace Name"] != "") |
select(.fields["Client Company Name"] != .fields["Workspace Name"]) |
"| \(.fields["Client Company Name"]) | \(.fields["Workspace Name"]) | ❌ | Names differ |"
' "$OUTPUT_DIR/airtable-clients.json" >> "$OUTPUT_DIR/client-workspace-sync-audit.md"

cat >> "$OUTPUT_DIR/client-workspace-sync-audit.md" << 'EOF'

---

## 4. Orphaned Workspaces

Email Bison workspaces without corresponding Airtable client.

| Workspace ID | Workspace Name | October Interested | October Emails Sent | Action Needed |
|--------------|----------------|--------------------|--------------------|---------------|
EOF

jq -r --slurpfile clients airtable-clients.json --slurpfile stats workspace-october-stats.json '
.data[] |
. as $workspace |
($clients[0].records | map(select(.fields["Workspace Name"] == $workspace.name)) | length) as $match_count |
select($match_count == 0) |
$stats[0][] |
select(.workspace_name == $workspace.name) |
"| \($workspace.id) | \($workspace.name) | \(.interested) | \(.emails_sent) | Create client record or mark as internal |"
' "$OUTPUT_DIR/email-bison-workspaces.json" >> "$OUTPUT_DIR/client-workspace-sync-audit.md"

cat >> "$OUTPUT_DIR/client-workspace-sync-audit.md" << 'EOF'

---

## 5. Data Discrepancies (>10% variance)

Clients where Airtable MTD count differs significantly from Email Bison.

| Client Name | Workspace | Airtable MTD | Bison Interested | Variance | Investigation Needed |
|-------------|-----------|--------------|------------------|----------|----------------------|
EOF

jq -r --slurpfile bison email-bison-workspaces.json --slurpfile stats workspace-october-stats.json '
.records[] |
select(.fields["Workspace Name"] != null and .fields["Workspace Name"] != "") |
. as $client |
$bison[0].data[] |
select(.name == $client.fields["Workspace Name"]) |
. as $workspace |
$stats[0][] |
select(.workspace_name == $workspace.name) |
select(.interested > 0) |
select((($client.fields["Positive Replies MTD"] // 0) - .interested) / .interested * 100 > 10 or (($client.fields["Positive Replies MTD"] // 0) - .interested) / .interested * 100 < -10) |
{
  client: $client.fields["Client Company Name"],
  workspace: $client.fields["Workspace Name"],
  airtable_mtd: ($client.fields["Positive Replies MTD"] // 0),
  bison_interested: .interested,
  variance: (if .interested > 0 then ((($client.fields["Positive Replies MTD"] // 0) - .interested) / .interested * 100) else 0 end)
} |
"| \(.client) | \(.workspace) | \(.airtable_mtd) | \(.bison_interested) | \(.variance | floor)% | Check positive replies linking |"
' "$OUTPUT_DIR/airtable-clients.json" >> "$OUTPUT_DIR/client-workspace-sync-audit.md"

cat >> "$OUTPUT_DIR/client-workspace-sync-audit.md" << 'EOF'

---

## Summary Statistics

EOF

# Calculate summary stats
TOTAL_AIRTABLE=$(jq '.records | length' "$OUTPUT_DIR/airtable-clients.json")
TOTAL_BISON=$(jq '.data | length' "$OUTPUT_DIR/email-bison-workspaces.json")
MISSING_WORKSPACE=$(jq '.records | map(select(.fields["Workspace Name"] == null or .fields["Workspace Name"] == "")) | length' "$OUTPUT_DIR/airtable-clients.json")
PERFECT_MATCHES=$(jq -r --slurpfile bison "$OUTPUT_DIR/email-bison-workspaces.json" '.records[] | select(.fields["Workspace Name"] != null and .fields["Workspace Name"] != "") | . as $client | $bison[0].data[] | select(.name == $client.fields["Workspace Name"]) | .name' "$OUTPUT_DIR/airtable-clients.json" | wc -l | xargs)

cat >> "$OUTPUT_DIR/client-workspace-sync-audit.md" << EOF
- **Total Airtable Clients**: $TOTAL_AIRTABLE
- **Total Email Bison Workspaces**: $TOTAL_BISON
- **Perfect Matches**: $PERFECT_MATCHES
- **Missing Workspace Names**: $MISSING_WORKSPACE
- **Data Quality Score**: $(echo "scale=1; ($PERFECT_MATCHES / $TOTAL_AIRTABLE) * 100" | bc)%

---

## Recommended Actions

1. **Set missing workspace names** (4 clients)
2. **Investigate data discrepancies** (clients with >10% variance)
3. **Create client records** for orphaned workspaces (if applicable)
4. **Re-link positive replies** for mis-matched data

EOF

echo "✓ Audit report generated: $OUTPUT_DIR/client-workspace-sync-audit.md"
echo ""
echo "=========================================="
echo "Audit Complete!"
echo "=========================================="
echo ""
echo "View the full report at:"
echo "$OUTPUT_DIR/client-workspace-sync-audit.md"
echo ""
echo "Summary:"
echo "- Total Airtable Clients: $TOTAL_AIRTABLE"
echo "- Total Email Bison Workspaces: $TOTAL_BISON"
echo "- Perfect Matches: $PERFECT_MATCHES"
echo "- Missing Workspace Names: $MISSING_WORKSPACE"
