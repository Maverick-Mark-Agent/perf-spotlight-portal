# Homeowner Agent Automation - Master Rollout Plan

**Project:** Automate Home Insurance Campaign Management (SOP PT 1-5)
**Current State:** ~5% complete (database schema + import script + dashboard scaffold)
**Target State:** Fully automated monthly Cole pulls, Clay formatting, gap analysis, weekly Bison uploads, and evergreen campaign updates
**Document Version:** 1.0
**Last Updated:** 2025-10-05

---

## Executive Summary

This rollout plan transforms the manual 5-step home insurance campaign workflow into a fully automated system using browser automation (Playwright), workflow orchestration (BullMQ), and robust error handling with observability.

### Current Assets
- ✅ Supabase schema (with conflicts to resolve)
- ✅ ZIP import script (`import-zip-codes.mjs`)
- ✅ Dashboard scaffold (`ZipDashboard.tsx`)
- ✅ Architecture document (`homeowner-agent-architecture.md`)
- ✅ SOP documentation (`home-insurance-campaign-sop.md`)

### Critical Gaps
- ❌ No automation code (agents, connectors, pipeline, orchestrator)
- ❌ Missing dependencies (Playwright, BullMQ, Slack SDK)
- ❌ No scheduling infrastructure (GitHub Actions)
- ❌ No error handling, logging, or observability
- ❌ No secrets management implementation
- ❌ Business logic for PT1-PT5 not implemented

### Success Criteria
- Monthly automation runs on 15th: Cole pulls → Clay formatting → gap analysis
- Weekly automation runs Mondays 9 AM CT: Bison uploads → Evergreen updates
- < 5% error rate; all errors logged with traces and screenshots
- Slack notifications for failures and completions
- Dashboard shows real-time agent run status and metrics

---

## Rollout Structure

**Total Phases:** 20
**Estimated Effort:** 80-120 hours (2-3 weeks full-time)
**Approach:** Sequential phases with clear dependencies
**Validation:** Each phase has Definition of Done with test commands

### 4 Major Milestones

1. **Foundation** (Phases 1-5): Infrastructure, dependencies, core services
2. **Data Pipeline** (Phases 6-10): Connectors, validation, testing
3. **Workflow Automation** (Phases 11-15): PT1-PT5 implementation
4. **Production Readiness** (Phases 16-20): Orchestration, scheduling, observability

---

## Phase Overview & Dependencies

### Milestone 1: Foundation (Phases 1-5)

#### Phase 1: Resolve Schema Conflicts & Run Migrations
- **Effort:** 2-3 hours
- **Dependencies:** None
- **Blocks:** All phases
- **Status:** ⬜ Pending

**Scope:**
- Merge duplicate `client_zipcodes` schemas
- Merge duplicate `monthly_cleaned_leads` schemas
- Run all migrations in correct order
- Verify tables exist and are accessible

**Definition of Done:**
- [ ] Single source of truth for each table schema
- [ ] All migrations applied successfully
- [ ] `client_zipcodes` and `monthly_cleaned_leads` queryable from dashboard
- [ ] No migration conflicts or errors

---

#### Phase 2: Install Dependencies & Configure TypeScript
- **Effort:** 2-3 hours
- **Dependencies:** Phase 1
- **Blocks:** Phases 3-20
- **Status:** ⬜ Pending

**Scope:**
- Install Playwright, BullMQ, Redis, Slack SDK, dotenv, csv-parse
- Configure TypeScript paths for agents/connectors/pipeline
- Generate Supabase types from schema
- Set up ESLint rules for automation code

**Definition of Done:**
- [ ] All packages installed and in `package.json`
- [ ] TypeScript compiles without errors
- [ ] Supabase types generated (`src/types/supabase.ts`)
- [ ] `tsconfig.json` includes path aliases for `@agents`, `@connectors`, `@pipeline`

---

