import { BisonConnector } from '@connectors/bison';
import { createClient } from '@supabase/supabase-js';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';
import crypto from 'crypto';

const supabase = createClient(secrets.supabaseUrl, secrets.supabaseServiceRoleKey);

export interface PT5Config {
  clientId: number;
  clientName: string;
  workspace: string;
  campaignId: string;
  newTitle: string;
}

export async function executePT5(config: PT5Config): Promise<void> {
  const runId = crypto.randomUUID();

  logger.info('Starting PT5 - Evergreen Update', { runId, client: config.clientName });

  await supabase.from('agent_runs').insert({
    run_id: runId,
    workflow: 'evergreen_update',
    client_id: config.clientId,
    site: 'bison',
    status: 'running',
    started_at: new Date().toISOString(),
  });

  const bison = new BisonConnector();

  try {
    await bison.connect(config.workspace);

    // Rename campaign
    await bison.renameCampaign(config.campaignId, config.newTitle);

    logger.info('PT5 completed successfully');

    await supabase.from('agent_runs').update({
      status: 'success',
      finished_at: new Date().toISOString(),
    }).eq('run_id', runId);

    await bison.disconnect();

  } catch (error) {
    logger.error('PT5 failed', { error });
    await bison.disconnect();
    throw error;
  }
}
