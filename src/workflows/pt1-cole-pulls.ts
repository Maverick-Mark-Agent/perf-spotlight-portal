import { ColeConnector } from '@connectors/cole';
import { COLE_REQUIRED_FIELDS } from '@connectors/cole-config';
import { createClient } from '@supabase/supabase-js';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';
import { errorTracker } from '@lib/errors';
import crypto from 'crypto';

const supabase = createClient(secrets.supabaseUrl, secrets.supabaseServiceRoleKey);

export interface PT1Config {
  clientId: number;
  clientName: string;
  workspace: string;
  states: string[];
  zips: string[];
  month: string;
  filters?: {
    homeValueMax?: number;
    purchaseYearMin?: number;
  };
}

export async function executePT1(config: PT1Config): Promise<void> {
  const runId = crypto.randomUUID();

  logger.info('Starting PT1 - Cole Monthly Pulls', { runId, client: config.clientName, month: config.month });

  // Create agent_run record
  await supabase.from('agent_runs').insert({
    run_id: runId,
    workflow: 'cole_pull',
    client_id: config.clientId,
    site: 'cole',
    status: 'running',
    started_at: new Date().toISOString(),
  });

  const cole = new ColeConnector();

  try {
    let totalRecords = 0;

    for (const state of config.states) {
      logger.info('Pulling data for state', { state });

      await cole.connect(state);

      const result = await cole.queryData({
        state,
        zips: config.zips,
        fields: COLE_REQUIRED_FIELDS,
        filters: config.filters,
      });

      // Save to raw_leads
      for (const record of result.records) {
        await supabase.from('raw_leads').insert({
          lead_source_id: null,
          agent_run_id: runId,
          payload_json: record,
          hash: generateHash(record),
        });
      }

      // Save ZIPs to client_zipcodes
      for (const zip of config.zips) {
        await supabase.from('client_zipcodes').insert({
          client_name: config.clientName,
          workspace_name: config.workspace,
          month: config.month,
          zip,
          state,
          agent_run_id: runId,
        });
      }

      totalRecords += result.totalCount;
      await cole.disconnect();
    }

    // Update agent_run as success
    await supabase.from('agent_runs').update({
      status: 'success',
      finished_at: new Date().toISOString(),
      metrics: { records_pulled: totalRecords },
    }).eq('run_id', runId);

    logger.info('PT1 completed successfully', { totalRecords });

    // Post Slack notification
    await postSlackNotification({
      client: config.clientName,
      month: config.month,
      records: totalRecords,
    });

  } catch (error) {
    logger.error('PT1 failed', { error });

    await errorTracker.trackError(error as Error, {
      runId,
      step: 'cole_pull',
    });

    await supabase.from('agent_runs').update({
      status: 'failed',
      finished_at: new Date().toISOString(),
      error: (error as Error).message,
    }).eq('run_id', runId);

    throw error;
  }
}

function generateHash(record: Record<string, any>): string {
  const normalized = JSON.stringify(record);
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

async function postSlackNotification(data: { client: string; month: string; records: number }): Promise<void> {
  // Implement in Phase 19
  logger.info('Slack notification (placeholder)', data);
}