#### Phase 3: Core Browser Automation Infrastructure
- **Effort:** 6-8 hours
- **Dependencies:** Phase 2
- **Blocks:** Phases 6-9, 11-15
- **Status:** ⬜ Pending

**Scope:**
- Create `agents/browser/BrowserController.ts` (launch, context, stealth)
- Create `agents/browser/AuthManager.ts` (login flows, MFA handling)
- Create `agents/browser/ErrorHandler.ts` (screenshots, traces, retries)
- Create `agents/browser/types.ts` (shared interfaces)

**Definition of Done:**
- [ ] BrowserController can launch headless/headed Chromium
- [ ] AuthManager handles basic login flow with username/password
- [ ] ErrorHandler captures screenshots and traces on failure
- [ ] Test script successfully launches browser and navigates to a URL

---

#### Phase 4: Secrets Management & Environment Setup
- **Effort:** 3-4 hours
- **Dependencies:** Phase 2
- **Blocks:** Phases 6-9
- **Status:** ⬜ Pending

**Scope:**
- Create `lib/secrets.ts` (load from env, validate required vars)
- Create `.env.example` with all required variables
- Update `site_credentials` table insert script
- Document secret rotation process

**Definition of Done:**
- [ ] `.env.example` documents all required secrets
- [ ] `lib/secrets.ts` validates and loads secrets on startup
- [ ] Error thrown if required secrets missing
- [ ] `site_credentials` table populated with test credentials

---

#### Phase 5: Error Handling & Logging Framework
- **Effort:** 4-5 hours
- **Dependencies:** Phase 1, 2
- **Blocks:** Phases 6-20
- **Status:** ⬜ Pending

**Scope:**
- Create `lib/logger.ts` (structured JSON logging with levels)
- Create `lib/error-tracker.ts` (writes to `agent_errors` table)
- Create error taxonomy enums (AUTH, CAPTCHA, SELECTOR_MISS, etc.)
- Implement retry logic with exponential backoff

**Definition of Done:**
- [ ] Logger outputs structured JSON to console
- [ ] Errors automatically written to `agent_errors` table
- [ ] Retry logic tested with failing function (3 retries, exponential backoff)
- [ ] Error screenshots saved to file system or cloud storage

---

### Milestone 2: Data Pipeline (Phases 6-10)

#### Phase 6: Cole X Dates Connector
- **Effort:** 8-10 hours
- **Dependencies:** Phase 3, 4, 5
- **Blocks:** Phase 11
- **Status:** ⬜ Pending

**Scope:**
- Create `connectors/cole.ts` with methods:
  - `login(state)` - handles state-specific credentials
  - `createQuery(params)` - builds search with ZIPs, fields, filters
  - `exportResults()` - downloads CSV in <10k chunks
- Handle multi-state logins (different credentials per state)
- Implement <10k chunking logic (split ZIPs if results exceed)
- Parse and validate downloaded CSVs

**Definition of Done:**
- [ ] Can log in to Cole for NJ and TX (test with real credentials)
- [ ] Can create query with 50 ZIPs and 13 required fields
- [ ] Automatically chunks queries >10k results
- [ ] Downloaded CSV parsed into array of lead objects
- [ ] Test run exports 500 test leads successfully

---

#### Phase 7: Clay Connector
- **Effort:** 6-8 hours
- **Dependencies:** Phase 3, 4, 5
- **Blocks:** Phase 12
- **Status:** ⬜ Pending

**Scope:**
- Create `connectors/clay.ts` with methods:
  - `login()` - authenticate to Clay
  - `createWorkbook(client, month)` - navigate to folder, create workbook
  - `importCSV(csvPath, tableName)` - upload CSV to table
  - `addFormulaColumn(formula, columnName)` - create derived columns
  - `runDebounce(emailColumn)` - trigger email validation
  - `exportTable(filters)` - download filtered CSV
- Handle 40k row limit (create new table if exceeding)
- Wait for Debounce enrichment to complete

