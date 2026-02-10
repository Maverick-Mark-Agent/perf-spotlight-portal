import { createClient } from '@supabase/supabase-js';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';
import { ErrorType, classifyError } from './taxonomy';

const supabase = createClient(secrets.supabaseUrl, secrets.supabaseServiceRoleKey);

export interface ErrorContext {
  runId?: string;
  step: string;
  errorType?: ErrorType;
  url?: string;
  selector?: string;
  screenshotPath?: string;
  tracePath?: string;
  context?: Record<string, any>;
}

export class ErrorTracker {
  async trackError(error: Error, context: ErrorContext): Promise<void> {
    const errorType = context.errorType || classifyError(error);

    logger.error('Tracking error', {
      step: context.step,
      errorType,
      message: error.message,
    });

    try {
      const { error: dbError } = await supabase.from('agent_errors').insert({
        run_id: context.runId || null,
        step: context.step,
        error_type: errorType,
        message: error.message,
        stack_trace: error.stack || null,
        screenshot_url: context.screenshotPath || null,
        trace_url: context.tracePath || null,
        context: context.context || null,
        retry_count: 0,
        resolved: false,
      });

      if (dbError) {
        logger.error('Failed to persist error to database', { error: dbError });
      } else {
        logger.info('Error tracked successfully', { errorType, step: context.step });
      }
    } catch (trackError) {
      logger.error('Error tracker failed', { error: trackError });
    }
  }

  async incrementRetryCount(errorId: number): Promise<void> {
    const { error } = await supabase
      .from('agent_errors')
      .update({ retry_count: supabase.rpc('increment', { x: 1, field: 'retry_count' }) })
      .eq('id', errorId);

    if (error) {
      logger.error('Failed to increment retry count', { errorId, error });
    }
  }

  async markResolved(errorId: number): Promise<void> {
    const { error } = await supabase
      .from('agent_errors')
      .update({ resolved: true, resolved_at: new Date().toISOString() })
      .eq('id', errorId);

    if (error) {
      logger.error('Failed to mark error as resolved', { errorId, error });
    } else {
      logger.info('Error marked as resolved', { errorId });
    }
  }

  async getUnresolvedErrors(runId?: string): Promise<any[]> {
    let query = supabase
      .from('agent_errors')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false });

    if (runId) {
      query = query.eq('run_id', runId);
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to fetch unresolved errors', { error });
      return [];
    }

    return data || [];
  }
}

export const errorTracker = new ErrorTracker();
