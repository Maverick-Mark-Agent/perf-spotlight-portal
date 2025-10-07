import { createClient } from '@supabase/supabase-js';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';
import crypto from 'crypto';

const supabase = createClient(secrets.supabaseUrl, secrets.supabaseServiceRoleKey);

export interface PT3Config {
  clientId: number;
  clientName: string;
  workspace: string;
  month: string;
  targetCount: number;
}

export async function executePT3(config: PT3Config): Promise<void> {
  const runId = crypto.randomUUID();

  logger.info('Starting PT3 - Gap Analysis', { runId, client: config.clientName });

  await supabase.from('agent_runs').insert({
    run_id: runId,
    workflow: 'gap_analysis',
    client_id: config.clientId,
    status: 'running',
    started_at: new Date().toISOString(),
  });

  try {
    // Get cleaned count from monthly_cleaned_leads
    const { data: monthlyData } = await supabase
      .from('monthly_cleaned_leads')
      .select('cleaned_count')
      .eq('client_name', config.clientName)
      .eq('month', config.month)
      .single();

    const cleanedCount = monthlyData?.cleaned_count || 0;
    const gap = config.targetCount - cleanedCount;

    logger.info('Gap analysis complete', {
      target: config.targetCount,
      cleaned: cleanedCount,
      gap,
    });

    await supabase.from('agent_runs').update({
      status: 'success',
      finished_at: new Date().toISOString(),
      metrics: { target: config.targetCount, cleaned: cleanedCount, gap },
    }).eq('run_id', runId);

  } catch (error) {
    logger.error('PT3 failed', { error });
    throw error;
  }
}