**Definition of Done:**
- [ ] Can log in to Clay with credentials
- [ ] Can create new workbook in B2C/TestClient folder
- [ ] Can import CSV with 100 rows
- [ ] Can add formula column (Numeric Home Value)
- [ ] Can trigger Debounce and wait for completion
- [ ] Can export filtered results

---

#### Phase 8: Email Bison Connector
- **Effort:** 6-8 hours
- **Dependencies:** Phase 3, 4, 5
- **Blocks:** Phase 14, 15
- **Status:** ⬜ Pending

**Scope:**
- Create `connectors/bison.ts` with methods:
  - `login(workspace)` - authenticate to client workspace
  - `importContacts(csv, listName, fieldMapping)` - upload contacts
  - `findCampaign(titlePattern)` - search for Evergreen campaign
  - `addContactsToCampaign(campaignId, listName)` - add contacts
  - `renameCampaign(campaignId, newTitle)` - update campaign title
- Handle field mapping (First Name, Email, Renewal Date, etc.)
- Verify upload success (check contact count)

**Definition of Done:**
- [ ] Can log in to Email Bison workspace
- [ ] Can import 100 contacts with correct field mapping
- [ ] Can find campaign by title pattern (e.g., "Evergreen, Last Upload: *")
- [ ] Can add contacts to campaign
- [ ] Can rename campaign title
- [ ] Upload verification confirms correct contact count

---

#### Phase 9: Lead Pipeline (Validation, Normalization, Deduplication)
- **Effort:** 6-8 hours
- **Dependencies:** Phase 1, 5
- **Blocks:** Phase 11, 12
- **Status:** ⬜ Pending

**Scope:**
- Create `pipeline/normalizer.ts` - standardize fields (trim, titlecase, zip padding)
- Create `pipeline/validator.ts` - validate email, phone, zip, dates
- Create `pipeline/deduplicator.ts` - generate dedupe keys, detect duplicates
- Create `pipeline/transformer.ts` - derived fields (readable date, purchase day, renewal date)
- Write to `raw_leads` and `cleaned_leads` tables

**Definition of Done:**
- [ ] Normalizer converts "JOHN" → "John", "7034" → "07034"
- [ ] Validator rejects invalid emails, phones, dates
- [ ] Deduplicator generates SHA256 hash of email+address
- [ ] Transformer calculates purchase_day, renewal_date, readable_purchase_date
- [ ] 100 raw leads processed → cleaned leads inserted
- [ ] Duplicates detected and flagged

---

#### Phase 10: Testing Framework & Fixtures
- **Effort:** 4-5 hours
- **Dependencies:** Phase 6, 7, 8, 9
- **Blocks:** None (enables validation for all phases)
- **Status:** ⬜ Pending

**Scope:**
- Create `tests/fixtures/` - sample CSVs, lead data, credentials
- Create `tests/connectors/` - unit tests for Cole, Clay, Bison
- Create `tests/pipeline/` - unit tests for validation, normalization
- Set up Playwright Test for browser automation tests
- Document test commands in README

**Definition of Done:**
- [ ] `npm run test:connectors` runs and passes
- [ ] `npm run test:pipeline` runs and passes
- [ ] Fixture CSV with 50 realistic leads exists
- [ ] Mock credentials work for local testing
- [ ] All tests pass in CI (if GitHub Actions set up)

---

### Milestone 3: Workflow Automation (Phases 11-15)

#### Phase 11: PT1 - Cole Monthly Pulls
- **Effort:** 6-8 hours
- **Dependencies:** Phase 6, 9
- **Blocks:** Phase 12, 16
- **Status:** ⬜ Pending

**Scope:**
- Create `workflows/pt1-cole-pulls.ts`:
  - Load client config (ZIPs, states, filters, package tier)
  - Login to Cole (handle multi-state)
  - Split ZIPs into <10k chunks
  - Export CSVs for each chunk
  - Save to `raw_leads` table
  - Insert ZIPs into `client_zipcodes`
