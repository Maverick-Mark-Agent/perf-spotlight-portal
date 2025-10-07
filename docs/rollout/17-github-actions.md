# Phase 17: GitHub Actions Workflows (Monthly & Weekly Cron)

**Milestone:** Production Readiness
**Estimated Effort:** 4-5 hours
**Dependencies:** Phase 16 (Orchestrator)
**Blocks:** None

---

## Overview

Create GitHub Actions workflows for monthly (15th at 9 AM CT: PT1-PT3) and weekly (Mondays 9 AM CT: PT4-PT5) automation. Configure secrets, test with manual triggers.

---

## Tasks

### Task 1: Create Monthly Workflow

**File to create:** `.github/workflows/agent-monthly.yml`

**Content:**
```yaml
name: Monthly Agent (PT1-PT3)

on:
  schedule:
    # 15th of month at 9:00 AM CT (14:00 UTC in CDT, 15:00 UTC in CST)
    - cron: '0 15 15 * *'
  workflow_dispatch:  # Manual trigger

jobs:
  monthly-workflow:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Run monthly workflows (PT1-PT3)
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          REDIS_URL: ${{ secrets.REDIS_URL }}
          COLE_NJ_USERNAME: ${{ secrets.COLE_NJ_USERNAME }}
          COLE_NJ_PASSWORD: ${{ secrets.COLE_NJ_PASSWORD }}
          CLAY_EMAIL: ${{ secrets.CLAY_EMAIL }}
          CLAY_PASSWORD: ${{ secrets.CLAY_PASSWORD }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          HEADLESS: true
        run: npm run workflow:monthly

      - name: Upload artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: error-artifacts
          path: artifacts/
```

**Acceptance:**
- [ ] Monthly workflow created
- [ ] Cron schedule correct (15th at 9 AM CT)
- [ ] Manual trigger works
- [ ] Secrets configured

---

### Task 2: Create Weekly Workflow

**File to create:** `.github/workflows/agent-weekly.yml`

**Content:**
```yaml
name: Weekly Agent (PT4-PT5)

on:
  schedule:
    # Mondays at 9:00 AM CT (14:00 UTC in CDT, 15:00 UTC in CST)
    - cron: '0 14 * * 1'
  workflow_dispatch:

jobs:
  weekly-workflow:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install chromium --with-deps

      - name: Run weekly workflows (PT4-PT5)
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          REDIS_URL: ${{ secrets.REDIS_URL }}
          BISON_EMAIL: ${{ secrets.BISON_EMAIL }}
          BISON_PASSWORD: ${{ secrets.BISON_PASSWORD }}
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
          HEADLESS: true
        run: npm run workflow:weekly
```

**Acceptance:**
- [ ] Weekly workflow created
- [ ] Cron schedule correct (Mondays 9 AM CT)
- [ ] Manual trigger works

---

## Definition of Done

- [ ] Monthly workflow runs on 15th
- [ ] Weekly workflow runs Mondays
- [ ] Secrets configured in GitHub
- [ ] Manual triggers tested
- [ ] Artifacts uploaded on failure

---

## Next Phase

**Phase 18:** Observability (Logging, Traces, Screenshots)
