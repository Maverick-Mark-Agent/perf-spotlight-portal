# Homeowner Agent Architecture (SOP PT 1–5 Automation)

## Objective
Automate SOP PT 1–5: Cole X Dates → Clay → Email Bison, with scheduling, reliability, security, and observability.

## Read First
- docs/home-insurance-campaign-sop.md
- src/pages/ZipDashboard.tsx (dashboard scaffold)
- supabase/migrations (create if missing): client_zipcodes, monthly_cleaned_leads

## Scope
- Monthly (15th): PT1 (Cole pulls, <10k chunks), PT2 (Clay transforms), PT3 (totals and gap fills)
- Weekly (Mondays 9:00 AM CT): PT4 (upload 4 renewal windows to Bison), PT5 (evergreen campaign updates)

## Tech
- Node.js + TypeScript
- Playwright (Chromium) with stealth, tracing, screenshots
- Orchestration: BullMQ (Redis) or Temporal (workflows)
- Scheduler: GitHub Actions cron or Cloud Scheduler
- Storage: Supabase
- Notifications: Slack webhook (failures, approvals)

## Data Model (Supabase)
- agent_runs(run_id, workflow, client_id, site, status, started_at, finished_at, metrics, trace_url, error)
- lead_sources(id, client_id, site, params(jsonb), schedule_cron, active)
- raw_leads(id, lead_source_id, scraped_at, payload_json, hash, source_url)
- cleaned_leads(id, raw_lead_id, normalized fields…, dedupe_key, validation_status, errors)
- client_lead_batches(id, client_id, week_window_start, week_window_end, count_raw, count_cleaned, count_uploaded, upload_target)
- client_zipcodes(id, client_name, workspace_name, month, zip, pulled_at)
- monthly_cleaned_leads(id, client_name, workspace_name, month, cleaned_count)
- site_credentials(site, username, secret_ref, mfa_type, last_verified_at)
- agent_errors(id, run_id, step, error_type, message, screenshot_url, trace_url)

## Modules
- agents/browser/core: BrowserController, AuthManager, CaptchaSolver
- connectors/{cole,clay,bison}.ts implements:
  - login(), navigateToData(params), exportOrScrape(params): Promise<Array<Record<string, any>>>, logout?()
- pipeline: normalize/map Cole→Clay→Bison fields; validate email/zip/phone; dedupe; target counts
- uploader: write to Supabase; and upload to Bison via UI/API
- orchestrator: schedule jobs, retries/backoff, persist agent_runs
- alerts: Slack (failures, human approvals with deep links)

## SOP Mapping
- PT1 Cole (Monthly 15th): state login, split ZIP batches (<10k), select 13 fields, optional extra filters, export CSVs, upload to Clay. Edge: UI changes, >10k results, schema drift.
- PT2 Clay: month folder/workbook, import CSVs, derived columns (numeric home value, readable date, purchase day), Debounce email validation, filters to safe-to-send, split tables at ~40k. Edge: enrichment delays, column mismatch.
- PT3 Totals & Gap: compute targets by package tier, compare; propose ZIP reallocation, radius expansion, filter relaxation; log changes.
- PT4 Weekly Bison Uploads: compute 4 windows (M+28 to M+34; last batch to month end), export from Clay by week, Contacts import in Bison with field mapping, record batches.
- PT5 Evergreen Update: open correct campaign (title pattern), add matching window contacts, rename campaign title, Slack completion.

## Scheduling
- Cron: 15th monthly (PT1–PT3), Mon 09:00 CT weekly (PT4–PT5)
- Retries: exponential backoff per step; idempotent via hashes/dedupe keys

## Error Taxonomy
- AUTH/MFA: pause, alert, resume on approval
- CAPTCHA/429: solver + throttle; rotate proxy; escalate if repeated
- SELECTOR_MISS: DOM snapshot, screenshot, fallback selectors; alert
- NETWORK/TIMEOUT: jittered retry; resume from checkpoint
- DATA_VALIDATION: quarantine invalid; continue valid subset; report diff
- UPLOAD_FAILURE: re-chunk, remap; park batch if persistent

## Security
- Secrets via env manager (no plaintext); least-privileged service accounts
- PII-safe logging; encrypt artifacts; audit via agent_runs

## Observability
- Structured JSON logs with step IDs; Playwright trace/screenshots on failure
- Slack alerts (failures/approvals); daily summary of runs/records uploaded

## Deliverables (First Pass)
- agents/browser/, connectors/{cole,clay,bison}.ts, orchestrator/, pipeline/, uploader/, alerts/
- supabase migrations for the tables above
- scripts/import-zip-codes.mjs (ingest client ZIP CSV → client_zipcodes)
- .github/workflows/agent-schedule.yml (monthly/weekly)
- README/runbook (envs, local run, deploy)

## Build Order + Acceptance Criteria

1) Dashboard foundation and data seed
- Create migrations for `client_zipcodes` and `monthly_cleaned_leads`.
- Import November ZIP CSV into `client_zipcodes`.
- Acceptance: `/zip-dashboard` renders per-client ZIP counts for the selected month (e.g., 2025-11). If `monthly_cleaned_leads` is empty, cleaned counts show 0 without errors.

2) Agent scaffolding
- Create agents/browser core, connectors stubs, orchestrator, logging/error framework, and alerts plumbing.
- Acceptance: `npm run agent:dry-run` executes a no-op workflow and writes an `agent_runs` row.

3) Implement PT4/PT5 (Bison uploads + Evergreen update)
- Use existing cleaned CSVs (manually exported from Clay initially) to import 4 renewal windows and update Evergreen campaigns.
- Acceptance: For one canary client, weekly run adds correct window contacts and renames campaign title; Slack completion message is posted.

4) Implement PT1/PT2 (Cole/Clay automation)
- Automate Cole exports (<10k chunks), Clay imports, derived columns, Debounce validation, and filters.
- Acceptance: For one canary client, monthly run pulls all ZIPs, loads into Clay, completes Debounce, and outputs counts meeting the package target thresholds.

5) PT3 Totals/Gap fill + reporting
- Compute monthly totals vs targets; propose redistribution/expansion options; Slack summary.
- Acceptance: Summary posted; if below target, suggestions include counts deltas and affected ZIPs.


