# Phase 20: Dashboard Enhancements & Documentation

**Milestone:** Production Readiness
**Estimated Effort:** 6-8 hours
**Dependencies:** Phase 18, 19 (Observability, Slack)
**Blocks:** None

---

## Overview

Final phase: enhance dashboards with agent run history and error counts, create comprehensive runbook and local development guide, update README, add validation scripts.

---

## Tasks

### Task 1: Enhance ZipDashboard with Agent Metrics

**File to modify:** `src/pages/ZipDashboard.tsx`

**Actions:**
Add section showing recent agent runs:
```typescript
const [recentRuns, setRecentRuns] = useState<any[]>([]);

useEffect(() => {
  async function loadRuns() {
    const { data } = await supabase
      .from('agent_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(10);

    setRecentRuns(data || []);
  }
  loadRuns();
}, []);

// Add to JSX:
<div className="mt-6">
  <h2 className="text-lg font-semibold mb-2">Recent Agent Runs</h2>
  {recentRuns.map(run => (
    <div key={run.run_id} className="border p-2 mb-2">
      <span className="font-medium">{run.workflow}</span> - {run.status}
    </div>
  ))}
</div>
```

**Acceptance:**
- [ ] ZipDashboard shows recent runs
- [ ] Error counts visible

---

### Task 2: Create Runbook

**File to create:** `docs/runbook.md`

**Content:**
```markdown
# Homeowner Agent Automation - Runbook

## Environment Setup

### Required Environment Variables

See `.env.example` for complete list. Critical variables:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
- `REDIS_URL`
- `COLE_{STATE}_USERNAME`, `COLE_{STATE}_PASSWORD`
- `CLAY_EMAIL`, `CLAY_PASSWORD`
- `BISON_EMAIL`, `BISON_PASSWORD`
- `SLACK_WEBHOOK_URL`

### Installation

```bash
npm install
npx playwright install chromium --with-deps
```

### Database Setup

```bash
npm run validate:migrations
npm run seed:credentials
```

## Running Workflows

### Manual Execution

```bash
# Monthly workflow (PT1-PT3)
npm run workflow:monthly

# Weekly workflow (PT4-PT5)
npm run workflow:weekly
```

### Scheduled Execution

Automated via GitHub Actions:
- Monthly: 15th at 9 AM CT
- Weekly: Mondays at 9 AM CT

## Monitoring

### Agent Run History

View at `/rollout-progress` and `/agent-run-history` in dashboard.

### Error Tracking

All errors logged to `agent_errors` table with screenshots/traces.

### Slack Notifications

- Workflow start/completion
- Errors with trace links
- Gap analysis reports

## Troubleshooting

### Cole Login Fails
1. Verify credentials in `.env`
2. Check for MFA requirements
3. Review screenshot in `artifacts/screenshots/`

### Clay Enrichment Timeout
1. Check Debounce credit balance
2. Increase timeout in connector
3. Monitor enrichment status in Clay UI

### Bison Upload Errors
1. Verify field mapping
2. Check contact count limits
3. Review Bison workspace settings

### Job Queue Issues
1. Check Redis connection: `redis-cli ping`
2. View queue status: `npm run queue:status`
3. Clear failed jobs: `npm run queue:clean`

## Maintenance

### Credential Rotation

See `docs/runbooks/credential-rotation.md` for detailed steps.

Rotate every 90 days (production), 180 days (dev).

### Database Backups

Supabase automatic daily backups enabled. Manual backup:
```bash
pg_dump $DATABASE_URL > backup.sql
```

### Log Rotation

Logs stored in Supabase `agent_runs` table. Archive after 90 days:
```sql
DELETE FROM agent_runs WHERE started_at < NOW() - INTERVAL '90 days';
```
```

**Acceptance:**
- [ ] Runbook created with all sections
- [ ] Environment setup documented
- [ ] Troubleshooting guide included

---

### Task 3: Create Local Development Guide

**File to create:** `docs/local-development.md`

