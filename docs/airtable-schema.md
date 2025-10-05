# Airtable Schema Documentation

**Base ID**: `appONMVSIf5czukkf`
**Last Updated**: October 2, 2025

## Table of Contents
1. [Overview](#overview)
2. [Core Client Management Tables](#core-client-management-tables)
3. [Performance Tracking Tables](#performance-tracking-tables)
4. [Infrastructure Tables](#infrastructure-tables)
5. [Internal Operations Tables](#internal-operations-tables)
6. [Field Naming Conventions](#field-naming-conventions)
7. [Data Relationships](#data-relationships)

---

## Overview

This Airtable base contains **28 tables** organized into several functional areas:
- Client management and KPI tracking
- Email campaign performance
- Infrastructure (domains, email accounts)
- Internal operations (tasks, sprints, knowledge base)

### All Tables (28 Total)

| Table Name | ID | Purpose | Key Fields |
|------------|----|---------| -----------|
| 👨‍💻 Clients | tblZr0fEKZiTZtx58 | **PRIMARY** - Client master records, KPIs, targets | 96 fields including KPIs, targets, progress |
| Positive Replies | tblUz8inqzWcWWTZY | Individual positive reply records (leads) | Date, client link, campaign link |
| Email Accounts | tblU3vgCFmVP960g9 | Email sending accounts per client | Client link, status, health |
| Campaigns Performance | tblL2eq7KCWfK1Zpo | Campaign-level metrics | Client link, emails sent, replies |
| Domains | tblKyaHAY9mBbWnRx | Domain records per client | Client link, DNS status |
| Campaign Production Pipeline | tblDRbKpGXXHBlq8h | Campaign creation workflow | Client link, status, due dates |
| B2B Campaigns Performance | tbloVXXsEjD7YLOHq | B2B-specific campaign tracking | Similar to Campaigns Performance |
| Weekly Performance | tblHT4Adt8ly3cSgE | Weekly aggregated metrics | Week, client, performance data |
| Warmy Reports | tblpBFNERY2cvYQNY | Email warmup health reports | Account link, health score |
| Warmy VS Bison | tblzl0VGqSV2acZQm | Platform comparison data | Comparative metrics |
| Infrastructure Orders | tblmWv1xAqQ9Jy75J | New account/domain orders | Client link, order status |
| Onboarding Form | tblGTaOd8phAiuaEH | Client onboarding responses | Form data, client link |
| Task Manager | tbln9sxZ8xScru0e1 | Client-specific ad-hoc tasks | Client link, status, owner |
| Monthly Lead KPI Tracker | tblxm7nsYdKQCHW92 | Historical monthly KPI data | Month, client, KPI achieved |
| 🌪️ Team Sprints 🌪️ | tbltjgMvyPY2TD065 | Team sprint planning | Sprint name, status, owner |
| ⚙️ Operations Features ⚙️ | tblcdZMd9WInZqy9L | Feature requests/dev tracking | Feature name, status, ETA |
| Knowledge Library | tblJHp0oN71y7GJnM | Internal documentation | Article, category, tags |
| Central Hub | tblzNRNMP4CsG98Lg | Dashboard/portal links | Resource type, URL |
| A/B Tests | tblLFbFWVNX3vLZyc | Campaign A/B test tracking | Test name, variants, results |
| A/B Insights | tblF4SwEshLCPYH55 | A/B test analysis | Test link, findings |
| Team | tblmqtyC0grLS6xWW | Team member records | Name, role, contact |
| Roles | tblOIYmLpelcoUlqH | Role definitions | Role name, permissions |
| Password Library | tbl1TabezEneRjyVv | Secure credential storage | Service, credentials |
| Warmy | tbluhZkv5DNRrv57D | Warmy account tracking | Account details |
| EOD Form | tblZxDWwszLeEXnQT | End-of-day reports | Date, submitter, summary |
| P&C Copy | tbllzqr66ffzshGzp | Copy/content templates | Copy type, text |
| TEMP | tblRzv6SKborUXQPR | Temporary/scratch data | Various |
| Table 27 | tbl0PiUbupRJcJQf5 | Unknown/unused | Unknown |

---

## Core Client Management Tables

### 1. 👨‍💻 Clients (tblZr0fEKZiTZtx58)

**Purpose**: Primary client master table - single source of truth for all client data, KPIs, and targets.

**Total Fields**: 96

**Key Field Groups**:

#### Identity & Basic Info
- `Client Company Name` (Primary Field) - Client's company name
- `Full Name` - Client contact's full name
- `Email` - Client email
- `Phone` - Client phone number
- `Airtable ID` - Formula: `RECORD_ID()` - unique identifier
- `Workspace Name` - Name in Email Bison platform
- `Workspace ID` - ID in Email Bison platform

#### KPI & Performance Metrics ⭐ **CRITICAL FOR DASHBOARDS**
- `Monthly KPI` - Target number of positive replies per month
- `Positive Replies MTD` - **Count** field - links to Positive Replies table, filtered for MTD
- `Positive Replies Current Month` - **Count** field - current calendar month
- `Positive Replies Last Month` - **Count** field - previous calendar month
- `Positive Replies Last 30 Days` - **Count** field - rolling 30 days
- `Positive Replies Last 7 Days` - **Count** field - last 7 days
- `Positive Replies Last 14-7 Days` - **Count** field - days 14-7 ago

#### Calculated Progress Fields
- `MTD - Leads Generated Progress` - Formula: `{Positive Replies MTD} / {Monthly KPI}` - Returns **percentage** (0.5 = 50%)
- `Projection: Positive Replies Received (by EOM)` - Formula: Projects end-of-month total based on current MTD rate
- `Projection Positive Replies % Progress` - Formula: Projected EOM vs. target percentage
- `Last Week VS Week Before Positive Replies % Progress` - Formula: Week-over-week growth %
- `Positive Replies Last VS This Month` - Formula: Month-over-month growth % (returns number like 25.0 for 25%)

#### Volume & Sending Metrics
- `Monthly Sending Target` - Target emails to send per month
- `Emails Sent - MTD (Linked to Campaigns)` - Rollup from campaigns
- `Emails Sent - Current Month (Linked to Campaigns)` - Current month total
- `Emails Sent - Last 30 Days (Linked to Campaigns)` - Rolling 30 days
- `3-Day Sending Average` - Average daily volume
- `Today Volume` - Emails sent today
- `Max Volume` - Maximum daily sending capacity

#### Billing & Revenue
- `Retainer` - Monthly retainer amount (currency)
- `Billing Date` - Monthly billing date
- `Payout` - Performance-based payout
- `ROI` - Formula: `{Positive Replies Received} * 500` (estimated value)
- `Return On Investment` - ROI percentage
- `Infrastructure Price` - Infrastructure costs

#### Client Status & Health
- `Client Status` - Single select: Infrastructure | Onboarding | On Track | At Risk | Offboarding | Churned
- `Client Importance` - Rating (1-5 stars)
- `Subjective Satisfactory Level` - Single select: Happy | Neutral | Churn Risk
- `Issues` - Single select: 🟢 No Issues | 🔴 Volume Issues | 🟤 Offer Issues | 🟠 Deliverability Issues
- `Join Date` - Client start date
- `Churn Date` - Client end date (if churned)

#### Team & Ownership
- `Project Manager` - Collaborator field
- `Campaign Manager` - Collaborator field

#### Platform & Technical
- `Sending Platform Used` - Single select: Maverick Bison | Instantly | Smartlead | LongRun Bison
- `Slack Channel ID` - For notifications
- `Positive Notifications Enabled?` - Checkbox
- `API` - API key/token

#### Linked Records (Relationships)
- `Positive Replies` - Links to Positive Replies table (one-to-many)
- `Email Accounts` - Links to Email Accounts table (one-to-many)
- `Domains` - Links to Domains table (one-to-many)
- `Campaigns Performance` - Links to Campaigns Performance table (one-to-many)
- `Campaign Production Pipeline` - Links to Campaign Production Pipeline (one-to-many)
- `Onboarding Form Linked` - Links to Onboarding Form (one-to-one)
- `Warmy Reports` - Links to Warmy Reports (one-to-many)
- `Ad-Hoc Task Manager` - Links to Task Manager (one-to-many)
- `Order - Email Accounts` - Links to Infrastructure Orders (one-to-many)

#### Counts from Linked Records
- `Email Accounts Owned` - Count of linked email accounts
- `Domains Owned` - Count of linked domains
- `Connected Accounts` - Active/healthy accounts
- `Disconnected Accounts` - Inactive/unhealthy accounts
- `Nu. of Active Campaigns` - Active campaign count

---

### 2. Positive Replies (tblUz8inqzWcWWTZY)

**Purpose**: Individual positive reply/lead records. Each record = 1 positive reply from a prospect.

**Key Fields**:
- `Lead Email` - Prospect email address
- `First Name` / `Last Name` - Prospect name
- `Date Received` - When reply was received
- `Reply Received` - Text of the reply
- `Email Sent` - Original email sent to prospect
- `Email Subject` - Subject line
- `Client` - Link to Clients table (which client this lead belongs to)
- `Client Name (from Client)` - Lookup of client name
- `Campaign Linked` - Link to campaign that generated this lead
- `Lead Value` - Estimated value (typically $500)
- `Workspace Name` - Email Bison workspace
- `Lead ID` - ID from Email Bison
- `State` / `City` / `ZIP` / `Address` - Lead location data
- `Received - MTD` - Checkbox/formula: Is this lead from current month-to-date?
- `Received - Last 7 Days` - Is this lead from last 7 days?
- `Last VS This Month` - Was this lead from current or previous month?
- `Previous 14-7 Days` - Was this lead from 14-7 days ago?

**How It Works**:
- Each time a positive reply is detected in Email Bison, a new record is created here
- The `Client` link field connects it to the client
- The `Positive Replies MTD` count field in Clients table counts records where `Received - MTD` = "✅ YES"
- Similar count fields filter by date ranges

---

## Performance Tracking Tables

### 3. Campaigns Performance (tblL2eq7KCWfK1Zpo)

**Purpose**: Campaign-level performance metrics aggregated from Email Bison.

**Key Fields**:
- `Campaign Name` - Name of campaign
- `Client` - Link to Clients table
- `Emails Sent` - Total emails sent in campaign
- `Opens` - Email opens
- `Clicks` - Link clicks
- `Replies` - Total replies
- `Positive Replies` - Interested replies
- `Bounced` - Bounced emails
- `Status` - Active/Paused/Completed

### 4. Weekly Performance (tblHT4Adt8ly3cSgE)

**Purpose**: Week-by-week performance snapshots for trend analysis.

### 5. Monthly Lead KPI Tracker (tblxm7nsYdKQCHW92)

**Purpose**: Historical monthly KPI achievement tracking.

---

## Infrastructure Tables

### 6. Email Accounts (tblU3vgCFmVP960g9)

**Purpose**: Individual email sending accounts (inboxes) per client.

**Key Fields**:
- `Email Address` - The sending email account
- `Client` - Link to Clients table
- `Status` - Active/Disconnected/Warming
- `Health Score` - Deliverability health (from Warmy)
- `Provider` - Google/Microsoft/SMTP
- `Daily Send Limit` - Max emails per day

### 7. Domains (tblKyaHAY9mBbWnRx)

**Purpose**: Domain records used for sending.

**Key Fields**:
- `Domain Name` - The domain (e.g., example.com)
- `Client` - Link to Clients table
- `DNS Status` - Configured/Pending/Issues
- `SPF/DKIM/DMARC` - DNS record status

### 8. Infrastructure Orders (tblmWv1xAqQ9Jy75J)

**Purpose**: Tracks orders for new email accounts/domains.

**Key Fields**:
- `Client` - Link to Clients table
- `Order Type` - Email Accounts/Domains
- `Quantity` - Number ordered
- `Status` - New | In Progress | Blocked | Completed

---

## Internal Operations Tables

### 9. Task Manager (tbln9sxZ8xScru0e1)

**Purpose**: Ad-hoc client tasks and follow-ups.

### 10. Campaign Production Pipeline (tblDRbKpGXXHBlq8h)

**Purpose**: Tracks campaign creation workflow (copywriting, review, launch).

### 11. 🌪️ Team Sprints 🌪️ (tbltjgMvyPY2TD065)

**Purpose**: Sprint planning and tracking for team.

### 12. ⚙️ Operations Features ⚙️ (tblcdZMd9WInZqy9L)

**Purpose**: Feature requests and development tracking.

---

## Field Naming Conventions

### Identified Patterns

**Count Fields**:
- Format: `[Metric Name]` - Example: `Positive Replies MTD`
- Type: Count field that counts linked records with specific filters
- Always returns integer

**Formula Fields (Calculated)**:
- Progress: Returns decimal (0.75 = 75%) or percentage directly
- Projections: Returns integer (projected count)
- Comparisons: Returns percentage as decimal or number

**Lookup Fields**:
- Format: `[Field Name] (from [Table Name])` - Example: `Client Name (from Client)`

**Rollup Fields**:
- Aggregate data from linked records

### Time Period Naming

| Pattern | Meaning | Example |
|---------|---------|---------|
| MTD | Month-to-Date (calendar month, day 1 to today) | `Positive Replies MTD` |
| Current Month | Same as MTD | `Positive Replies Current Month` |
| Last Month | Previous calendar month (full month) | `Positive Replies Last Month` |
| Last X Days | Rolling X-day window from today | `Positive Replies Last 30 Days` |
| Last 14-7 Days | Days 14-7 ago (week before last week) | `Positive Replies Last 14-7 Days` |

---

## Data Relationships

### Primary Flow: Client → Positive Replies

```
👨‍💻 Clients (Master)
    ↓ (one-to-many)
📨 Positive Replies (Individual leads)
    ↑ (count fields with filters)
👨‍💻 Clients (MTD, Last 7 Days, etc.)
```

**How Count Fields Work**:
1. Clients table has linked record field `Positive Replies` pointing to Positive Replies table
2. Positive Replies table has formula fields like `Received - MTD` that return "✅ YES" or "❌ NO"
3. Clients table has count fields that count linked replies where `Received - MTD` = "✅ YES"
4. This gives real-time counts based on date filters

### Infrastructure Flow

```
👨‍💻 Clients
    ↓
📧 Email Accounts → Warmy Reports (health data)
🌐 Domains
```

### Campaign Flow

```
👨‍💻 Clients
    ↓
📊 Campaigns Performance
    ↓
📨 Positive Replies (linked to campaigns)
```

---

## Critical Insights for Dashboard Integration

### KPI Dashboard Uses:
1. **Primary Field**: `Positive Replies MTD` (count field, auto-updates)
2. **Target**: `Monthly KPI` (manual input)
3. **Progress**: `MTD - Leads Generated Progress` (formula, returns decimal 0-1)
4. **Projection**: `Projection: Positive Replies Received (by EOM)` (formula)

### Volume Dashboard Uses:
1. **Target**: `Monthly Sending Target`
2. **Actual**: `Emails Sent - MTD (Linked to Campaigns)` or Email Bison API
3. **Today**: `Today Volume` or Email Bison API

### Billing Dashboard Uses:
1. **Retainer**: `Retainer`
2. **Performance Payout**: `Payout`
3. **KPI Achievement**: `Positive Replies MTD` / `Monthly KPI`

---

## Data Quality Considerations

### Known Issues

**Issue 1: MTD vs Current Month Confusion**
- Both `Positive Replies MTD` and `Positive Replies Current Month` exist
- **MTD** = "Month to Date" (should reset on 1st of month)
- **Current Month** = Current calendar month
- In theory they should be identical, but we've seen discrepancies
- **Recommendation**: Use `Positive Replies MTD` as it's more likely to reset properly

**Issue 2: Rolling vs Calendar Windows**
- "Last 30 Days" is a ROLLING 30-day window
- "Current Month" is CALENDAR month (Sept 1-30, Oct 1-31, etc.)
- Be careful not to mix these in comparisons

**Issue 3: Count Field Dependencies**
- Count fields depend on formula fields in the Positive Replies table
- If those formulas break or date logic is wrong, counts will be wrong
- Always verify the underlying `Received - MTD` type fields in Positive Replies

### Recommended Validations

1. **Monthly Reset Check**: On 1st of each month, verify MTD fields reset to 0
2. **Cross-Reference**: Compare Airtable counts to Email Bison API counts
3. **Date Logic Audit**: Review all date-based formulas in Positive Replies table
4. **Missing Links**: Check for clients in Email Bison but not in Airtable (orphaned data)

---

## Next Steps

1. ✅ Schema documented
2. ⏳ Review and fix date formulas in Positive Replies table
3. ⏳ Standardize field mappings in Edge Functions
4. ⏳ Create field-to-dashboard mapping guide
5. ⏳ Set up monthly data validation automation
