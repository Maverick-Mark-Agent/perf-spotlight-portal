# Phase 16: Orchestrator & Job Scheduling (BullMQ)

**Milestone:** Production Readiness
**Estimated Effort:** 8-10 hours
**Dependencies:** Phase 11, 12, 13 (Workflows)
**Blocks:** Phase 17 (GitHub Actions)

---

## Overview

Implement BullMQ job queue for orchestrating workflows (PT1-PT5), handle retries with exponential backoff, persist agent_runs for each execution, enable programmatic job scheduling.

---

## Tasks

### Task 1: Create Queue Setup

**File to create:** `src/orchestrator/queue.ts`

**Content:**
```typescript
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';

const connection = new Redis(secrets.redisUrl, { maxRetriesPerRequest: null });

export const workflowQueue = new Queue('workflows', { connection });

export async function enqueueWorkflow(name: string, data: any, options?: any): Promise<void> {
  logger.info('Enqueueing workflow', { name, data });

  await workflowQueue.add(name, data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    ...options,
  });
}

export async function getQueueStatus(): Promise<any> {
  const counts = await workflowQueue.getJobCounts();
  return counts;
}
```

**Acceptance:**
- [ ] BullMQ queue created
- [ ] Redis connection established
- [ ] Enqueue function working

---

### Task 2: Create Worker

**File to create:** `src/orchestrator/worker.ts`

**Content:**
```typescript
import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { secrets } from '@lib/secrets';
import { logger } from '@lib/logger';
import { executePT1 } from '@workflows/pt1-cole-pulls';
import { executePT2 } from '@workflows/pt2-clay-format';
import { executePT3 } from '@workflows/pt3-gap-analysis';
import { executePT4 } from '@workflows/pt4-bison-uploads';
import { executePT5 } from '@workflows/pt5-evergreen-update';

const connection = new Redis(secrets.redisUrl, { maxRetriesPerRequest: null });

const worker = new Worker(
  'workflows',
  async (job: Job) => {
    logger.info('Processing workflow job', { name: job.name, id: job.id });

    switch (job.name) {
      case 'pt1':
        await executePT1(job.data);
        break;
      case 'pt2':
        await executePT2(job.data);
        break;
      case 'pt3':
        await executePT3(job.data);
        break;
      case 'pt4':
        await executePT4(job.data);
        break;
      case 'pt5':
        await executePT5(job.data);
        break;
      default:
        throw new Error(`Unknown workflow: ${job.name}`);
    }

    logger.info('Workflow job completed', { name: job.name, id: job.id });
  },
  { connection }
);

worker.on('completed', (job) => {
  logger.info('Job completed', { id: job.id });
});

worker.on('failed', (job, error) => {
  logger.error('Job failed', { id: job?.id, error: error.message });
});

export { worker };
```

**Acceptance:**
- [ ] Worker processes jobs
- [ ] Handles PT1-PT5 workflows
- [ ] Retries on failure

---

## Definition of Done

- [ ] BullMQ queue and worker created
- [ ] Jobs enqueue successfully
- [ ] Worker processes jobs
- [ ] Retries work correctly
- [ ] agent_runs persisted

---

## Next Phase

**Phase 17:** GitHub Actions Workflows