**Content:**
```markdown
# Local Development Guide

## Prerequisites

- Node.js 18+
- Redis (Docker: `docker run -d -p 6379:6379 redis:alpine`)
- Supabase account

## Setup

1. Clone repository
2. Install dependencies: `npm install`
3. Install Playwright: `npx playwright install chromium --with-deps`
4. Copy `.env.example` to `.env` and fill in credentials
5. Run migrations: `npx supabase db push`
6. Seed credentials: `npm run seed:credentials`

## Running Locally

### Start Development Server
```bash
npm run dev  # Frontend
```

### Run Workflows
```bash
# Individual workflows
npm run workflow:pt1
npm run workflow:pt2

# Full pipeline
npm run workflow:monthly
```

### Run Tests
```bash
npm run test:connectors
npm run test:pipeline
```

### Debug Mode
```bash
HEADLESS=false SLOW_MO=1000 npm run workflow:pt1
```

## Folder Structure

```
src/
  agents/browser/       - Browser automation core
  connectors/           - Cole, Clay, Bison connectors
  pipeline/             - Validation, normalization, deduplication
  workflows/            - PT1-PT5 implementations
  orchestrator/         - BullMQ job queue
  lib/                  - Logger, errors, secrets, utilities
docs/
  rollout/              - Phase implementation guides
  runbooks/             - Operational procedures
```
```

**Acceptance:**
- [ ] Local dev guide created
- [ ] Setup steps clear
- [ ] Folder structure documented

---

### Task 4: Update README

**File to modify:** `README.md`

**Actions:**
Add automation section:
```markdown
## Homeowner Agent Automation

This project automates home insurance campaign management (SOP PT 1-5):
- **PT1 (Monthly):** Cole X Dates data pulls
- **PT2 (Monthly):** Clay formatting & enrichment
- **PT3 (Monthly):** Gap analysis & reporting
- **PT4 (Weekly):** Email Bison contact uploads
- **PT5 (Weekly):** Evergreen campaign updates

### Quick Start

See [docs/local-development.md](docs/local-development.md) for setup.

### Documentation

- [Master Rollout Plan](docs/rollout/00-rollout-master.md)
- [Runbook](docs/runbook.md)
- [Architecture](docs/homeowner-agent-architecture.md)

### Dashboards

- `/zip-dashboard` - ZIP codes and cleaned lead counts
- `/rollout-progress` - Implementation phase tracker
- `/agent-run-history` - Workflow execution logs
```

**Acceptance:**
- [ ] README updated
- [ ] Links to documentation
- [ ] Architecture overview

---

### Task 5: Create Validation Scripts

**File to create:** `scripts/validate-all.ts`

**Content:**
```typescript
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runValidation(name: string, command: string): Promise<void> {
  console.log(`\\n🔍 ${name}...`);

  try {
    const { stdout, stderr } = await execAsync(command);
    console.log(`✅ ${name} passed`);
    if (stdout) console.log(stdout);
  } catch (error: any) {
    console.error(`❌ ${name} failed`);
    console.error(error.stderr || error.message);
    throw error;
  }
}

async function validateAll() {
  console.log('🚀 Running all validations...\\n');

  await runValidation('TypeScript compilation', 'npm run validate:types');
  await runValidation('Database migrations', 'npm run validate:migrations');
  await runValidation('Secrets configuration', 'npm run validate:secrets');
  await runValidation('ESLint', 'npm run lint');

  console.log('\\n✅ All validations passed!\\n');
}

validateAll().catch(() => {
  console.error('\\n❌ Validation failed\\n');
  process.exit(1);
});
```

**Acceptance:**
- [ ] Validation script created
- [ ] Runs all checks
- [ ] Exits with error on failure

---

## Definition of Done

- [ ] ZipDashboard enhanced with agent metrics
- [ ] Runbook created and comprehensive
- [ ] Local development guide complete
- [ ] README updated with automation overview
- [ ] Validation script runs all checks
- [ ] All documentation links working
- [ ] `/rollout-progress` shows 20/20 phases complete

---

## 🎉 Project Complete!

All 20 phases implemented. The homeowner agent automation system is production-ready.

### Next Steps Post-Rollout

1. Run Phase 1 - resolve schema conflicts
2. Work through phases 2-5 (Foundation)
3. Test connectors (Phases 6-8)
4. Implement workflows (Phases 11-15)
5. Deploy to production (Phases 16-17)
6. Monitor and iterate (Phases 18-20)
