# Complete Feature Report - Maverick Marketing Portal

**Generated:** 2025-01-27  
**Purpose:** Full feature parity documentation for rebuilding this project from scratch

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Admin Dashboard Features](#admin-dashboard-features)
4. [Client Portal Features](#client-portal-features)
5. [Lead Management System](#lead-management-system)
6. [Analytics & Reporting](#analytics--reporting)
7. [ZIP Code Management](#zip-code-management)
8. [Email Infrastructure Management](#email-infrastructure-management)
9. [Automated Workflows](#automated-workflows)
10. [Integration Features](#integration-features)
11. [Data Pipeline Features](#data-pipeline-features)
12. [User Management](#user-management)
13. [Billing & Revenue Management](#billing--revenue-management)
14. [Notification & Alerting](#notification--alerting)

---

## Overview

The Maverick Marketing Portal is a comprehensive lead generation and client management platform designed for homeowner insurance lead generation. It serves 18+ insurance agency clients with:

- **Real-time lead pipeline management**
- **Automated email marketing workflows**
- **Performance analytics and KPIs**
- **Multi-client portal system with role-based access**
- **Geographic ZIP code assignment and visualization**
- **Integrated email infrastructure monitoring**

**Live URL:** https://perf-spotlight-portal.lovable.app

---

## Authentication & Authorization

### User Roles

1. **Admin** (`admin`)
   - Full access to all workspaces
   - Access to all admin dashboards
   - User management capabilities
   - System configuration access

2. **Client** (`client`)
   - Access only to assigned workspace(s)
   - View and manage their own leads
   - Update pipeline stages
   - Refresh data from Email Bison
   - ROI calculator access

3. **Viewer** (`viewer`)
   - Read-only access to assigned workspace(s)
   - Cannot edit leads or pipeline stages
   - View-only dashboard access

### Authentication Features

- **Login Page** (`/login`)
  - Email/password authentication via Supabase Auth
  - Password reset functionality
  - Session persistence with auto-refresh
  - PKCE flow for security

- **Protected Routes**
  - Route-level protection with role checking
  - Automatic redirect to login for unauthenticated users
  - Workspace-based data filtering

- **Session Management**
  - Token refresh on expiry
  - Session storage in localStorage
  - Auto-detect session from URL (email confirmation)

---

## Admin Dashboard Features

### 1. Home Page (`/admin`)

**Purpose:** Main admin dashboard overview

**Features:**
- Navigation hub to all admin sections
- Quick stats overview
- Recent activity summary
- Quick actions menu

### 2. KPI Dashboard (`/kpi-dashboard`)

**Purpose:** Track key performance indicators across all clients

**Key Metrics:**
- **Positive Replies:** Count of interested leads
- **Appointments Booked:** Scheduled consultations
- **Policies Sold:** Closed deals (won leads)
- **Monthly KPI Targets:** Per-client goals
- **Projected End-of-Month:** Forecast calculations

**Features:**
- **Client Filtering:** Whitelist of 14 clients displayed
- **View Modes:**
  - Aggregate: Combined metrics across all clients
  - Individual: Per-client breakdown
- **Comparison Metrics:**
  - Month-over-month growth
  - Progress toward monthly targets
  - Percentage completion
- **Visual Components:**
  - Progress pie charts per client
  - Replies timeline view
  - Comparison metrics cards
  - Client performance lists
- **Data Refresh:**
  - Manual refresh button (cooldown: 60 seconds)
  - Data freshness indicator
  - Automatic sync via webhook
  - Cache management (30-second stale threshold)

**Data Sources:**
- Email Bison API (real-time)
- `client_registry` table (targets)
- `daily_kpi_sync` cron job

### 3. Volume Dashboard (`/volume-dashboard`)

**Purpose:** Track daily lead volume and sending capacity

**Features:**
- Daily lead volume tracking
- Email account sending limits
- Capacity utilization metrics
- Slack notifications for milestones
- Volume trends over time
- Per-client volume breakdown

**Key Metrics:**
- Daily leads generated
- Monthly volume targets
- Account capacity utilization
- Sending volume per account

### 4. Revenue Dashboard (`/revenue-dashboard`)

**Purpose:** Financial tracking and profitability analysis

**Features:**
- **Revenue Tracking:**
  - Per-lead revenue
  - Retainer revenue
  - Monthly revenue totals
  - Revenue by client
- **Cost Management:**
  - Email account costs
  - Labor costs
  - Other operational costs
  - Total cost per client
- **Profitability Analysis:**
  - Profit margins per client
  - Cost per acquisition (CPA)
  - Revenue vs. costs charts
- **Time-Series Data:**
  - Daily billable revenue tracking
  - Cumulative revenue charts
  - Revenue forecasts
  - Target vs. actual comparison
- **Visual Components:**
  - Bar charts (revenue by client)
  - Line charts (time-series trends)
  - Area charts (cumulative revenue)
  - Percentage breakdowns (per-lead vs. retainer)

**Data Sources:**
- `client_pricing` table
- `client_costs` table
- `monthly_revenue_snapshots` table
- `client_revenue_mtd` view
- `daily_billable_revenue` function

### 5. ROI Dashboard (`/roi-dashboard`)

**Purpose:** Return on investment analysis

**Features:**
- Cost per acquisition (CPA)
- Return on ad spend (ROAS)
- ROI percentage calculations
- Client-specific ROI metrics
- Historical ROI trends

### 6. ZIP Dashboard (`/zip-dashboard`)

**Purpose:** Geographic ZIP code assignment and visualization

**Features:**
- **Interactive Map Visualization:**
  - Plotly.js choropleth maps
  - Leaflet-based maps (alternative)
  - State-specific GeoJSON support
  - ZIP code boundaries rendering
- **State Support:**
  - California (CA)
  - Nevada (NV)
  - Texas (TX)
  - Michigan (MI)
  - Illinois (IL)
  - Oregon (OR)
  - Missouri (MO)
  - Oklahoma (OK)
- **ZIP Code Management:**
  - Assign ZIPs to clients by month
  - Bulk ZIP assignment
  - CSV upload for ZIP assignments
  - Agency color coding
  - Client ZIP filtering
- **Visual Features:**
  - Color-coded agencies on map
  - Legend with agency colors
  - ZIP code search/filter
  - State filter dropdown
  - Agency filter dropdown
- **Assignment Workflow:**
  - Staging ZIPs (month='active')
  - Commit ZIPs to specific month
  - Manage agency ZIP assignments modal
  - Bulk operations support

**Data Sources:**
- `client_zipcodes` table
- `client_registry` table (agency colors)
- GeoJSON files for state boundaries

### 7. Contact Pipeline Dashboard (`/contact-pipeline`)

**Purpose:** Automated contact processing pipeline management

**Features:**
- **Pipeline Stages:**
  1. Raw Contacts Upload (CSV from Cole X Dates)
  2. Email Verification (Debounce API)
  3. Weekly Batch Generation
  4. Email Bison Upload
  5. Campaign Assignment
- **Metrics Dashboard:**
  - Raw contacts uploaded
  - Verified contacts count
  - Deliverable vs. undeliverable emails
  - Weekly batch status
  - Gap analysis (target vs. actual)
- **Batch Management:**
  - Weekly batch schedule (4 batches per month)
  - Scheduled upload dates (Mondays)
  - Upload status tracking
  - Slack approval workflow
- **Client Tier Management:**
  - 100-lead tier (15k contacts/month)
  - 200-lead tier (30k contacts/month)
  - Custom tier support
- **High Net Worth Routing:**
  - TX homes >$900k route to HNW campaign
  - Separate campaign management
  - HNW count tracking

**Data Sources:**
- `raw_contacts` table
- `verified_contacts` table
- `weekly_batches` table
- `upload_audit_log` table
- `monthly_contact_pipeline_summary` view

### 8. Email Accounts Page (`/email-accounts`)

**Purpose:** Email infrastructure health monitoring

**Features:**
- **Account Management:**
  - Email account CRUD operations
  - Account status monitoring
  - Sending capacity tracking
  - Daily sending limits
- **Health Scoring:**
  - Account health scores (0-100)
  - Risk categorization (healthy, warning, critical)
  - Performance metrics per account
- **Tabs:**
  - **Overview:** Aggregate metrics
  - **Home Insurance:** Home insurance-specific accounts
  - **All Clients:** Complete account list
  - **Performance:** Historical performance
- **Alerts:**
  - Critical account warnings
  - Sending capacity alerts
  - Account health degradation alerts
- **Integration:**
  - Email Bison API sync
  - Daily polling job status
  - Real-time updates

**Data Sources:**
- `email_accounts` table
- `email_account_metadata` table
- `email_account_polling` cron job
- Email Bison API

### 9. Rollout Progress (`/rollout-progress`)

**Purpose:** Track feature rollout and migration progress

**Features:**
- Progress tracking per workspace
- Migration status indicators
- Completion percentages
- Timeline visualization

### 10. Client Management (`/client-management`)

**Purpose:** Admin interface for managing client accounts

**Features:**
- **Client List:**
  - Display all clients
  - Search and filter
  - Client status indicators
- **Client Profile** (`/client-management/:workspaceId`):
  - Client details editor
  - Workspace configuration
  - KPI target management
  - ZIP code assignments
  - Revenue settings
  - Billing configuration
- **Client Operations:**
  - Add new client
  - Edit client settings
  - Archive/reactivate clients
  - Bulk operations

**Data Sources:**
- `client_registry` table
- `client_settings` table
- `client_pricing` table

### 11. User Management (`/user-management`)

**Purpose:** Manage user accounts and workspace access

**Features:**
- **User List:**
  - All users display
  - Role indicators
  - Last login tracking
  - Workspace access count
- **User Operations:**
  - Create new user
  - Assign workspace access
  - Modify roles
  - Remove workspace access
  - Delete users
- **Workspace Access Management:**
  - Multi-workspace assignment
  - Role per workspace
  - Bulk assignments

**Data Sources:**
- `auth.users` table (Supabase Auth)
- `user_workspace_access` table

---

## Client Portal Features

### 1. Client Portal Hub (`/client-portal`)

**Purpose:** Landing page for authenticated clients

**Features:**
- **Workspace Selection:**
  - List of accessible workspaces
  - Workspace cards with quick stats
  - Direct navigation to workspace portal
- **Multi-Workspace Support:**
  - Clients can access multiple workspaces
  - Each workspace shown as separate card
- **Quick Stats Preview:**
  - Total leads count
  - Won deals count
  - Recent activity indicator

### 2. Client Portal Page (`/client-portal/:workspace`)

**Purpose:** Individual workspace lead management portal

**Features:**
- **Pipeline Management:**
  - Drag-and-drop pipeline stages
  - Stages: Interested, Quoting, Follow Up, Won, Lost
  - Stage-based lead filtering
  - Pipeline position sorting
- **Lead Display:**
  - Lead cards with key information
  - Lead detail modal
  - Search functionality
  - Date filtering
  - Campaign filtering
- **Lead Actions:**
  - Toggle "Interested" flag
  - Update pipeline stage
  - Add/edit notes
  - Open Email Bison conversation
  - Edit premium amount
  - Mark as won/lost
- **KPI Stats:**
  - Total leads
  - Won leads count
  - New leads (last 30 days)
  - Projected replies
  - Monthly progress
- **Data Refresh:**
  - Manual refresh button
  - Real-time updates via webhook
  - Sync progress indicator
- **Lead Detail Modal:**
  - Full lead information
  - Email Bison conversation link
  - Custom variables display
  - Tags display
  - Edit capabilities
- **Premium Input Dialog:**
  - Enter premium amount for won leads
  - Policy type selection
  - Revenue calculation

**Data Sources:**
- `client_leads` table (filtered by workspace)
- Email Bison API (for conversation URLs)
- `hybrid-workspace-analytics` edge function

---

## Lead Management System

### Lead Data Model

**Core Fields:**
- Contact info: email, first_name, last_name, phone
- Address: address, city, state, zip
- Dates: date_received, reply_received, email_sent
- Campaign: campaign_name, sender_email, email_subject
- Pipeline: pipeline_stage, pipeline_position, interested flag
- Notes: notes field for MJ Notes
- Email Bison: bison_conversation_url, bison_lead_id, reply_uuid
- Premium: premium_amount, policy_type (for won leads)
- Custom: custom_variables (JSON), tags (array)

### Pipeline Stages

1. **New** (default)
2. **Interested** (pink) - Positive reply received
3. **Quoting** (purple) - In quote process
4. **Follow Up** (yellow) - Needs follow-up
5. **Won** (green) - Deal closed, policy sold
6. **Lost** (red) - Lead lost/disqualified

### Lead Features

- **Drag-and-Drop:** Change pipeline stage via DnD Kit
- **Interested Toggle:** Quick toggle for interested status
- **Sorting:** Position-based sorting within stages
- **Filtering:** By stage, date, campaign, search term
- **Real-time Updates:** Webhook-driven updates
- **Sync Tracking:** last_synced_at timestamp
- **Soft Delete:** deleted_at timestamp support

---

## Analytics & Reporting

### Real-time Analytics

- **Dashboard Context:** Centralized state management
- **Data Caching:** 30-second cache with freshness checks
- **Refresh Cooldown:** 60-second minimum between refreshes
- **Performance Tracking:** Fetch duration metrics

### Metric Calculations

- **Monthly KPI Progress:** (Current / Target) × 100
- **Projected EOM:** Linear projection based on daily rate
- **Revenue Calculations:** Per-lead × billable leads + retainer
- **Profit Margin:** ((Revenue - Costs) / Revenue) × 100
- **CPA:** Total costs / billable leads
- **ROI:** ((Revenue - Costs) / Costs) × 100

### Reporting Features

- **Time-Series Charts:** Daily, weekly, monthly trends
- **Comparison Metrics:** MoM, YoY comparisons
- **Export Capabilities:** (Potential - not explicitly implemented)
- **Scheduled Reports:** Daily KPI sync cron job

---

## ZIP Code Management

### ZIP Assignment System

**Features:**
- **Monthly Assignment:** ZIPs assigned per client per month
- **State-Based:** Filtering and assignment by state
- **Agency Colors:** Visual differentiation on map
- **Staging Workflow:** Active staging before month commit
- **Bulk Operations:** CSV upload for mass assignment

### ZIP Visualization

- **Choropleth Maps:** Color-coded ZIP boundaries
- **Multi-State Support:** 8 states with GeoJSON
- **Interactive Features:**
  - Hover for ZIP details
  - Click for assignment
  - Filter by state/agency
  - Search ZIP codes

### ZIP Batch Tracking

- **Pipeline Integration:** Links to contact pipeline
- **Batch Status:** Tracking upload status
- **Month-Based:** Historical assignment tracking

---

## Email Infrastructure Management

### Email Account Monitoring

**Features:**
- **Account Health Scoring:**
  - Algorithm-based health score (0-100)
  - Performance metrics tracking
  - Risk categorization
- **Sending Capacity:**
  - Daily sending limits
  - Volume per account tracking
  - Capacity utilization alerts
- **Polling System:**
  - Daily account status sync
  - Email Bison API integration
  - Automatic refresh at midnight

### Alert System

- **Critical Accounts:** Immediate alert for health < 50
- **Capacity Warnings:** Near-limit notifications
- **Performance Degradation:** Trend-based alerts
- **Slack Integration:** Automated notifications

---

## Automated Workflows

### PT1: Cole Monthly Pulls

**Purpose:** Pull homeowner data from Cole X Dates

**Schedule:** 15th of each month

**Features:**
- **Multi-State Support:** NJ, TX, FL, CA
- **ZIP-Based Filtering:** Pull by assigned ZIPs
- **Field Selection:** 13 required fields
- **Chunking:** Automatic chunking for <10k records
- **Data Storage:** Saves to `raw_leads` table
- **Error Handling:** Screenshot capture, error logging
- **Notifications:** Slack alerts on completion

**Filters:**
- Home value ≤ $900k (or >$900k for TX HNW)
- Head of household only
- Purchase date range

### PT2: Clay Formatting & Enrichment

**Purpose:** Format and validate leads via Clay

**Features:**
- **Email Validation:** Debounce API integration
- **Data Enrichment:** Additional field population
- **Filtering:** Home value and HOH filtering
- **Output:** Cleaned leads to `cleaned_leads` table

### PT3: Gap Analysis

**Purpose:** Compare cleaned count vs. target, trigger additional pulls

**Features:**
- **Target Comparison:** Monthly contact target vs. actual
- **Gap Calculation:** Contacts needed
- **Supplemental Pulls:** Auto-trigger if gap exists
- **Notification:** Alert on gap detection

### PT4: Email Bison Weekly Uploads

**Purpose:** Upload contacts to Email Bison campaigns

**Schedule:** Fridays (weekly batches)

**Features:**
- **Campaign Import:** Import contacts to campaigns
- **Field Mapping:** Standardized field mapping
- **Tagging:** Automatic campaign tagging
- **Tracking:** Upload audit logging
- **Error Handling:** Retry logic, error reporting

### PT5: Evergreen Campaign Rotation

**Purpose:** Manage campaign rotation and renaming

**Features:**
- **Campaign Renaming:** Weekly rotation naming
- **Rotation Management:** Automated rotation logic
- **Tracking:** Campaign status updates

---

## Integration Features

### Email Bison Integration

**Features:**
- **API Authentication:** Workspace-based API keys
- **Webhook Support:** Real-time lead updates
- **Conversation URLs:** Direct links to conversations
- **Lead Sync:** Automatic lead synchronization
- **Campaign Management:** Create, update, rename campaigns
- **Contact Import:** CSV import functionality

**Endpoints Used:**
- Login/Authentication
- Workspace listing
- Campaign listing
- Contact import
- Lead details
- Webhook configuration

### Clay Integration

**Features:**
- **Browser Automation:** Playwright-based login
- **Data Enrichment:** Additional field population
- **Email Verification:** Debounce integration
- **CSV Export:** Formatted lead export

### Cole X Dates Integration

**Features:**
- **Multi-State Accounts:** Separate credentials per state
- **Data Query:** State/ZIP-based queries
- **CSV Export:** Raw data export
- **Field Selection:** Configurable field list

### Debounce Integration

**Features:**
- **Email Verification:** Deliverability checking
- **Credit Tracking:** Usage monitoring
- **Status Categorization:** Deliverable, undeliverable, risky, unknown
- **Batch Processing:** Bulk verification support

### Slack Integration

**Features:**
- **Webhook Notifications:** Automated alerts
- **Workflow Approvals:** Batch approval system
- **Status Updates:** Pipeline progress notifications
- **Error Alerts:** Critical issue notifications

---

## Data Pipeline Features

### Contact Processing Pipeline

**Stages:**

1. **Raw Upload** (`raw_contacts`)
   - CSV upload from Cole X Dates
   - Initial validation
   - Batch tracking

2. **Verification** (`verified_contacts`)
   - Debounce email verification
   - Renewal window calculation (M+28 to M+34 days)
   - Week bucket assignment (1-4 based on purchase day)
   - HNW routing (>$900k TX homes)

3. **Batch Generation** (`weekly_batches`)
   - Weekly batch creation (4 per month)
   - Scheduled upload dates (Mondays)
   - Contact count tracking
   - Slack approval workflow

4. **Email Bison Upload** (`upload_audit_log`)
   - CSV generation
   - Campaign assignment
   - Upload status tracking
   - Error logging

### Data Transformation

- **Normalization:** Standardize field formats
- **Deduplication:** Hash-based duplicate detection
- **Validation:** Email format, required fields
- **Enrichment:** Additional data population

### Data Quality

- **Email Validation:** Format and deliverability
- **Address Standardization:** Normalized addresses
- **Phone Formatting:** Standardized phone numbers
- **Data Cleaning:** Remove invalid records

---

## User Management

### User Creation

**Methods:**
1. **Supabase Dashboard:** Manual creation
2. **Admin Interface:** User management page
3. **Bulk SQL:** Multiple users at once

### Workspace Access

**Features:**
- **Multi-Workspace:** Users can access multiple workspaces
- **Role Per Workspace:** Different roles per workspace
- **Access Control:** RLS-based filtering
- **Permission Levels:** Admin, client, viewer

### Password Management

- **Password Reset:** Email-based reset
- **Manual Reset:** Admin-initiated reset
- **Temporary Passwords:** Generated on creation

---

## Billing & Revenue Management

### Pricing Models

1. **Per-Lead Pricing:**
   - Price per billable lead
   - Tracked per client
   - Monthly aggregation

2. **Retainer Pricing:**
   - Fixed monthly amount
   - Independent of lead count
   - Recurring billing

### Cost Tracking

**Categories:**
- Email account costs
- Labor costs
- Other operational costs
- Total costs (auto-calculated)

### Revenue Calculations

- **Billable Leads:** Leads marked as "won" with premium
- **Monthly Revenue:** Per-lead × billable + retainer
- **Daily Revenue:** Cumulative daily tracking
- **Profit:** Revenue - Costs
- **Margin:** (Profit / Revenue) × 100

### Reporting

- **Revenue Dashboard:** Real-time revenue tracking
- **Client-Level:** Per-client breakdown
- **Time-Series:** Daily, monthly trends
- **Forecasting:** Projected revenue based on trends

---

## Notification & Alerting

### Slack Notifications

**Use Cases:**
- Workflow completion (PT1-PT5)
- Volume milestones
- Critical account alerts
- Error notifications
- Batch approval requests

### Alert Types

1. **Critical:** Immediate attention required
2. **Warning:** Potential issues
3. **Info:** Status updates
4. **Success:** Completed operations

### Notification Channels

- **Slack Webhook:** Primary channel
- **In-App Toasts:** User actions
- **Email:** (Potential - not explicitly implemented)

---

## Additional Features

### Data Freshness Indicators

- **Last Updated:** Timestamp display
- **Cache Status:** Fresh/stale indicators
- **Sync Progress:** Real-time sync status

### Theme Support

- **Light/Dark Mode:** Theme toggle
- **Agency Colors:** Customizable agency colors
- **Accessibility:** High contrast support

### Responsive Design

- **Mobile Support:** Responsive layouts
- **Tablet Optimization:** Tablet-friendly views
- **Desktop First:** Full-featured desktop experience

### Error Handling

- **Error Boundaries:** React error boundaries
- **Retry Logic:** Automatic retries for API calls
- **Error Logging:** Structured error logging
- **User Feedback:** Toast notifications for errors

### Performance Optimization

- **Code Splitting:** Vendor chunks separation
- **Lazy Loading:** Route-based code splitting
- **Caching:** Strategic data caching
- **Optimistic Updates:** UI updates before API confirmation

---

## Feature Completeness Checklist

### Authentication ✓
- [x] Login/logout
- [x] Password reset
- [x] Role-based access control
- [x] Multi-workspace access
- [x] Session management

### Admin Dashboards ✓
- [x] KPI Dashboard
- [x] Volume Dashboard
- [x] Revenue Dashboard
- [x] ROI Dashboard
- [x] ZIP Dashboard
- [x] Contact Pipeline Dashboard
- [x] Email Accounts Page
- [x] Rollout Progress
- [x] Client Management
- [x] User Management

### Client Portal ✓
- [x] Portal Hub
- [x] Workspace Portal
- [x] Pipeline Management
- [x] Lead Detail Modal
- [x] ROI Calculator
- [x] Premium Input

### Lead Management ✓
- [x] Lead CRUD operations
- [x] Pipeline stages
- [x] Drag-and-drop
- [x] Search/filter
- [x] Notes management
- [x] Email Bison integration

### Analytics ✓
- [x] Real-time KPIs
- [x] Time-series charts
- [x] Comparison metrics
- [x] Client performance
- [x] Revenue tracking

### Automation ✓
- [x] PT1: Cole pulls
- [x] PT2: Clay formatting
- [x] PT3: Gap analysis
- [x] PT4: Bison uploads
- [x] PT5: Campaign rotation

### Integrations ✓
- [x] Email Bison API
- [x] Clay API
- [x] Cole X Dates
- [x] Debounce API
- [x] Slack webhooks

### Data Pipeline ✓
- [x] Contact processing
- [x] Email verification
- [x] Batch generation
- [x] Upload tracking
- [x] Audit logging

---

## User Workflows

### Admin Workflow

1. **Daily Operations:**
   - Check KPI Dashboard for metrics
   - Review Email Accounts health
   - Monitor Contact Pipeline progress
   - Check Revenue Dashboard

2. **Client Onboarding:**
   - Create user in Supabase
   - Assign workspace access
   - Configure KPI targets
   - Set up billing (per-lead or retainer)
   - Assign ZIP codes

3. **Monthly Operations:**
   - Run PT1 (Cole pulls) on 15th
   - Monitor gap analysis
   - Approve weekly batches
   - Review revenue snapshots

### Client Workflow

1. **Daily Operations:**
   - Log in to portal
   - Review new leads
   - Update pipeline stages
   - Respond to interested leads
   - Track won deals

2. **Lead Management:**
   - Drag leads between stages
   - Add notes
   - Toggle interested flag
   - Open Email Bison conversations
   - Enter premium for won deals

---

## API Endpoints Reference

### Supabase Edge Functions

- `hybrid-workspace-analytics` - Client analytics
- `hybrid-email-accounts` - Email account sync
- `bison-interested-webhook` - Lead webhook handler
- `process-contact-upload` - CSV processing
- `generate-weekly-batches` - Batch generation
- `revenue-analytics` - Revenue calculations
- `admin-create-user` - User creation
- `manage-users` - User management

### External APIs

- **Email Bison:** REST API
- **Clay:** Browser automation + API
- **Cole X Dates:** Browser automation
- **Debounce:** Email verification API
- **Slack:** Webhook API

---

## Data Models Summary

### Core Tables

1. `client_leads` - Lead data with pipeline stages
2. `client_registry` - Client/workspace configuration
3. `client_pricing` - Billing configuration
4. `client_costs` - Cost tracking
5. `client_zipcodes` - ZIP assignments
6. `raw_contacts` - Unprocessed contacts
7. `verified_contacts` - Email-verified contacts
8. `weekly_batches` - Batch tracking
9. `email_accounts` - Email infrastructure
10. `user_workspace_access` - User permissions
11. `agent_runs` - Workflow execution logs
12. `agent_errors` - Error tracking

### Views

- `monthly_contact_pipeline_summary` - Pipeline progress
- `weekly_batch_status` - Batch status overview
- `client_revenue_mtd` - Monthly revenue totals

### Functions

- `daily_billable_revenue()` - Daily revenue calculation
- `get_user_workspaces()` - User workspace lookup
- `increment_metric()` - Metric tracking

---

## Configuration & Settings

### Client Settings

- Monthly KPI targets
- Monthly contact targets
- Contact tier (100/200/custom)
- Daily sending targets
- Agency colors
- Bison workspace mapping

### System Settings

- Slack webhook URL
- Email Bison API keys (per workspace)
- Cole credentials (per state)
- Clay credentials
- Debounce API key
- Redis URL (for workflows)

---

## Security Features

- **Row Level Security (RLS):** Workspace-based data isolation
- **Role-Based Access:** Admin/client/viewer roles
- **Authentication:** Supabase Auth with PKCE
- **API Keys:** Server-side storage
- **Encrypted Credentials:** Secrets table encryption
- **Audit Logging:** Complete operation audit trail

---

## Performance Considerations

- **Caching:** 30-second cache for dashboard data
- **Pagination:** Large dataset pagination
- **Code Splitting:** Vendor chunk separation
- **Lazy Loading:** Route-based loading
- **Optimistic Updates:** UI responsiveness
- **Database Indexes:** Optimized queries

---

## Future Enhancements (Potential)

- Email notifications
- Advanced reporting exports
- Mobile app
- Additional integrations
- Automated bidding optimization
- Multi-language support
- Advanced analytics (predictive)

---

**End of Feature Report**