- Create Slack notification on completion
- Handle errors (auth, captcha, network)

**Definition of Done:**
- [ ] For test client, pulls all ZIPs for next month
- [ ] Automatically chunks if >10k results
- [ ] CSVs downloaded and parsed
- [ ] `raw_leads` table populated
- [ ] `client_zipcodes` table updated
- [ ] Slack message posted: "✅ Raw Pull Complete | Client: X | Records: Y"

---

#### Phase 12: PT2 - Clay Formatting & Enrichment
- **Effort:** 6-8 hours
- **Dependencies:** Phase 7, 9, 11
- **Blocks:** Phase 13, 16
- **Status:** ⬜ Pending

**Scope:**
- Create `workflows/pt2-clay-format.ts`:
  - Create Clay workbook for client/month
  - Import raw CSVs (handle 40k limit)
  - Add derived columns (Numeric Home Value, Readable Purchase Date, Purchase Day)
  - Apply filters (Head of Household, Home Value ≤ $900k)
  - Run Debounce email validation
  - Filter to safe-to-send emails only
  - Export cleaned CSVs
  - Save to `cleaned_leads` table
- Update `monthly_cleaned_leads` with count

**Definition of Done:**
- [ ] For test client, imports raw leads into Clay
- [ ] Derived columns created correctly
- [ ] Debounce validation completes (waits for enrichment)
- [ ] Filtered results exported
- [ ] `cleaned_leads` table populated
- [ ] `monthly_cleaned_leads` updated with count
- [ ] Slack message: "✅ Data Refinement Complete | Client: X | Refined: Y"

---

#### Phase 13: PT3 - Totals Review & Gap Analysis
- **Effort:** 5-6 hours
- **Dependencies:** Phase 12
- **Blocks:** Phase 16
- **Status:** ⬜ Pending

**Scope:**
- Create `workflows/pt3-gap-analysis.ts`:
  - Query `monthly_cleaned_leads` for client/month
  - Compare to target (15k for 100-tier, 30k for 200-tier)
  - Calculate gap
  - If below target: suggest ZIP expansion, filter relaxation
  - Generate Slack report with recommendations
- Create `lib/gap-solver.ts` - logic for ZIP reallocation, radius expansion

**Definition of Done:**
- [ ] For test client with 12k cleaned (target 15k), calculates 3k gap
- [ ] Suggests adjacent ZIPs or filter changes
- [ ] Slack message includes gap size, suggestions, affected ZIPs
- [ ] If over target, flags for upsell opportunity

---

#### Phase 14: PT4 - Weekly Bison Uploads
- **Effort:** 6-8 hours
- **Dependencies:** Phase 8, 9, 12
- **Blocks:** Phase 15, 17
- **Status:** ⬜ Pending

**Scope:**
- Create `workflows/pt4-bison-uploads.ts`:
  - Calculate 4 renewal windows for next month (M+28 to M+34 logic)
  - For each window, query `cleaned_leads` by purchase_day range
  - Export CSV from Clay (or directly from DB)
  - Upload to Email Bison Contacts with field mapping
  - Name list: "(Month Day-Day renewals)"
  - Insert into `client_lead_batches` table
- Handle last batch extending to month-end

**Definition of Done:**
- [ ] For test client, calculates correct 4 windows (e.g., Feb 1-7, 8-14, 15-21, 22-29)
- [ ] Uploads 4 separate contact lists to Bison
- [ ] Field mapping correct (First Name, Email, Renewal Date, etc.)
- [ ] `client_lead_batches` table updated with counts
- [ ] Slack message: "✅ Refined Data Uploaded | Week 1: X-Y | ... | Total: Z"

---

#### Phase 15: PT5 - Evergreen Campaign Updates
- **Effort:** 5-6 hours
- **Dependencies:** Phase 8, 14
- **Blocks:** Phase 17
- **Status:** ⬜ Pending

