# Phase 14: PT4 - Weekly Bison Uploads

**Milestone:** Workflow Automation
**Estimated Effort:** 6-8 hours
**Dependencies:** Phase 8 (Bison), Phase 9 (Pipeline), Phase 12 (PT2)
**Blocks:** Phase 15, 17

---

## Overview

Implement PT4 workflow: calculate 4 renewal windows for next month (M+28 to M+34 logic), query cleaned_leads by purchase_day, upload to Bison with field mapping, record in client_lead_batches.

---

## Tasks

### Task 1: Create Renewal Window Calculator

**File to create:** `src/lib/renewal-windows.ts`

**Content:**
```typescript
export interface RenewalWindow {
  name: string;
  startDay: number;
  endDay: number;
  startDate: string;
  endDate: string;
}

export function calculateRenewalWindows(uploadDate: Date): RenewalWindow[] {
  // Upload date is Monday (M)
  // Windows are M+28 to M+34 (4 weeks out)

  const windows: RenewalWindow[] = [];

  const firstWindowStart = new Date(uploadDate);
  firstWindowStart.setDate(firstWindowStart.getDate() + 28);

  const month = firstWindowStart.getMonth();
  const year = firstWindowStart.getFullYear();

  // Week 1: Day 1-7
  windows.push({
    name: 'Week 1',
    startDay: 1,
    endDay: 7,
    startDate: formatDate(year, month, 1),
    endDate: formatDate(year, month, 7),
  });

  // Week 2: Day 8-14
  windows.push({
    name: 'Week 2',
    startDay: 8,
    endDay: 14,
    startDate: formatDate(year, month, 8),
    endDate: formatDate(year, month, 14),
  });

  // Week 3: Day 15-21
  windows.push({
    name: 'Week 3',
    startDay: 15,
    endDay: 21,
    startDate: formatDate(year, month, 15),
    endDate: formatDate(year, month, 21),
  });

  // Week 4: Day 22-end of month
  const lastDay = new Date(year, month + 1, 0).getDate();
  windows.push({
    name: 'Week 4',
    startDay: 22,
    endDay: lastDay,
    startDate: formatDate(year, month, 22),
    endDate: formatDate(year, month, lastDay),
  });

  return windows;
}

function formatDate(year: number, month: number, day: number): string {
  const date = new Date(year, month, day);
  return date.toISOString().split('T')[0];
}
```

**Acceptance:**
- [ ] Renewal window calculator created
- [ ] Calculates 4 windows correctly
- [ ] Last window extends to month-end

---

### Task 2: Create PT4 Workflow

**File to create:** `src/workflows/pt4-bison-uploads.ts`

**Content:**
```typescript
import { BisonConnector } from '@connectors/bison';
import { calculateRenewalWindows } from '@lib/renewal-windows';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@lib/logger';

export interface PT4Config {
  clientId: number;
  clientName: string;
  workspace: string;
  month: string;
}

export async function executePT4(config: PT4Config): Promise<void> {
  const runId = crypto.randomUUID();

  logger.info('Starting PT4 - Bison Uploads', { runId, client: config.clientName });

  const bison = new BisonConnector();

  try {
    await bison.connect(config.workspace);

    const windows = calculateRenewalWindows(new Date());

    for (const window of windows) {
      logger.info('Uploading window', { window: window.name });

      // Query cleaned_leads for this window
      const { data: leads } = await supabase
        .from('cleaned_leads')
        .select('*')
        .gte('purchase_day', window.startDay)
        .lte('purchase_day', window.endDay);

      if (!leads || leads.length === 0) {
        logger.warn('No leads for window', { window: window.name });
        continue;
      }

      // Export to CSV
      const csvPath = `temp/${config.month}-${window.name}.csv`;
      await exportLeadsToCSV(leads, csvPath);

      // Upload to Bison
      const listName = `${config.month} (${window.startDate} - ${window.endDate} renewals)`;
      await bison.importContacts({
        workspace: config.workspace,
        csvPath,
        listName,
        fieldMapping: {
          first_name: 'First Name',
          last_name: 'Last Name',
          email: 'Email',
          renewal_date: 'Renewal Date',
          phone: 'Cellphone',
          home_value: 'Home Value',
        },
      });

      // Record batch
      await supabase.from('client_lead_batches').insert({
        client_id: config.clientId,
        month: config.month,
        week_window_start: window.startDate,
        week_window_end: window.endDate,
        count_cleaned: leads.length,
        count_uploaded: leads.length,
        status: 'uploaded',
        bison_list_name: listName,
      });
    }

    logger.info('PT4 completed successfully');
    await bison.disconnect();

  } catch (error) {
    logger.error('PT4 failed', { error });
    await bison.disconnect();
    throw error;
  }
}

async function exportLeadsToCSV(leads: any[], path: string): Promise<void> {
  // Implementation
}
```

**Acceptance:**
- [ ] PT4 workflow complete
- [ ] Calculates windows
- [ ] Uploads 4 lists to Bison
- [ ] Records batches

---

## Next Phase

**Phase 15:** PT5 - Evergreen Campaign Updates
