# Phase 13: PT3 - Totals Review & Gap Analysis

**Milestone:** Workflow Automation
**Estimated Effort:** 5-6 hours
**Dependencies:** Phase 12 (PT2)
**Blocks:** Phase 16

---

## Overview

Implement PT3 workflow: compare cleaned lead counts to targets (15k for 100-tier, 30k for 200-tier), calculate gaps, suggest ZIP expansions or filter adjustments, post Slack report.

---

## Tasks

### Task 1: Create PT3 Workflow

**File to create:** `src/workflows/pt3-gap-analysis.ts`

**Content:**
```typescript
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@lib/logger';

export interface PT3Config {
  clientId: number;
  clientName: string;
  workspace: string;
  month: string;
  targetCount: number;  // 15000 or 30000
}

export async function executePT3(config: PT3Config): Promise<void> {
  logger.info('Starting PT3 - Gap Analysis', { client: config.clientName });

  const { data } = await supabase
    .from('monthly_cleaned_leads')
    .select('cleaned_count')
    .eq('workspace_name', config.workspace)
    .eq('month', config.month)
    .single();

  const cleanedCount = data?.cleaned_count || 0;
  const gap = config.targetCount - cleanedCount;

  logger.info('Gap analysis complete', { cleanedCount, targetCount: config.targetCount, gap });

  if (gap > 0) {
    logger.warn('Below target', { gap });
    const suggestions = await generateSuggestions(config, gap);
    await postGapReport({ ...config, cleanedCount, gap, suggestions });
  } else {
    logger.info('Target met or exceeded', { excess: -gap });
    await postSuccessReport({ ...config, cleanedCount });
  }
}

async function generateSuggestions(config: PT3Config, gap: number): Promise<string[]> {
  return [
    `Expand ZIP radius (add ${Math.ceil(gap / 1000)} adjacent ZIPs)`,
    'Relax home value filter to $1M',
    'Include secondary states if licensed',
  ];
}

async function postGapReport(data: any): Promise<void> {
  logger.info('Gap report (placeholder)', data);
}

async function postSuccessReport(data: any): Promise<void> {
  logger.info('Success report (placeholder)', data);
}
```

**Acceptance:**
- [ ] PT3 workflow complete
- [ ] Calculates gap
- [ ] Generates suggestions
- [ ] Posts Slack report

---

## Next Phase

**Phase 14:** PT4 - Weekly Bison Uploads