**Scope:**
- Create `workflows/pt5-evergreen-update.ts`:
  - Find Evergreen campaign by title pattern
  - Determine next window from current title
  - Add matching contact list to campaign
  - Rename campaign with new window dates
  - Slack notification on completion
- Handle edge cases (campaign not found, title mismatch)

**Definition of Done:**
- [ ] For test client, finds correct Evergreen campaign
- [ ] Adds contacts from correct renewal window
- [ ] Renames campaign title (e.g., "Evergreen, Last Upload: Feb 8-14")
- [ ] Contact count verified in campaign
- [ ] Slack message: "Evergreen uploads completed | Client: X | Window: Y-Z | Count: N"

---

### Milestone 4: Production Readiness (Phases 16-20)

#### Phase 16: Orchestrator & Job Scheduling (BullMQ)
- **Effort:** 8-10 hours
- **Dependencies:** Phase 11, 12, 13
- **Blocks:** Phase 17
- **Status:** ⬜ Pending

**Scope:**
- Create `orchestrator/queue.ts` - BullMQ setup, Redis connection
- Create `orchestrator/jobs/` - job definitions for PT1-PT5
- Create `orchestrator/scheduler.ts` - cron logic (monthly 15th, weekly Monday)
- Create `orchestrator/worker.ts` - job processing, retries, error handling
- Persist `agent_runs` for each workflow execution
- Handle job failures, retries with exponential backoff

**Definition of Done:**
- [ ] BullMQ connected to Redis
- [ ] Jobs can be enqueued programmatically
- [ ] Worker processes jobs and updates `agent_runs` table
- [ ] Failed jobs retry 3 times with backoff
- [ ] Dashboard can query `agent_runs` to show job history

---

#### Phase 17: GitHub Actions Workflows (Monthly & Weekly Cron)
- **Effort:** 4-5 hours
- **Dependencies:** Phase 16
- **Blocks:** None
- **Status:** ⬜ Pending

**Scope:**
- Create `.github/workflows/agent-monthly.yml` - runs 15th at 9 AM CT (PT1-PT3)
- Create `.github/workflows/agent-weekly.yml` - runs Mondays at 9 AM CT (PT4-PT5)
- Configure secrets in GitHub (Supabase, Cole, Clay, Bison, Slack)
- Test with manual workflow trigger
- Document how to view logs and traces in GitHub Actions

**Definition of Done:**
- [ ] Monthly workflow triggers on 15th
- [ ] Weekly workflow triggers Mondays at 9 AM CT
- [ ] Secrets configured and accessible in workflows
- [ ] Manual trigger test runs successfully
- [ ] Logs and artifacts accessible from Actions tab

---

#### Phase 18: Observability (Logging, Traces, Screenshots)
- **Effort:** 5-6 hours
- **Dependencies:** Phase 5, 16
- **Blocks:** None
- **Status:** ⬜ Pending

**Scope:**
- Enhance `lib/logger.ts` with step-level tracing (trace IDs)
- Configure Playwright to save traces on failure
- Upload screenshots/traces to cloud storage (S3 or Supabase Storage)
- Store trace URLs in `agent_runs.trace_url` and `agent_errors.trace_url`
- Create dashboard route to view traces and screenshots

**Definition of Done:**
- [ ] All workflows log structured JSON with trace IDs
- [ ] Playwright traces saved to storage on failure
- [ ] `agent_runs` table includes trace URLs
- [ ] Dashboard shows clickable links to traces/screenshots
- [ ] Local test failure generates and saves trace file

---

#### Phase 19: Slack Notifications & Alerts
- **Effort:** 4-5 hours
- **Dependencies:** Phase 5
- **Blocks:** None
- **Status:** ⬜ Pending

**Scope:**
- Create `lib/slack.ts` - webhook client, message formatting
- Implement alert templates:
  - Workflow start/completion
  - Errors with deep links to traces
  - Gap analysis reports
  - Approval requests (if needed)
- Configure Slack webhook URL in secrets
- Test notifications in development channel

