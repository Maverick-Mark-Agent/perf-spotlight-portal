import { Queue, Worker, Job } from 'bullmq';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';
import { executePT1 } from '@workflows/pt1-cole-pulls';
import { executePT2 } from '@workflows/pt2-clay-format';
import { executePT3 } from '@workflows/pt3-gap-analysis';
import { executePT4 } from '@workflows/pt4-bison-uploads';
import { executePT5 } from '@workflows/pt5-evergreen-updates';

const connection = {
  host: new URL(secrets.redisUrl).hostname,
  port: parseInt(new URL(secrets.redisUrl).port || '6379'),
};

export const workflowQueue = new Queue('workflows', { connection });

export function startWorkers(): void {
  const worker = new Worker(
    'workflows',
    async (job: Job) => {
      logger.info('Processing workflow job', { type: job.name, data: job.data });

      switch (job.name) {
        case 'pt1_cole_pulls':
          await executePT1(job.data);
          break;
        case 'pt2_clay_format':
          await executePT2(job.data);
          break;
        case 'pt3_gap_analysis':
          await executePT3(job.data);
          break;
        case 'pt4_bison_uploads':
          await executePT4(job.data);
          break;
        case 'pt5_evergreen_updates':
          await executePT5(job.data);
          break;
        default:
          throw new Error(`Unknown workflow: ${job.name}`);
      }
    },
    { connection }
  );

  worker.on('completed', (job) => {
    logger.info('Job completed', { jobId: job.id, name: job.name });
  });

  worker.on('failed', (job, err) => {
    logger.error('Job failed', { jobId: job?.id, name: job?.name, error: err });
  });

  logger.info('Workflow workers started');
}

export async function scheduleWorkflow(workflowName: string, data: any, options: any = {}): Promise<void> {
  await workflowQueue.add(workflowName, data, options);
  logger.info('Workflow scheduled', { workflowName, data });
}
