# Phase 12: PT2 - Clay Formatting & Enrichment

**Milestone:** Workflow Automation
**Estimated Effort:** 6-8 hours
**Dependencies:** Phase 7 (Clay), Phase 9 (Pipeline), Phase 11 (PT1)
**Blocks:** Phase 13, 16

---

## Overview

Implement PT2 workflow: import raw leads into Clay, add derived columns, run Debounce, filter, export cleaned data, save to cleaned_leads table, update monthly_cleaned_leads.

---

## Tasks

### Task 1: Create PT2 Workflow

**File to create:** `src/workflows/pt2-clay-format.ts`

**Content:**
```typescript
import { ClayConnector } from '@connectors/clay';
import { CLAY_FORMULAS, CLAY_FILTERS } from '@connectors/clay-config';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@lib/logger';
import { normalizeString, normalizeEmail, normalizeZip, normalizeName, normalizeHomeValue } from '@pipeline/normalizer';
import { validateLead } from '@pipeline/validator';
import { generateDedupeKey } from '@pipeline/deduplicator';
import { calculatePurchaseDay, calculateRenewalDate, formatReadableDate } from '@pipeline/transformer';

export interface PT2Config {
  clientId: number;
  clientName: string;
  workspace: string;
  month: string;
  rawLeadIds: number[];
}

export async function executePT2(config: PT2Config): Promise<void> {
  const runId = crypto.randomUUID();

  logger.info('Starting PT2 - Clay Formatting', { runId, client: config.clientName });

  await supabase.from('agent_runs').insert({
    run_id: runId,
    workflow: 'clay_format',
    client_id: config.clientId,
    site: 'clay',
    status: 'running',
    started_at: new Date().toISOString(),
  });

  const clay = new ClayConnector();

  try {
    await clay.connect();

    // Create workbook
    await clay.createWorkbook(config.clientName, config.month);

    // Fetch raw leads
    const { data: rawLeads } = await supabase
      .from('raw_leads')
      .select('*')
      .in('id', config.rawLeadIds);

    // Export to temp CSV
    const csvPath = `temp/raw-${config.month}.csv`;
    await exportToCSV(rawLeads, csvPath);

    // Import to Clay
    await clay.importCSV({
      clientName: config.clientName,
      month: config.month,
      csvPath,
    });

    // Add formula columns
    await clay.addFormulaColumn(CLAY_FORMULAS.numericHomeValue);
    await clay.addFormulaColumn(CLAY_FORMULAS.readablePurchaseDate);
    await clay.addFormulaColumn(CLAY_FORMULAS.purchaseDay);

    // Run Debounce
    await clay.runDebounce('Email_Address');

    // Apply filters
    await clay.applyFilters([
      CLAY_FILTERS.headOfHousehold,
      CLAY_FILTERS.homeValueMax(900000),
      CLAY_FILTERS.safeToSendEmail,
    ]);

    // Export cleaned data
    const cleanedPath = await clay.exportCSV({
      outputPath: `temp/cleaned-${config.month}.csv`,
    });

    // Parse and save to cleaned_leads
    const cleanedRecords = await parseCSV(cleanedPath);
    let cleanedCount = 0;

    for (const record of cleanedRecords) {
      const normalized = {
        first_name: normalizeName(record.First_Name),
        last_name: normalizeName(record.Last_Name),
        email: normalizeEmail(record['first safe to send email'] || record.Email_Address),
        phone: record.Cell_Phone_Number,
        address_1: record.Address_1,
        city: record.City,
        state: record.State,
        zip: normalizeZip(record.Zip),
        purchase_date: record.Purchase_Date,
        purchase_day: calculatePurchaseDay(record.Purchase_Date),
        home_value: normalizeHomeValue(record['Numeric Home Value']),
        readable_purchase_date: record['Readable Purchase Date'],
        renewal_date: calculateRenewalDate(record.Purchase_Date),
        email_valid: true,
        dedupe_key: generateDedupeKey(record.Email_Address, record.Address_1),
        validation_status: 'valid',
      };

      const validation = validateLead(normalized);

      if (validation.valid) {
        await supabase.from('cleaned_leads').insert({
          ...normalized,
          agent_run_id: runId,
        });
        cleanedCount++;
      }
    }

    // Update monthly_cleaned_leads
    await supabase.from('monthly_cleaned_leads').upsert({
      client_name: config.clientName,
      workspace_name: config.workspace,
      month: config.month,
      cleaned_count: cleanedCount,
    });

    await supabase.from('agent_runs').update({
      status: 'success',
      finished_at: new Date().toISOString(),
      metrics: { records_cleaned: cleanedCount },
    }).eq('run_id', runId);

    logger.info('PT2 completed successfully', { cleanedCount });

    await clay.disconnect();

  } catch (error) {
    logger.error('PT2 failed', { error });
    await clay.disconnect();
    throw error;
  }
}

async function exportToCSV(records: any[], path: string): Promise<void> {
  // Implementation
}

async function parseCSV(path: string): Promise<any[]> {
  // Implementation
  return [];
}
```

**Acceptance:**
- [ ] PT2 workflow complete
- [ ] Imports to Clay
- [ ] Adds derived columns
- [ ] Runs Debounce
- [ ] Exports and saves cleaned leads

---

## Next Phase

**Phase 13:** PT3 - Totals Review & Gap Analysis