**Definition of Done:**
- [ ] Slack webhook configured and tested
- [ ] Completion messages posted for PT1-PT5
- [ ] Error alerts include trace URLs and error details
- [ ] Gap analysis reports formatted with suggestions
- [ ] All messages use consistent emoji/formatting

---

#### Phase 20: Dashboard Enhancements & Documentation
- **Effort:** 6-8 hours
- **Dependencies:** Phase 18, 19
- **Blocks:** None
- **Status:** ⬜ Pending

**Scope:**
- Create `/rollout-progress` route - shows phase completion status
- Enhance `/zip-dashboard` - add agent run history, error counts
- Create `docs/runbook.md` - environment setup, deployment, troubleshooting
- Create `docs/local-development.md` - how to run agents locally
- Update README with architecture overview and links
- Add validation scripts (`npm run validate:all`)

**Definition of Done:**
- [ ] `/rollout-progress` shows all 20 phases with status checkboxes
- [ ] `/zip-dashboard` includes recent agent runs and errors
- [ ] Runbook documents all required env vars and setup steps
- [ ] Local development guide tested with fresh clone
- [ ] README updated with project overview
- [ ] `npm run validate:all` checks schema, types, tests

---

## Dependency Graph (Critical Path)

```
Phase 1 (Schema)
  ├─→ Phase 2 (Dependencies)
  │     ├─→ Phase 3 (Browser) ──→ Phase 6 (Cole) ──→ Phase 11 (PT1)
  │     ├─→ Phase 4 (Secrets) ───→ Phase 6, 7, 8
  │     ├─→ Phase 5 (Errors) ────→ All phases
  │     ├─→ Phase 7 (Clay) ──────→ Phase 12 (PT2)
  │     ├─→ Phase 8 (Bison) ─────→ Phase 14, 15 (PT4, PT5)
  │     └─→ Phase 9 (Pipeline) ──→ Phase 11, 12
  │
  ├─→ Phase 11 (PT1) ──→ Phase 12 (PT2) ──→ Phase 13 (PT3)
  │
  └─→ Phase 16 (Orchestrator) ──→ Phase 17 (GitHub Actions)

Phase 10 (Testing) - enables validation for all phases
Phase 18 (Observability) - enhances all workflows
Phase 19 (Slack) - enhances all workflows
Phase 20 (Dashboard & Docs) - final polish
```

**Critical Path:** 1 → 2 → 3 → 6 → 11 → 12 → 13 → 16 → 17 (longest sequence)

---

## Progress Tracker

### Milestone 1: Foundation
- [ ] Phase 1: Resolve Schema Conflicts & Run Migrations
- [ ] Phase 2: Install Dependencies & Configure TypeScript
- [ ] Phase 3: Core Browser Automation Infrastructure
- [ ] Phase 4: Secrets Management & Environment Setup
- [ ] Phase 5: Error Handling & Logging Framework

### Milestone 2: Data Pipeline
- [ ] Phase 6: Cole X Dates Connector
- [ ] Phase 7: Clay Connector
- [ ] Phase 8: Email Bison Connector
- [ ] Phase 9: Lead Pipeline (Validation, Normalization, Deduplication)
- [ ] Phase 10: Testing Framework & Fixtures

### Milestone 3: Workflow Automation
- [ ] Phase 11: PT1 - Cole Monthly Pulls
- [ ] Phase 12: PT2 - Clay Formatting & Enrichment
- [ ] Phase 13: PT3 - Totals Review & Gap Analysis
- [ ] Phase 14: PT4 - Weekly Bison Uploads
- [ ] Phase 15: PT5 - Evergreen Campaign Updates

### Milestone 4: Production Readiness
- [ ] Phase 16: Orchestrator & Job Scheduling (BullMQ)
- [ ] Phase 17: GitHub Actions Workflows (Monthly & Weekly Cron)
- [ ] Phase 18: Observability (Logging, Traces, Screenshots)
- [ ] Phase 19: Slack Notifications & Alerts
- [ ] Phase 20: Dashboard Enhancements & Documentation

