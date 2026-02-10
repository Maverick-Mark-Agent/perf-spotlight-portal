import { scheduleWorkflow } from './queue';
import { logger } from '@lib/logger';

export async function schedulePT1Monthly(): Promise<void> {
  // Schedule PT1 for 15th of every month
  await scheduleWorkflow(
    'pt1_cole_pulls',
    {
      clientId: 1,
      clientName: 'Example Client',
      workspace: 'Example Workspace',
      states: ['NJ'],
      zips: ['07030', '07031'],
      month: new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    },
    {
      repeat: {
        pattern: '0 9 15 * *', // 9 AM on 15th of every month
      },
    }
  );

  logger.info('PT1 monthly schedule created');
}

export async function schedulePT4Weekly(): Promise<void> {
  // Schedule PT4 weekly on Fridays
  await scheduleWorkflow(
    'pt4_bison_uploads',
    {
      clientId: 1,
      clientName: 'Example Client',
      workspace: 'Example Workspace',
      csvPath: 'temp/cleaned.csv',
      campaignName: 'Weekly Upload',
    },
    {
      repeat: {
        pattern: '0 10 * * 5', // 10 AM every Friday
      },
    }
  );

  logger.info('PT4 weekly schedule created');
}
