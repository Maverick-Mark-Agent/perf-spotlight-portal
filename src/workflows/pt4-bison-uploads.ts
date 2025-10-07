import { BisonConnector } from '@connectors/bison';
import { createClient } from '@supabase/supabase-js';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';
import crypto from 'crypto';

const supabase = createClient(secrets.supabaseUrl, secrets.supabaseServiceRoleKey);

export interface PT4Config {
  clientId: number;
  clientName: string;
  workspace: string;
  csvPath: string;
  campaignName: string;
}

export async function executePT4(config: PT4Config): Promise<void> {
  const runId = crypto.randomUUID();

  logger.info('Starting PT4 - Bison Upload', { runId, client: config.clientName });

  await supabase.from('agent_runs').insert({
    run_id: runId,
    workflow: 'bison_upload',
    client_id: config.clientId,
    site: 'bison',
    status: 'running',
    started_at: new Date().toISOString(),
  });

  const bison = new BisonConnector();

  try {
    await bison.connect(config.workspace);

    const count = await bison.importContacts({
      workspace: config.workspace,
      csvPath: config.csvPath,
      listName: `${config.clientName} - ${new Date().toISOString().split('T')[0]}`,
      fieldMapping: {
        'Email_Address': 'email',
        'First_Name': 'first_name',
        'Last_Name': 'last_name',
        'City': 'city',
        'State': 'state',
        'Zip': 'zip',
      },
    });

    logger.info('PT4 completed successfully', { count });

    await supabase.from('agent_runs').update({
      status: 'success',
      finished_at: new Date().toISOString(),
      metrics: { uploaded_count: count },
    }).eq('run_id', runId);

    await bison.disconnect();

  } catch (error) {
    logger.error('PT4 failed', { error });
    await bison.disconnect();
    throw error;
  }
}