**Overall Completion:** 0/20 phases (0%)

---

## Risk Register

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Cole X Dates UI changes break scraper | High | Medium | Use resilient selectors, fallback strategies, alert on failure |
| Clay Debounce enrichment times out | Medium | Medium | Implement polling with timeout, fallback to partial results |
| Email Bison session expires mid-upload | Medium | Low | Refresh session before operations, retry with re-login |
| >10k results in single ZIP code | Medium | Medium | Implement <10k chunking by date range or other filters |
| Captcha blocks automation | High | Low | Use stealth mode, rotate IPs/user agents, manual escalation |
| Credentials rotated/expired | High | Low | Test credentials weekly, alert on auth failures, rotation runbook |
| GitHub Actions secrets leak | High | Low | Use environment secrets (not repo), audit access, rotate regularly |
| Redis/BullMQ downtime | Medium | Low | Health checks, retry logic, fallback to manual trigger |
| Duplicate leads uploaded to Bison | Medium | Medium | Enforce dedupe_key uniqueness, check before upload |
| Gap analysis suggests invalid ZIPs | Low | Medium | Validate ZIP against approved list, require approval for new ZIPs |

---

## Timeline Estimate

| Milestone | Phases | Estimated Effort | Dependencies |
|-----------|--------|------------------|--------------|
| 1. Foundation | 1-5 | 17-23 hours | None |
| 2. Data Pipeline | 6-10 | 30-39 hours | Milestone 1 |
| 3. Workflow Automation | 11-15 | 28-36 hours | Milestones 1, 2 |
| 4. Production Readiness | 16-20 | 27-34 hours | Milestones 1, 2, 3 |
| **Total** | **20 phases** | **102-132 hours** | **Sequential** |

**Assuming 40 hours/week:** 2.5-3.5 weeks full-time
**Assuming 20 hours/week:** 5-7 weeks part-time
**Assuming 10 hours/week:** 10-13 weeks minimal time

---

## Next Steps

1. **Review this master plan** - confirm approach, effort estimates, phase breakdown
2. **Generate individual phase files** (01-20) - detailed tasks, acceptance criteria, commands
3. **Start Phase 1** - resolve schema conflicts, run migrations
4. **Work sequentially** - each phase builds on previous
5. **Update progress tracker** - check off phases as completed

---

## Validation Commands (Post-Completion)

```bash
# Validate all migrations applied
npm run validate:migrations

# Run all tests
npm run test:all

# Check type safety
npm run typecheck

# Lint automation code
npm run lint:agents

# Test Cole connector (dry run)
npm run test:cole-dry-run

# Test Clay connector (dry run)
npm run test:clay-dry-run

# Test Bison connector (dry run)
npm run test:bison-dry-run

# Run PT1-PT3 (monthly workflow) in dry-run mode
npm run workflow:monthly:dry-run

# Run PT4-PT5 (weekly workflow) in dry-run mode
npm run workflow:weekly:dry-run

# Validate GitHub Actions workflows
npm run validate:github-actions

# Check all secrets configured
npm run validate:secrets
```

---

## Support & Escalation

| Issue Type | Action | Contact |
|------------|--------|---------|
| Schema/migration failures | Review phase 1, check Supabase logs | Head of Fulfillment |
| Cole login failures | Verify credentials in Airtable, check state mapping | Head of Fulfillment |
| Clay API errors | Check Clay docs, verify API key | Head of Fulfillment |
| Bison upload failures | Verify field mapping, check contact limits | Head of Fulfillment |
| GitHub Actions failures | Check secrets, review workflow logs | DevOps/Head of Fulfillment |
| Agent run errors | Check `agent_errors` table, review traces | Development team |

---

**Document Owner:** Development Team
**Approvers:** Head of Fulfillment for B2C, Campaign Manager B2C
**Review Cadence:** Weekly during rollout, monthly post-launch
