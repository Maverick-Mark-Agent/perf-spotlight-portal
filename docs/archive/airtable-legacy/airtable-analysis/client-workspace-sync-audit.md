# Client-Workspace Synchronization Audit Report

**Generated**: $(date)
**Email Bison Workspaces**: $(jq '.data | length' email-bison-workspaces.json)
**Airtable Clients**: $(jq '.records | length' airtable-clients.json)

---

## 1. Perfect Matches

Clients where Airtable Workspace Name matches Email Bison workspace AND data syncs correctly.

| Client Name | Workspace Name | Airtable MTD | Bison Interested | Variance | Status |
|-------------|----------------|--------------|------------------|----------|--------|

---

## 2. Missing Workspace Names

Airtable clients without Workspace Name field set.

| Client Name | Client Status | MTD | Monthly KPI | Action Needed |
|-------------|---------------|-----|-------------|---------------|
| Koppa Analytics | Infrastructure | 0 | N/A | Set workspace name |
| Boshra | Infrastructure | 0 | N/A | Set workspace name |

---

## 3. Name Mismatches

Clients where Airtable Client Name differs from Workspace Name.

| Client Company Name | Workspace Name | Match | Issue |
|---------------------|----------------|-------|-------|
| Nicholas Sakha | Nick Sakha | ❌ | Names differ |
| Binyon Agency | Jason Binyon | ❌ | Names differ |
| Small Biz Heroes | Small biz Heroes | ❌ | Names differ |
| Biz Power Benefits | biz power benifits | ❌ | Names differ |
| Maverick - Longrun | Insurance | ❌ | Names differ |
| Radiant Energy Partners | Radiant Energy | ❌ | Names differ |
| SMA Insurance Services | SMA Insurance | ❌ | Names differ |
| Ozment media | Ozment Media | ❌ | Names differ |

---

## 4. Orphaned Workspaces

Email Bison workspaces without corresponding Airtable client.

| Workspace ID | Workspace Name | October Interested | October Emails Sent | Action Needed |
|--------------|----------------|--------------------|--------------------|---------------|

---

## 5. Data Discrepancies (>10% variance)

Clients where Airtable MTD count differs significantly from Email Bison.

| Client Name | Workspace | Airtable MTD | Bison Interested | Variance | Investigation Needed |
|-------------|-----------|--------------|------------------|----------|----------------------|

---

## Summary Statistics

- **Total Airtable Clients**: 29
- **Total Email Bison Workspaces**: 27
- **Perfect Matches**: 21
- **Missing Workspace Names**: 2
- **Data Quality Score**: 70.0%

---

## Recommended Actions

1. **Set missing workspace names** (4 clients)
2. **Investigate data discrepancies** (clients with >10% variance)
3. **Create client records** for orphaned workspaces (if applicable)
4. **Re-link positive replies** for mis-matched data

