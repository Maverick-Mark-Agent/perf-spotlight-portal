import { ClayConnector } from '@connectors/clay';
import { CLAY_FORMULAS, CLAY_FILTERS } from '@connectors/clay-config';
import { createClient } from '@supabase/supabase-js';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';
import { parse } from 'csv-parse/sync';
import fs from 'fs/promises';
import crypto from 'crypto';

const supabase = createClient(secrets.supabaseUrl, secrets.supabaseServiceRoleKey);

export interface PT2Config {
  clientId: number;
  clientName: string;
  workspace: string;
  month: string;
  rawCSVPath: string;
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
    await clay.createWorkbook(config.clientName, config.month);
    await clay.importCSV({
      clientName: config.clientName,
      month: config.month,
      csvPath: config.rawCSVPath,
    });

    // Add formula columns
    await clay.addFormulaColumn(CLAY_FORMULAS.numericHomeValue);
    await clay.addFormulaColumn(CLAY_FORMULAS.readablePurchaseDate);
    await clay.addFormulaColumn(CLAY_FORMULAS.purchaseDay);

    // Run Debounce
    await clay.runDebounce('Email_Address');

    // Apply filters and export
    const cleanedPath = await clay.exportCSV({
      filters: [
        CLAY_FILTERS.headOfHousehold,
        CLAY_FILTERS.homeValueMax(900000),
        CLAY_FILTERS.safeToSendEmail,
      ],
      outputPath: `temp/cleaned-${config.month}.csv`,
    });

    logger.info('PT2 completed successfully', { cleanedPath });

    await supabase.from('agent_runs').update({
      status: 'success',
      finished_at: new Date().toISOString(),
    }).eq('run_id', runId);

    await clay.disconnect();

  } catch (error) {
    logger.error('PT2 failed', { error });
    await clay.disconnect();
    throw error;
  }
}
